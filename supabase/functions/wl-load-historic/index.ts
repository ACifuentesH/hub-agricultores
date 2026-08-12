import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WL_BASE = "https://api.weatherlink.com/v2";
const API_KEY = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SEC = Deno.env.get("WEATHERLINK_API_SECRET")!;
const SB_URL  = Deno.env.get("SUPABASE_URL")!;
const SB_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// NOTA DE MIGRACIÓN: este mapa está desactualizado respecto al catálogo real
// (44 estaciones en `estaciones_davis`, ver docs/INTEGRACION_WEATHERLINK.md).
// Antes de redeployar en el proyecto organizacional, regenerarlo desde
// `select station_id, station_name from sync_status order by station_name;`
const STATIONS: Record<string,string> = {
  "184921": "P01-Pajones-Saturno",
  "184965": "P02-Cojedito-Saturno",
  "185450": "G01-San Geronimo-Saturno",
  "186361": "G03-Memo-Saturno",
  "186669": "G02-Los Espinitos-Saturno",
  "186730": "G04-Las Mercedes-Saturno",
  "187561": "P04-Chaconera-Saturno",
  "197214": "Y01-Danac-Saturno",
  "200814": "P03-Queseras-Saturno",
  "212477": "P05-Santa Cruz-Saturno",
  "212516": "P06-Esteros de Canoita-Saturno",
  "212533": "P07-Turen-Saturno",
  "212609": "P08-Turen La Colonia-Saturno",
  "212641": "P09-Chorrerones-Saturno",
  "212695": "P10-Turen Las Cupulas-Saturno",
  "212723": "P11-La Ensenada-Saturno",
  "212761": "C01-Las Majaguas-Saturno",
  "213450": "P12-Rio Acarigua-Saturno",
  "213617": "G06-Mahomal-Saturno",
  "213735": "G05-La Penita-Saturno",
  "215150": "P14-El Palmar-Saturno",
  "216784": "EXPP1-Don Tomas-Saturno",
  "217402": "G08-El Caro-Saturno",
  "217861": "EXPP02-Parcela 392-Saturno",
  "218046": "EXPY02-La Vega-Saturno",
  "218876": "EXPG01-Mahomito-Saturno",
  "220773": "G07-El Apamate-Saturno",
  "235597": "Y04-La Vaquera-Saturno",
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

function normalize(raw: Record<string,unknown>, sid: string, sname: string) {
  return {
    station_id:          sid,
    station_name:        sname,
    ts:                  raw.ts,
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

async function fetchDay(sid: string, s: number, e: number): Promise<Record<string,unknown>[]> {
  const url = new URL(`${WL_BASE}/historic/${sid}`);
  url.searchParams.set("api-key", API_KEY);
  url.searchParams.set("start-timestamp", String(s));
  url.searchParams.set("end-timestamp",   String(e));
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(url.toString(), { headers: { "X-Api-Secret": API_SEC } });
    if (r.status === 429) { await new Promise(x => setTimeout(x, Math.min(5000*2**(i-1), 60000))); continue; }
    if (!r.ok) return [];
    const j = await r.json();
    const out: Record<string,unknown>[] = [];
    for (const sensor of j.sensors ?? []) for (const rec of sensor.data ?? []) out.push(rec);
    return out;
  }
  return [];
}

async function upsertRows(rows: Record<string,unknown>[]): Promise<number> {
  const r = await fetch(`${SB_URL}/rest/v1/weather_readings?on_conflict=station_id,ts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Prefer": "resolution=merge-duplicates,return=representation,count=exact",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`DB upsert: ${await r.text()}`);
  const result = await r.json();
  return Array.isArray(result) ? result.length : 0;
}

async function updateQueue(sid: string, year: number, month: number, status: string, saved: number, errorMsg?: string) {
  await fetch(`${SB_URL}/rest/v1/load_historic_queue?station_id=eq.${sid}&year=eq.${year}&month=eq.${month}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` },
    body: JSON.stringify({ status, saved, error_msg: errorMsg ?? null, processed_at: new Date().toISOString() }),
  });
}

Deno.serve(async (req: Request) => {
  let sid = ""; let year = 0; let month = 0;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    sid   = String(body.station_id ?? "");
    year  = parseInt(String(body.year  ?? new Date().getUTCFullYear()));
    month = parseInt(String(body.month ?? 0));

    if (!sid)           return new Response(JSON.stringify({ ok: false, error: "Falta station_id" }), { status: 400 });
    if (!STATIONS[sid]) return new Response(JSON.stringify({ ok: false, error: `station_id ${sid} no reconocido` }), { status: 400 });

    const sname = STATIONS[sid];
    const nowTs = Math.floor(Date.now() / 1000);
    const startTs = month > 0
      ? Math.floor(new Date(`${year}-${String(month).padStart(2,"0")}-01T00:00:00Z`).getTime() / 1000)
      : Math.floor(new Date(`${year}-01-01T00:00:00Z`).getTime() / 1000);
    const endTs = month > 0
      ? Math.min(Math.floor(new Date(Date.UTC(year, month, 1)).getTime() / 1000), nowTs)
      : Math.min(Math.floor(new Date(`${year+1}-01-01T00:00:00Z`).getTime() / 1000), nowTs);

    const windows: [number,number][] = [];
    let cursor = startTs;
    while (cursor < endTs) { windows.push([cursor, Math.min(cursor + 86400, endTs)]); cursor += 86400; }

    let saved = 0;
    for (let i = 0; i < windows.length; i += 4) {
      const batch = windows.slice(i, i + 4);
      const results = await Promise.all(batch.map(([s,e]) => fetchDay(sid, s, e)));
      const allRecs: Record<string,unknown>[] = [];
      for (const recs of results) allRecs.push(...recs);
      const merged = mergeByTs(allRecs);
      const rows = Object.values(merged).map(r => normalize(r, sid, sname));
      if (rows.length > 0) saved += await upsertRows(rows);
      await new Promise(r => setTimeout(r, 100));
    }

    await updateQueue(sid, year, month, "done", saved);
    return new Response(JSON.stringify({ ok: true, station_id: sid, station_name: sname, year, month, saved }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch(e) {
    const msg = (e as Error).message;
    console.error("ERROR:", msg);
    if (sid && year && month) await updateQueue(sid, year, month, "error", 0, msg).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
