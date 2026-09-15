import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Trae dos cosas del servicio "grAIn" (estimaciones-export, proyecto
 * nwouogywyofnvxsgjttd) y las guarda en tablas separadas, a propósito:
 *
 * 1) cosecha_lote -> public.rendimiento_real — REAL (cosecha ya pesada).
 * 2) resumen -> public.fase_estimacion_grain — fase medida por el técnico
 *    (estado_fenologico_texto, ej. "R4") vía las planillas de estimación de
 *    rendimiento. Es estructurado (no hay que parsear texto libre como con
 *    actividades_registro) pero su propio rendimiento_kg_ha es un ESTIMADO
 *    (método PMG, recalculado por grAIn) — NUNCA se guarda en
 *    rendimiento_real ni se muestra como si fuera cosecha real. Ver el
 *    recurso=info: "ESTIMADO — rendimiento_kg_ha es el valor recalculado
 *    por grAIn" vs "REAL — cosecha_lote".
 *
 * La API key vive solo como secreto de Edge Functions
 * (GRAIN_ESTIMACIONES_API_KEY) — nunca en el repo ni en .env.
 *
 * Reglas de calidad de dato en cosecha_lote, documentadas por el usuario
 * ("aprendidas a las malas" en este proyecto):
 *   - toneladas 0/null => el lote no tiene cosecha cargada todavía. Es
 *     "sin dato", NO "rendimiento cero" — se guarda como null, no como 0.
 *   - grAIn expone el dato crudo, sin conciliar contra SAP. Un
 *     rendimiento_kg_ha por encima de ~12.000 kg/ha (12 t/ha, tope realista
 *     para maíz) es sospechoso (caso real visto: 238 t/ha por una guía mal
 *     capturada) — se guarda pero marcado `rendimiento_sospechoso = true`.
 *
 * Sin body: descubre el ciclo activo vía recurso=info y trae ambos recursos
 * completos (pagina de a 2000, el máximo que acepta el endpoint).
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

interface ResumenRow {
  estimacion_id: string;
  lote_id: string;
  unidad_produccion_id?: string;
  lote_texto?: string;
  hibrido_texto?: string;
  estado_fenologico_texto?: string | null;
  fecha_evaluacion?: string | null;
  tecnico_correo?: string | null;
  archivo_codigo_up?: string | null;
  archivo_agricultor?: string | null;
  superficie_ha?: number | string | null;
  muestras_validas?: number | string | null;
  mazorcas_promedio?: number | string | null;
  granos_promedio?: number | string | null;
  pmg_promedio?: number | string | null;
  rendimiento_kg_ha?: number | string | null; // ESTIMADO — no confundir con rendimiento_real
  produccion_estimada_t?: number | string | null;
  cargado_at?: string | null;
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

async function grainFetchAll<T>(recurso: string, ciclo: string): Promise<T[]> {
  const filas: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await grainFetch({ recurso, ciclo, limit: String(PAGE_SIZE), offset: String(offset) });
    const rows: T[] = Array.isArray(page) ? page : (page as { data?: T[] }).data ?? [];
    filas.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return filas;
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

  let body: { ciclo?: string; debugRecurso?: string; debugParams?: Record<string, string> } = {};
  try {
    body = await req.json();
  } catch {
    // sin body — descubrir el ciclo activo
  }

  // Modo diagnóstico: devuelve la respuesta cruda de grAIn sin tocar la
  // base, para explorar recursos que todavía no se ingieren.
  if (body.debugRecurso) {
    try {
      const data = await grainFetch({ recurso: body.debugRecurso, ...(body.debugParams ?? {}) });
      return new Response(JSON.stringify({ ok: true, recurso: body.debugRecurso, data }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
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

  // ── 1) cosecha_lote -> rendimiento_real (REAL) ──────────────────────────
  const cosechaFilas = await grainFetchAll<CosechaLoteRow>("cosecha_lote", ciclo);

  let sospechosos = 0;
  let sinCosecha = 0;

  for (let i = 0; i < cosechaFilas.length; i += 500) {
    const lote = cosechaFilas.slice(i, i + 500).map((r) => {
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
        JSON.stringify({ ok: false, etapa: "rendimiento_real", error: error.message, procesados: i }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
  }

  // ── 2) resumen -> fase_estimacion_grain (fase estructurada, la más
  //      reciente evaluación por lote) ─────────────────────────────────────
  const resumenFilas = await grainFetchAll<ResumenRow>("resumen", ciclo);

  // fecha_evaluacion es la que escribe el técnico a mano en la planilla —
  // puede tener errores de tipeo. Caso real visto: "El galpón" (Y01) con
  // fecha_evaluacion 2026-09-26, 11 días DESPUÉS de que el archivo se subió
  // (cargado_at 2026-09-07). Un técnico no puede evaluar un lote antes de
  // subir el archivo con esa evaluación, así que si fecha_evaluacion es
  // posterior a cargado_at, la fecha está mal — se usa cargado_at en su
  // lugar (dato duro: sabemos con certeza cuándo se subió el archivo).
  function fechaEvaluacionValida(r: ResumenRow): string | null {
    const evalD = r.fecha_evaluacion ? new Date(r.fecha_evaluacion) : null;
    const cargaD = r.cargado_at ? new Date(r.cargado_at) : null;
    if (evalD && cargaD && evalD.getTime() > cargaD.getTime()) {
      return cargaD.toISOString().slice(0, 10);
    }
    return r.fecha_evaluacion ?? (cargaD ? cargaD.toISOString().slice(0, 10) : null);
  }

  // Quedarnos con la evaluación más reciente por lote (puede haber varias
  // cargas del mismo lote a lo largo del ciclo), ya con la fecha corregida.
  const masRecientePorLote = new Map<string, ResumenRow & { _fechaValida: string | null }>();
  for (const r0 of resumenFilas) {
    if (!r0.lote_id) continue;
    const r = { ...r0, _fechaValida: fechaEvaluacionValida(r0) };
    const prev = masRecientePorLote.get(r.lote_id);
    if (!prev || (r._fechaValida ?? "") > (prev._fechaValida ?? "")) {
      masRecientePorLote.set(r.lote_id, r);
    }
  }
  const resumenUnicos = [...masRecientePorLote.values()];

  for (let i = 0; i < resumenUnicos.length; i += 500) {
    const lote = resumenUnicos.slice(i, i + 500).map((r) => ({
      lote_id_raw: r.lote_id,
      ciclo,
      estimacion_id: r.estimacion_id,
      lote_texto: r.lote_texto ?? null,
      hibrido_texto: r.hibrido_texto ?? null,
      estado_fenologico_texto: r.estado_fenologico_texto ?? null,
      fecha_evaluacion: r._fechaValida,
      tecnico_correo: r.tecnico_correo ?? null,
      codigo_up: r.archivo_codigo_up ?? null,
      nombre_agricultor: r.archivo_agricultor ?? null,
      superficie_ha: num(r.superficie_ha),
      muestras_validas: num(r.muestras_validas),
      mazorcas_promedio: num(r.mazorcas_promedio),
      granos_promedio: num(r.granos_promedio),
      pmg_promedio: num(r.pmg_promedio),
      rendimiento_estimado_kg_ha: num(r.rendimiento_kg_ha),
      produccion_estimada_t: num(r.produccion_estimada_t),
      cargado_at_origen: r.cargado_at ?? null,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("fase_estimacion_grain").upsert(lote, { onConflict: "lote_id_raw" });
    if (error) {
      return new Response(
        JSON.stringify({ ok: false, etapa: "fase_estimacion_grain", error: error.message, procesados: i }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
  }

  // Encadenar el refresco de derivados acá (no en el cron con un pg_sleep de
  // por medio) para que avance_pct/fase/rendimiento_kg_ha queden al día
  // apenas termina esta sincronización, igual que saturno-sync con
  // promover:true.
  const { error: refrescarErr } = await supabase.rpc("saturno_refrescar_derivados");

  return new Response(
    JSON.stringify({
      ok: true,
      ciclo,
      cosecha_lote: { total: cosechaFilas.length, sin_cosecha_aun: sinCosecha, rendimiento_sospechoso: sospechosos },
      resumen: { total: resumenFilas.length, lotes_distintos: resumenUnicos.length },
      derivados_refrescados: !refrescarErr,
      error_refrescar: refrescarErr?.message,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
