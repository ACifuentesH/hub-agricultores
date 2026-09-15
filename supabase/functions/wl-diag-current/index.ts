import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Diagnostico temporal: inspecciona el payload crudo de /v2/current/{id}
// para ver que campos de bateria/wifi trae WeatherLink realmente.
const WL_BASE = "https://api.weatherlink.com/v2";
const API_KEY = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SEC = Deno.env.get("WEATHERLINK_API_SECRET")!;

Deno.serve(async (req) => {
  const qp = new URL(req.url).searchParams;
  const stationId = qp.get("station_id");
  if (!stationId) return new Response(JSON.stringify({ error: "falta station_id" }), { status: 400 });

  const url = new URL(`${WL_BASE}/current/${stationId}`);
  url.searchParams.set("api-key", API_KEY);
  const resp = await fetch(url, { headers: { "X-Api-Secret": API_SEC } });
  const json = await resp.json();
  return new Response(JSON.stringify(json, null, 2), {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
});
