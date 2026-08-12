import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WL_BASE  = "https://api.weatherlink.com/v2";
const API_KEY  = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SEC  = Deno.env.get("WEATHERLINK_API_SECRET")!;
const SB_URL   = Deno.env.get("SUPABASE_URL")!;
const SB_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// ─── Converters ───────────────────────────────────────────────────────────────
const fToC  = (f?: number|null) => f == null ? null : Math.round(((f-32)*5/9)*10)/10;
const toKmh = (v?: number|null) => v == null ? null : Math.round(v*1.60934*10)/10;
const toMm  = (v?: number|null) => v == null ? null : Math.round(v*25.4*100)/100;

// WeatherLink reporta el mismo dato bajo DOS convenciones de nombre de campo
// segun la generacion de hardware/sensor_type del historic endpoint:
//   - sensor_type 72 (Vantage Pro2 / WeatherLink IP, generacion vieja): temp_out, hum_out, ...
//   - sensor_type 53 (WeatherLink Live / EnviroMonitor, generacion nueva,
//     estaciones instaladas abril-mayo 2026): temp_last/temp_avg, hum_last, ...
// normalize() antes solo leia la convencion vieja: para toda estacion nueva,
// temp_c/hum_pct (y los campos derivados) quedaban null en cada fila pese a
// que WeatherLink SI mandaba el dato real cada 15 min (confirmado llamando
// /v2/historic directo via wl-debug-sensors). Fix: usar el primer campo que
// exista, viejo o nuevo.
function pick(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v !== null && v !== undefined) return v as number;
  }
  return undefined;
}

function tsToNaive(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function normalize(raw: Record<string,unknown>, stationId: string, stationName: string): Record<string,unknown> {
  const ts = raw.ts as number;
  return {
    station_id:          stationId,
    station_name:        stationName,
    ts,
    fecha_hora:          tsToNaive(ts),
    // Temperatura
    temp_c:              fToC(pick(raw, "temp_out", "temp_avg", "temp_last")),
    temp_max_c:          fToC(pick(raw, "temp_out_hi", "temp_hi")),
    temp_min_c:          fToC(pick(raw, "temp_out_lo", "temp_lo")),
    // Humedad
    hum_pct:             pick(raw, "hum_out", "hum_last") ?? null,
    hum_max_pct:         pick(raw, "hum_out_hi", "hum_hi") ?? null,
    hum_min_pct:         pick(raw, "hum_out_lo", "hum_lo") ?? null,
    // Derived temp
    punto_rocio_c:       fToC(pick(raw, "dew_point_out", "dew_point_last")),
    bulbo_humedo_c:      fToC(pick(raw, "wet_bulb", "wet_bulb_last")),
    indice_calor_c:      fToC(pick(raw, "heat_index_out", "heat_index_last")),
    wind_chill_c:        fToC(pick(raw, "wind_chill", "wind_chill_last")),
    thw_index_c:         fToC(pick(raw, "thw_index", "thw_index_last")),
    thsw_index_c:        fToC(pick(raw, "thsw_index", "thsw_index_last")),
    // Viento
    viento_avg_kmh:      toKmh(raw.wind_speed_avg as number),
    viento_max_kmh:      toKmh(raw.wind_speed_hi as number),
    dir_viento:          raw.wind_dir_of_prevail ?? null,
    dir_viento_max:      pick(raw, "wind_dir_at_hi_speed", "wind_dir_of_hi", "wind_speed_hi_dir") ?? null,
    recorrido_viento_km: toKmh(raw.wind_run as number),
    // Lluvia
    lluvia_mm:           toMm(raw.rainfall_in as number),
    tasa_lluvia_mm_h:    toMm(raw.rain_rate_hi_in as number),
    // Solar
    radiacion_w_m2:      raw.solar_rad_avg ?? null,
    radiacion_max_w_m2:  raw.solar_rad_hi  ?? null,
    // ET y presion
    et_mm:               toMm(raw.et as number),
    barometro_inhg:      pick(raw, "bar", "bar_sea_level") ?? null,
    presion_abs_inhg:    raw.bar_absolute ?? null,
    // Grados dia
    grados_calefaccion:  raw.deg_days_heat ?? null,
    grados_enfriamiento: raw.deg_days_cool ?? null,
    sensor_type:         raw._sensor_type  ?? null,
  };
}

// ─── Dedupe by ts ────────────────────────────────────────────────────────────
// Una estación puede tener múltiples sensores que reportan el MISMO timestamp.
// El upsert con onConflict(station_id, ts) rechaza el batch si hay duplicados
// internos. Mergeamos las filas del mismo ts: para cada columna, prevalece el
// valor no-null (si ambos no-null, prevalece el primero).
function dedupeByTs(rows: Record<string,unknown>[]): Record<string,unknown>[] {
  const map = new Map<number, Record<string,unknown>>();
  for (const row of rows) {
    const ts = row.ts as number;
    const existing = map.get(ts);
    if (!existing) {
      map.set(ts, { ...row });
      continue;
    }
    // Merge: para cada campo, si el existing es null y el nuevo no, copiar.
    for (const [k, v] of Object.entries(row)) {
      if (v != null && existing[k] == null) {
        existing[k] = v;
      }
    }
  }
  return Array.from(map.values());
}

// ─── Fetch one day with 429 retry ─────────────────────────────────────────────
async function fetchDay(stationId: string, startTs: number, endTs: number): Promise<Record<string,unknown>[]> {
  const url = new URL(`${WL_BASE}/historic/${stationId}`);
  url.searchParams.set("api-key", API_KEY);
  url.searchParams.set("start-timestamp", String(startTs));
  url.searchParams.set("end-timestamp",   String(endTs));

  for (let attempt = 1; attempt <= 6; attempt++) {
    const resp = await fetch(url.toString(), { headers: { "X-Api-Secret": API_SEC } });

    if (resp.status === 429) {
      const ra   = resp.headers.get("Retry-After");
      const wait = ra ? Math.min(parseInt(ra)*1000, 90000) : Math.min(5000 * 2**(attempt-1), 90000);
      console.log(`429 rate limit — waiting ${wait/1000}s (attempt ${attempt}/6)`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!resp.ok) {
      const txt = await resp.text();
      let detail = txt;
      try { const p = JSON.parse(txt); detail = p.message ?? p.error ?? txt; } catch {}
      throw new Error(`WeatherLink ${resp.status}: ${detail}`);
    }

    const json    = await resp.json();
    const records: Record<string,unknown>[] = [];
    for (const sensor of json.sensors ?? []) {
      for (const rec of sensor.data ?? []) {
        records.push({ ...rec, _sensor_type: sensor.sensor_type });
      }
    }
    return records;
  }
  throw new Error("WeatherLink: max retries exceeded (429)");
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(SB_URL, SB_KEY);

  try {
    const body       = req.method === "POST" ? await req.json() : {};
    const qp         = new URL(req.url).searchParams;
    const stationId  = String(body.station_id  ?? qp.get("station_id")  ?? "");
    const stationName= String(body.station_name ?? qp.get("station_name") ?? stationId);
    const forceStart = body.start_date ?? qp.get("start_date") ?? null;
    const chunkDays  = Math.min(parseInt(String(body.chunk_days ?? "7")), 30);

    if (!stationId) throw new Error("Falta station_id");

    const { data: syncRow } = await supabase
      .from("sync_status")
      .select("last_ts, status")
      .eq("station_id", stationId)
      .maybeSingle();

    const nowTs    = Math.floor(Date.now() / 1000);
    const defaultStart = nowTs - 365 * 86400;
    let   syncFromTs   = forceStart
      ? Math.floor(new Date(forceStart).getTime() / 1000)
      : (syncRow?.last_ts ?? defaultStart);

    if (!forceStart && syncRow?.last_ts && (nowTs - syncRow.last_ts) < 900) {
      return new Response(JSON.stringify({
        ok: true, done: true, station_id: stationId,
        message: "Datos ya actualizados (ultima sync hace menos de 15 min)",
        last_ts: syncRow.last_ts,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    await supabase.from("sync_status").upsert({
      station_id:   stationId,
      station_name: stationName,
      status:       "syncing",
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "station_id" });

    const windowStart = syncFromTs;
    const windowEnd   = Math.min(syncFromTs + chunkDays * 86400, nowTs);
    const totalRemaining = Math.ceil((nowTs - syncFromTs) / 86400);
    const done = windowEnd >= nowTs;

    let cursor       = windowStart;
    let daysFetched  = 0;
    let recordsSaved = 0;
    let lastDataTs   = syncRow?.last_ts ?? 0;  // ts del ULTIMO registro real visto

    while (cursor < windowEnd) {
      const dayEnd = Math.min(cursor + 86400, windowEnd);
      const raw    = await fetchDay(stationId, cursor, dayEnd);
      const rows   = raw.map(r => normalize(r, stationId, stationName));
      // FIX: deduplicar por ts antes de upsert (evita el error
      // "ON CONFLICT DO UPDATE command cannot affect row a second time"
      // cuando multiples sensores reportan al mismo timestamp).
      const deduped = dedupeByTs(rows);

      if (deduped.length > 0) {
        const { error } = await supabase
          .from("weather_readings")
          .upsert(deduped, { onConflict: "station_id,ts" });
        if (error) throw new Error(`DB upsert error: ${error.message}`);
        recordsSaved += deduped.length;
        const maxTs = Math.max(...deduped.map(r => r.ts as number));
        if (maxTs > lastDataTs) lastDataTs = maxTs;
      }

      cursor = dayEnd;
      daysFetched++;
      await new Promise(r => setTimeout(r, daysFetched % 5 === 0 ? 1000 : 300));
    }

    // ── FIX v6: avanzar el cursor AUNQUE la ventana venga vacía ────────────────
    // Bug previo: last_ts solo subía al max ts de registros devueltos. Si una
    // estación tiene un hueco de datos en WeatherLink (estuvo offline un tiempo),
    // la ventana volvía vacía, last_ts no avanzaba y la siguiente corrida pedía
    // EXACTAMENTE la misma ventana vacía -> congelada para siempre en 'syncing'.
    // Ya escaneamos día por día hasta windowEnd sin error, así que es seguro
    // mover el cursor hasta windowEnd y cruzar el hueco. Las lecturas reales
    // siguen siendo veraces porque el front lee weather_readings, no este cursor.
    const cursorTs = Math.max(lastDataTs, windowEnd);

    const { count } = await supabase
      .from("weather_readings")
      .select("*", { count: "exact", head: true })
      .eq("station_id", stationId);

    await supabase.from("sync_status").upsert({
      station_id:    stationId,
      station_name:  stationName,
      last_ts:       cursorTs > 0 ? cursorTs : (syncRow?.last_ts ?? null),
      last_sync_at:  new Date().toISOString(),
      total_records: count ?? 0,
      status:        done ? "idle" : "syncing",
      error_msg:     null,
    }, { onConflict: "station_id" });

    const progressPct = totalRemaining > 0
      ? Math.min(Math.round((chunkDays / totalRemaining) * 100), 100)
      : 100;

    return new Response(JSON.stringify({
      ok:              true,
      done,
      station_id:      stationId,
      station_name:    stationName,
      days_fetched:    daysFetched,
      records_saved:   recordsSaved,
      total_in_db:     count ?? 0,
      last_data_ts:    lastDataTs,
      cursor_ts:       cursorTs,
      next_start_date: done ? null : new Date(windowEnd * 1000).toISOString().slice(0,10),
      progress_pct:    progressPct,
      days_remaining:  Math.max(totalRemaining - chunkDays, 0),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = (err as Error).message;
    try {
      const body = req.method === "POST" ? await req.clone().json() : {};
      if (body.station_id) {
        await supabase.from("sync_status").upsert({
          station_id: String(body.station_id),
          status:     "error",
          error_msg:  msg,
        }, { onConflict: "station_id" });
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: msg.includes("429") ? 429 : 400,
        headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
