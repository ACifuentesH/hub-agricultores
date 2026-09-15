import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Batería del transmisor (ISS) y señal wifi de la consola (WeatherLink Live)
 * por estación, vía /v2/current/{station_id}. Confirmado contra el payload
 * real: sensor_type 53 (ISS) trae trans_battery_flag/rx_state, sensor_type
 * 504 (consola) trae wifi_rssi/link_uptime — no siempre está el sensor 504
 * (estaciones viejas sin WeatherLink Live no tienen wifi que reportar).
 */

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

interface SensorDatum {
  wifi_rssi?: number | null;
  link_uptime?: number | null;
  trans_battery_flag?: number | null;
  rx_state?: number | null;
}

// El parque tiene consolas de distinta generación y NO todas hablan el mismo
// idioma para wifi/batería. Confirmado contra el payload real:
//   - sensor_type 53  (ISS)               -> trans_battery_flag, rx_state
//   - sensor_type 504 (WeatherLink Live)   -> wifi_rssi en dBm real (negativo)
//   - sensor_type 505 (EnviroMonitor node) -> también trae un campo llamado
//     wifi_rssi, pero con OTRA escala (visto: 98, positivo) y link_uptime
//     negativo (-93) -- no es dBm, mezclarlo con el de 504 da un numero sin
//     sentido. Mientras no se entienda esa escala, esas estaciones quedan
//     sin dato de wifi en vez de mostrar algo inventado.
const SENSOR_ISS = 53;
const SENSOR_CONSOLA_WIFI = 504;

function rssiValido(v: number | null): number | null {
  // dBm real de wifi: siempre negativo, en la práctica entre -100 y -20.
  if (v === null) return null;
  return v < 0 && v >= -100 ? v : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(SB_URL, SB_KEY);

  const { data: estaciones, error: listErr } = await supabase
    .from("estaciones")
    .select("codigo_estacion, station_id")
    .eq("activa", true);

  if (listErr) {
    return new Response(JSON.stringify({ ok: false, error: listErr.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let sincronizadas = 0;
  const fallidas: { codigo_estacion: string; error: string }[] = [];

  for (const e of estaciones ?? []) {
    try {
      const url = new URL(`${WL_BASE}/current/${e.station_id}`);
      url.searchParams.set("api-key", API_KEY);
      const resp = await fetch(url, { headers: { "X-Api-Secret": API_SEC } });
      if (!resp.ok) throw new Error(`WeatherLink ${resp.status}`);
      const json = await resp.json();

      let wifiRssi: number | null = null;
      let linkUptime: number | null = null;
      let transBatteryFlag: number | null = null;
      let rxState: number | null = null;

      for (const sensor of json.sensors ?? []) {
        const tipo = sensor.sensor_type as number;
        for (const d of (sensor.data ?? []) as SensorDatum[]) {
          if (tipo === SENSOR_ISS) {
            if (d.trans_battery_flag !== undefined && d.trans_battery_flag !== null) transBatteryFlag = d.trans_battery_flag;
            if (d.rx_state !== undefined && d.rx_state !== null) rxState = d.rx_state;
          }
          if (tipo === SENSOR_CONSOLA_WIFI) {
            if (d.wifi_rssi !== undefined) wifiRssi = rssiValido(d.wifi_rssi ?? null);
            if (d.link_uptime !== undefined && d.link_uptime !== null && d.link_uptime >= 0) linkUptime = d.link_uptime;
          }
        }
      }

      const { error } = await supabase.from("estaciones_salud").upsert({
        codigo_estacion: e.codigo_estacion,
        wifi_rssi: wifiRssi,
        trans_battery_flag: transBatteryFlag,
        rx_state: rxState,
        link_uptime_s: linkUptime,
        synced_at: new Date().toISOString(),
      }, { onConflict: "codigo_estacion" });
      if (error) throw new Error(error.message);

      sincronizadas++;
    } catch (err) {
      fallidas.push({ codigo_estacion: e.codigo_estacion, error: (err as Error).message });
    }
    // Pacing suave para no saturar la API de WeatherLink.
    await new Promise((r) => setTimeout(r, 150));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      total: estaciones?.length ?? 0,
      sincronizadas,
      fallidas_count: fallidas.length,
      fallidas: fallidas.slice(0, 10),
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
