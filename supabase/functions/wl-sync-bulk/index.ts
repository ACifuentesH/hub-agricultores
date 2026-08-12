import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WL_BASE = "https://api.weatherlink.com/v2";
const API_KEY = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SEC = Deno.env.get("WEATHERLINK_API_SECRET")!;

const fToC  = (f?: number|null) => f == null ? null : Math.round(((f-32)*5/9)*10)/10;
const toKmh = (v?: number|null) => v == null ? null : Math.round(v*1.60934*10)/10;
const toMm  = (v?: number|null) => v == null ? null : Math.round(v*25.4*100)/100;

function tsToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  const qp = new URL(req.url).searchParams;
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  const stationId = String(body.station_id ?? qp.get("station_id") ?? "");
  if (!stationId) return new Response(JSON.stringify({ ok: false, error: "Falta station_id" }), { status: 400 });

  const nowTs    = Math.floor(Date.now() / 1000);
  const startTs  = Math.floor(new Date(body.inicio ?? qp.get("inicio") ?? "2024-01-01").getTime() / 1000);

  // Acumular registros de todos los dias, dia por dia
  const byDate: Record<string, Record<string, number[]>> = {};

  let cursor = startTs;
  while (cursor < nowTs) {
    const dayEnd = Math.min(cursor + 86400, nowTs);
    const url = new URL(`${WL_BASE}/historic/${stationId}`);
    url.searchParams.set("api-key", API_KEY);
    url.searchParams.set("start-timestamp", String(cursor));
    url.searchParams.set("end-timestamp", String(dayEnd));

    const resp = await fetch(url.toString(), { headers: { "X-Api-Secret": API_SEC } });
    if (resp.ok) {
      const json = await resp.json();
      for (const sensor of json.sensors ?? []) {
        for (const rec of sensor.data ?? []) {
          const fecha = tsToDate(rec.ts);
          if (!byDate[fecha]) byDate[fecha] = {};
          const d = byDate[fecha];
          const push = (k: string, v: number|null|undefined) => { if (v != null) { if (!d[k]) d[k] = []; d[k].push(v); } };
          push("temp_c",        fToC(rec.temp_out));
          push("temp_max_c",    fToC(rec.temp_out_hi));
          push("temp_min_c",    fToC(rec.temp_out_lo));
          push("hum_pct",       rec.hum_out);
          push("punto_rocio_c", fToC(rec.dew_point_out));
          push("viento_avg_kmh",toKmh(rec.wind_speed_avg));
          push("viento_max_kmh",toKmh(rec.wind_speed_hi));
          push("lluvia_mm",     toMm(rec.rainfall_in));
          push("rad_w_m2",      rec.solar_rad_avg);
          push("et_mm",         toMm(rec.et));
          push("presion_inhg",  rec.bar);
        }
      }
    }
    cursor = dayEnd;
    await new Promise(r => setTimeout(r, 300));
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10 : null;
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : null;
  const min = (arr: number[]) => arr.length ? Math.min(...arr) : null;
  const sum = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)*100)/100 : null;

  const result = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([fecha, d]) => ({
    fecha,
    temp_avg_c:    avg(d.temp_c    ?? []),
    temp_max_c:    max(d.temp_max_c ?? []),
    temp_min_c:    min(d.temp_min_c ?? []),
    hum_avg_pct:   avg(d.hum_pct   ?? []),
    punto_rocio_c: avg(d.punto_rocio_c ?? []),
    viento_avg_kmh:avg(d.viento_avg_kmh ?? []),
    viento_max_kmh:max(d.viento_max_kmh ?? []),
    lluvia_mm:     sum(d.lluvia_mm ?? []),
    rad_avg_w_m2:  avg(d.rad_w_m2  ?? []),
    et_mm:         sum(d.et_mm     ?? []),
    presion_inhg:  avg(d.presion_inhg ?? []),
  }));

  return new Response(JSON.stringify({ ok: true, station_id: stationId, dias: result.length, data: result }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
