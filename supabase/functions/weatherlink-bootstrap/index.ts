import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WL_BASE = "https://api.weatherlink.com/v2";
const API_KEY = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SEC = Deno.env.get("WEATHERLINK_API_SECRET")!;
const SB_URL  = Deno.env.get("SUPABASE_URL")!;
const SB_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const fToC  = (f?: number|null) => f == null ? null : Math.round(((f-32)*5/9)*10)/10;
const toKmh = (v?: number|null) => v == null ? null : Math.round(v*1.60934*10)/10;
const toMm  = (v?: number|null) => v == null ? null : Math.round(v*25.4*100)/100;

function tsToNaive(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function normalize(raw: Record<string,unknown>, stationId: string, stationName: string) {
  const ts = raw.ts as number;
  return {
    station_id: stationId, station_name: stationName, ts,
    fecha_hora:          tsToNaive(ts),
    temp_c:              fToC(raw.temp_out as number),
    temp_max_c:          fToC(raw.temp_out_hi as number),
    temp_min_c:          fToC(raw.temp_out_lo as number),
    hum_pct:             raw.hum_out   ?? null,
    hum_max_pct:         raw.hum_out_hi ?? null,
    hum_min_pct:         raw.hum_out_lo ?? null,
    punto_rocio_c:       fToC(raw.dew_point_out as number),
    bulbo_humedo_c:      fToC(raw.wet_bulb as number),
    indice_calor_c:      fToC(raw.heat_index_out as number),
    wind_chill_c:        fToC(raw.wind_chill as number),
    thw_index_c:         fToC(raw.thw_index as number),
    thsw_index_c:        fToC(raw.thsw_index as number),
    viento_avg_kmh:      toKmh(raw.wind_speed_avg as number),
    viento_max_kmh:      toKmh(raw.wind_speed_hi as number),
    dir_viento:          raw.wind_dir_of_prevail ?? null,
    dir_viento_max:      raw.wind_dir_at_hi_speed ?? null,
    recorrido_viento_km: toKmh(raw.wind_run as number),
    lluvia_mm:           toMm(raw.rainfall_in as number),
    tasa_lluvia_mm_h:    toMm(raw.rain_rate_hi_in as number),
    radiacion_w_m2:      raw.solar_rad_avg ?? null,
    radiacion_max_w_m2:  raw.solar_rad_hi  ?? null,
    et_mm:               toMm(raw.et as number),
    barometro_inhg:      raw.bar          ?? null,
    presion_abs_inhg:    raw.bar_absolute ?? null,
    grados_calefaccion:  raw.deg_days_heat ?? null,
    grados_enfriamiento: raw.deg_days_cool ?? null,
    sensor_type:         raw._sensor_type  ?? null,
  };
}

async function fetchDay(stationId: string, startTs: number, endTs: number) {
  const url = new URL(`${WL_BASE}/historic/${stationId}`);
  url.searchParams.set("api-key", API_KEY);
  url.searchParams.set("start-timestamp", String(startTs));
  url.searchParams.set("end-timestamp",   String(endTs));
  for (let attempt = 1; attempt <= 6; attempt++) {
    const resp = await fetch(url.toString(), { headers: { "X-Api-Secret": API_SEC } });
    if (resp.status === 429) {
      const ra = resp.headers.get("Retry-After");
      const wait = ra ? Math.min(parseInt(ra)*1000,90000) : Math.min(5000*2**(attempt-1),90000);
      console.log(`429 waiting ${wait/1000}s`);
      await new Promise(r=>setTimeout(r,wait));
      continue;
    }
    if (!resp.ok) {
      const txt = await resp.text();
      let d = txt;
      try { const p=JSON.parse(txt); d=p.message??p.error??txt; } catch{}
      throw new Error(`WL ${resp.status}: ${d}`);
    }
    const json = await resp.json();
    const records: Record<string,unknown>[] = [];
    for (const s of json.sensors??[]) for (const r of s.data??[]) records.push({...r,_sensor_type:s.sensor_type});
    return records;
  }
  throw new Error("Max retries (429)");
}

Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{headers:CORS});
  const supabase = createClient(SB_URL, SB_KEY);

  try {
    const body = req.method==="POST" ? await req.json() : {};
    // How many days back to load per invocation (default 7)
    const chunkDays   = Math.min(parseInt(String(body.chunk_days??"7")),14);
    // offset_days: how many days back from NOW this chunk starts (0 = most recent)
    const offsetDays  = parseInt(String(body.offset_days??"0"));
    // total days of history to load (default 365)
    const totalDays   = parseInt(String(body.total_days??"365"));

    const nowTs = Math.floor(Date.now()/1000);

    // 1. Get all stations from WeatherLink
    const stUrl = new URL(`${WL_BASE}/stations`);
    stUrl.searchParams.set("api-key", API_KEY);
    const stResp = await fetch(stUrl.toString(), { headers:{"X-Api-Secret":API_SEC} });
    if (!stResp.ok) throw new Error(`Stations fetch failed: ${stResp.status}`);
    const stJson = await stResp.json();
    const stations: {id:string, name:string}[] = (stJson.stations??[]).map((s:Record<string,unknown>)=>({
      id:   String(s.station_id),
      name: String(s.station_name??s.station_id),
    }));

    if (stations.length===0) throw new Error("No stations found in WeatherLink account");

    // 2. For each station, fetch the chunk window
    // Window: from (now - offsetDays - chunkDays) to (now - offsetDays)
    const windowEnd   = nowTs - offsetDays * 86400;
    const windowStart = windowEnd - chunkDays * 86400;
    const done        = windowStart <= (nowTs - totalDays * 86400);

    const results: Record<string,unknown>[] = [];

    for (const station of stations) {
      let cursor        = windowStart;
      let recordsSaved  = 0;
      let lastTs        = 0;

      // Register station in sync_status if not exists
      await supabase.from("sync_status").upsert({
        station_id:   station.id,
        station_name: station.name,
        status:       "syncing",
      }, { onConflict:"station_id", ignoreDuplicates: false });

      while (cursor < windowEnd) {
        const dayEnd = Math.min(cursor+86400, windowEnd);
        try {
          const raw  = await fetchDay(station.id, cursor, dayEnd);
          const rows = raw.map(r=>normalize(r, station.id, station.name));
          if (rows.length>0) {
            const {error} = await supabase
              .from("weather_readings")
              .upsert(rows, {onConflict:"station_id,ts"});
            if (error) throw new Error(`DB: ${error.message}`);
            recordsSaved += rows.length;
            const mx = Math.max(...rows.map(r=>r.ts as number));
            if (mx>lastTs) lastTs=mx;
          }
        } catch(e) {
          console.error(`Station ${station.id} day ${new Date(cursor*1000).toISOString().slice(0,10)}: ${(e as Error).message}`);
        }
        cursor = dayEnd;
        // Pace between days
        await new Promise(r=>setTimeout(r,300));
      }

      // Update sync_status for this station
      const {count} = await supabase
        .from("weather_readings")
        .select("*",{count:"exact",head:true})
        .eq("station_id", station.id);

      await supabase.from("sync_status").upsert({
        station_id:    station.id,
        station_name:  station.name,
        last_ts:       lastTs>0 ? lastTs : null,
        last_sync_at:  new Date().toISOString(),
        total_records: count??0,
        status:        done ? "idle" : "syncing",
      },{onConflict:"station_id"});

      results.push({
        station_id:    station.id,
        station_name:  station.name,
        records_saved: recordsSaved,
        total_in_db:   count??0,
      });

      // Pause between stations to avoid rate limits
      await new Promise(r=>setTimeout(r,1000));
    }

    const nextOffset = offsetDays + chunkDays;
    return new Response(JSON.stringify({
      ok:           true,
      done,
      stations:     results,
      chunk_days:   chunkDays,
      offset_days:  offsetDays,
      next_offset:  done ? null : nextOffset,
      progress_pct: Math.min(Math.round((nextOffset/totalDays)*100),100),
      days_remaining: Math.max(totalDays-nextOffset,0),
      window: {
        from: new Date(windowStart*1000).toISOString().slice(0,10),
        to:   new Date(windowEnd*1000).toISOString().slice(0,10),
      }
    }),{headers:{...CORS,"Content-Type":"application/json"}});

  } catch(err) {
    return new Response(
      JSON.stringify({ok:false, error:(err as Error).message}),
      {status:400, headers:{...CORS,"Content-Type":"application/json"}}
    );
  }
});
