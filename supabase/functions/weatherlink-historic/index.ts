import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WL_BASE = "https://api.weatherlink.com/v2";
const API_KEY = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SEC = Deno.env.get("WEATHERLINK_API_SECRET")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const fToC  = (f: unknown) => typeof f !== "number" ? null : Math.round(((f-32)*5/9)*10)/10;
const toKmh = (v: unknown) => typeof v !== "number" ? null : Math.round(v*1.60934*10)/10;
const toMm  = (v: unknown) => typeof v !== "number" ? null : Math.round(v*25.4*100)/100;
const num   = (v: unknown) => typeof v === "number" ? v : null;

function tsToNaive(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function tsToDate(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`;
}

function mergeByTs(records: Record<string,unknown>[]): Record<number, Record<string,unknown>> {
  const byTs: Record<number, Record<string,unknown>> = {};
  for (const raw of records) {
    const ts = raw.ts as number;
    if (!ts) continue;
    if (!byTs[ts]) byTs[ts] = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined && byTs[ts][k] == null) byTs[ts][k] = v;
    }
  }
  return byTs;
}

function normalize(raw: Record<string,unknown>): Record<string,unknown> {
  return {
    timestamp:           raw.ts,
    fecha_hora:          tsToNaive(raw.ts as number),
    temp_c:              fToC(raw.temp_avg),
    temp_max_c:          fToC(raw.temp_hi),
    temp_min_c:          fToC(raw.temp_lo),
    hum_pct:             num(raw.hum_last),
    hum_max_pct:         num(raw.hum_hi),
    hum_min_pct:         num(raw.hum_lo),
    punto_rocio_c:       fToC(raw.dew_point_last),
    bulbo_humedo_c:      fToC(raw.wet_bulb_last),
    indice_calor_c:      fToC(raw.heat_index_last),
    wind_chill_c:        fToC(raw.wind_chill_last),
    thw_index_c:         fToC(raw.thw_index_last),
    thsw_index_c:        fToC(raw.thsw_index_last),
    viento_avg_kmh:      toKmh(raw.wind_speed_avg),
    viento_max_kmh:      toKmh(raw.wind_speed_hi),
    dir_viento:          num(raw.wind_dir_of_prevail),
    dir_viento_max:      num(raw.wind_speed_hi_dir),
    recorrido_viento_km: toKmh(raw.wind_run),
    lluvia_mm:           toMm(raw.rainfall_in),
    tasa_lluvia_mm_h:    toMm(raw.rain_rate_hi_in),
    radiacion_w_m2:      num(raw.solar_rad_avg),
    radiacion_max_w_m2:  num(raw.solar_rad_hi),
    et_mm:               toMm(raw.et),
    barometro_inhg:      num(raw.bar_sea_level),
    presion_abs_inhg:    num(raw.bar_absolute),
    grados_calefaccion:  num(raw.heating_degree_days),
    grados_enfriamiento: num(raw.cooling_degree_days),
  };
}

function aggregateDaily(records: Record<string,unknown>[]): Record<string,unknown>[] {
  const byDate: Record<string, Record<string,unknown>[]> = {};
  for (const r of records) {
    const fecha = tsToDate(r.timestamp as number);
    if (!byDate[fecha]) byDate[fecha] = [];
    byDate[fecha].push(r);
  }
  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10 : null;
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : null;
  const min = (arr: number[]) => arr.length ? Math.min(...arr) : null;
  const sum = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)*100)/100 : null;
  const vals = (recs: Record<string,unknown>[], key: string) =>
    recs.map(r => r[key]).filter(v => v != null) as number[];
  return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([fecha, recs]) => ({
    fecha,
    temp_avg_c:           avg(vals(recs, "temp_c")),
    temp_max_c:           max(vals(recs, "temp_max_c")),
    temp_min_c:           min(vals(recs, "temp_min_c")),
    hum_avg_pct:          avg(vals(recs, "hum_pct")),
    hum_max_pct:          max(vals(recs, "hum_max_pct")),
    hum_min_pct:          min(vals(recs, "hum_min_pct")),
    punto_rocio_avg_c:    avg(vals(recs, "punto_rocio_c")),
    bulbo_humedo_avg_c:   avg(vals(recs, "bulbo_humedo_c")),
    indice_calor_max_c:   max(vals(recs, "indice_calor_c")),
    wind_chill_min_c:     min(vals(recs, "wind_chill_c")),
    viento_avg_kmh:       avg(vals(recs, "viento_avg_kmh")),
    viento_max_kmh:       max(vals(recs, "viento_max_kmh")),
    lluvia_total_mm:      sum(vals(recs, "lluvia_mm")),
    tasa_lluvia_max_mm_h: max(vals(recs, "tasa_lluvia_mm_h")),
    radiacion_avg_w_m2:   avg(vals(recs, "radiacion_w_m2")),
    radiacion_max_w_m2:   max(vals(recs, "radiacion_max_w_m2")),
    et_total_mm:          sum(vals(recs, "et_mm")),
    presion_avg_inhg:     avg(vals(recs, "barometro_inhg")),
    registros:            recs.length,
  }));
}

async function fetchDay(sid: string, s: number, e: number): Promise<Record<string,unknown>[]> {
  const url = new URL(`${WL_BASE}/historic/${sid}`);
  url.searchParams.set("api-key", API_KEY);
  url.searchParams.set("start-timestamp", String(s));
  url.searchParams.set("end-timestamp",   String(e));
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(url.toString(), { headers: { "X-Api-Secret": API_SEC } });
    if (r.status === 429) { await new Promise(x => setTimeout(x, Math.min(3000*2**(i-1), 60000))); continue; }
    if (!r.ok) return [];
    const j = await r.json();
    const out: Record<string,unknown>[] = [];
    for (const sensor of j.sensors ?? []) for (const rec of sensor.data ?? []) out.push(rec);
    return out;
  }
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body        = req.method === "POST" ? await req.json() : {};
    const qp          = new URL(req.url).searchParams;
    const stationId   = String(body.station_id ?? qp.get("station_id") ?? "");
    const startDate   = String(body.start_date ?? qp.get("start_date") ?? "");
    const endDate     = String(body.end_date   ?? qp.get("end_date")   ?? new Date().toISOString().slice(0,10));
    const rate        = String(body.rate       ?? qp.get("rate")       ?? "raw");
    const concurrency = Math.min(parseInt(String(body.concurrency ?? "4")), 6);

    if (!stationId) throw new Error("Falta station_id");
    if (!startDate) throw new Error("Falta start_date (YYYY-MM-DD)");

    const startTs = Math.floor(new Date(startDate).getTime() / 1000);
    const endTs   = Math.floor(new Date(endDate).getTime()   / 1000);
    if (endTs <= startTs) throw new Error("end_date debe ser posterior a start_date");

    const windows: [number,number][] = [];
    let cursor = startTs;
    while (cursor < endTs) { windows.push([cursor, Math.min(cursor + 86400, endTs)]); cursor += 86400; }

    const allRecords: Record<string,unknown>[] = [];
    for (let i = 0; i < windows.length; i += concurrency) {
      const batch = windows.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(([s,e]) => fetchDay(stationId, s, e)));
      for (const recs of results) allRecords.push(...recs);
      if (i + concurrency < windows.length) await new Promise(r => setTimeout(r, 200));
    }

    const merged = mergeByTs(allRecords);
    const normalized = Object.values(merged)
      .map(normalize)
      .sort((a,b) => (a.timestamp as number) - (b.timestamp as number));

    const data = rate === "daily" ? aggregateDaily(normalized) : normalized;

    return new Response(JSON.stringify({
      ok: true, station_id: stationId, start_date: startDate, end_date: endDate,
      rate, total_records: data.length, data,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch(e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
