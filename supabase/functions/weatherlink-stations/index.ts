import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WEATHERLINK_BASE = "https://api.weatherlink.com/v2";
const API_KEY    = Deno.env.get("WEATHERLINK_API_KEY")!;
const API_SECRET = Deno.env.get("WEATHERLINK_API_SECRET")!;

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(`${WEATHERLINK_BASE}/stations`);
    url.searchParams.set("api-key", API_KEY);

    const resp = await fetch(url.toString(), {
      headers: { "X-Api-Secret": API_SECRET },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`WeatherLink ${resp.status}: ${errText}`);
    }

    const json = await resp.json();

    // Extraer solo los campos utiles de cada estacion
    const stations = (json.stations ?? []).map((s: Record<string, unknown>) => ({
      station_id:        s.station_id,
      station_id_uuid:   s.station_id_uuid,
      station_name:      s.station_name,
      city:              s.city ?? null,
      region:            s.region ?? null,
      country:           s.country ?? null,
      latitude:          s.latitude ?? null,
      longitude:         s.longitude ?? null,
      elevation:         s.elevation ?? null,
      time_zone:         s.time_zone_id ?? null,
      product_number:    s.product_number ?? null,
      active:            s.active ?? null,
    }));

    return new Response(
      JSON.stringify({
        ok:    true,
        total: stations.length,
        stations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
