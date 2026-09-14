import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Trae el rendimiento REAL por lote desde el servicio "grAIn"
 * (proyecto nwouogywyofnvxsgjttd, función estimaciones-export) y lo guarda en
 * public.rendimiento_real. La API key vive solo como secreto de Edge
 * Functions (GRAIN_ESTIMACIONES_API_KEY) — nunca en el repo ni en .env.
 *
 * Reglas de calidad de dato, tal como las documentó el usuario (aprendidas
 * "a las malas" en este mismo proyecto):
 *   - toneladas 0/null => el lote no tiene cosecha cargada todavía. Es
 *     "sin dato", NO "rendimiento cero" — se guarda como null, no como 0.
 *   - grAIn expone el dato crudo, sin conciliar contra SAP. Un
 *     rendimiento_kg_ha por encima de ~12.000 kg/ha (12 t/ha, tope realista
 *     para maíz) es sospechoso (caso real visto: 238 t/ha por una guía mal
 *     capturada) — se guarda pero marcado `rendimiento_sospechoso = true`,
 *     para que el front lo pueda ocultar en vez de mostrar un disparate.
 *
 * Sin body: descubre el ciclo activo vía recurso=info y trae cosecha_lote
 * completo (pagina de a 2000, el máximo que acepta el endpoint).
 */

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAIN_KEY = Deno.env.get("GRAIN_ESTIMACIONES_API_KEY")!;
const GRAIN_BASE = "https://nwouogywyofnvxsgjttd.supabase.co/functions/v1/estimaciones-export";
const RENDIMIENTO_SOSPECHOSO_KG_HA = 12000;
const PAGE_SIZE = 2000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

interface CosechaLoteRow {
  codigo_lote?: string;
  nombre_lote?: string;
  lote_id: string;
  up_code?: string;
  unidad_produccion_id?: string;
  nombre_finca?: string;
  nombre_agricultor?: string;
  up_estado?: string;
  ha_sembradas?: number | string | null;
  numero_ha?: number | string | null;
  ha_cosechadas?: number | string | null;
  avance_ha_pct?: number | string | null;
  toneladas?: number | string | null;
  rendimiento_kg_ha?: number | string | null;
  registros_cosecha?: number | string | null;
  guias?: number | string | null;
  guias_cosecha?: number | string | null;
  humedad_promedio?: number | string | null;
  actualizado_at?: string | null;
}

async function grainFetch(params: Record<string, string>) {
  const url = new URL(GRAIN_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "x-api-key": GRAIN_KEY } });
  if (!res.ok) {
    throw new Error(`grAIn ${url.pathname}${url.search} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (!GRAIN_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "GRAIN_ESTIMACIONES_API_KEY no está configurado como secreto de Edge Functions" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SB_URL, SB_KEY);

  let body: { ciclo?: string } = {};
  try {
    body = await req.json();
  } catch {
    // sin body — descubrir el ciclo activo
  }

  let ciclo = body.ciclo ?? null;
  let info: unknown = null;
  if (!ciclo) {
    try {
      info = await grainFetch({ recurso: "info" });
      ciclo = (info as { ciclo_activo?: string })?.ciclo_activo ?? null;
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: `No se pudo leer recurso=info: ${(e as Error).message}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
  }
  if (!ciclo) {
    return new Response(
      JSON.stringify({ ok: false, error: "No se pudo determinar el ciclo activo", info }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const filas: CosechaLoteRow[] = [];
  let offset = 0;
  for (;;) {
    const page = await grainFetch({
      recurso: "cosecha_lote",
      ciclo,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const rows: CosechaLoteRow[] = Array.isArray(page) ? page : (page as { data?: CosechaLoteRow[] }).data ?? [];
    filas.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  let sospechosos = 0;
  let sinCosecha = 0;

  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500).map((r) => {
      const toneladas = num(r.toneladas);
      const tieneToneladas = toneladas !== null && toneladas > 0;
      if (!tieneToneladas) sinCosecha++;
      const rendKgHa = tieneToneladas ? num(r.rendimiento_kg_ha) : null;
      const sospechoso = rendKgHa !== null && rendKgHa > RENDIMIENTO_SOSPECHOSO_KG_HA;
      if (sospechoso) sospechosos++;
      return {
        lote_id_raw: r.lote_id,
        ciclo,
        codigo_lote: r.codigo_lote ?? null,
        nombre_lote: r.nombre_lote ?? null,
        up_code: r.up_code ?? null,
        unidad_produccion_id: r.unidad_produccion_id ?? null,
        nombre_finca: r.nombre_finca ?? null,
        nombre_agricultor: r.nombre_agricultor ?? null,
        up_estado: r.up_estado ?? null,
        ha_sembradas: num(r.ha_sembradas),
        numero_ha: num(r.numero_ha),
        ha_cosechadas: tieneToneladas ? num(r.ha_cosechadas) : null,
        avance_ha_pct: tieneToneladas ? num(r.avance_ha_pct) : null,
        toneladas,
        rendimiento_kg_ha: rendKgHa,
        rendimiento_sospechoso: sospechoso,
        registros_cosecha: num(r.registros_cosecha),
        humedad_promedio: num(r.humedad_promedio),
        actualizado_at_origen: r.actualizado_at ?? null,
        synced_at: new Date().toISOString(),
      };
    });
    const { error } = await supabase.from("rendimiento_real").upsert(lote, { onConflict: "lote_id_raw" });
    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message, procesados: i }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
  }

  // Encadenar el refresco de derivados acá (no en el cron con un pg_sleep de
  // por medio) para que avance_pct/rendimiento_kg_ha queden al día apenas
  // termina esta sincronización, igual que saturno-sync con promover:true.
  const { error: refrescarErr } = await supabase.rpc("saturno_refrescar_derivados");

  return new Response(
    JSON.stringify({
      ok: true,
      ciclo,
      total: filas.length,
      sin_cosecha_aun: sinCosecha,
      rendimiento_sospechoso: sospechosos,
      derivados_refrescados: !refrescarErr,
      error_refrescar: refrescarErr?.message,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
