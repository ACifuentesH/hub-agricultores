import { createClient } from './supabase/server'

/**
 * Capa de datos del módulo de seguimiento de lluvia por lote.
 *
 * En el proyecto de la empresa las vistas ya fueron reconstruidas para usar
 * `agricultor_id` (uuid de `public.agricultores`) directo — a diferencia del
 * proyecto de producción original, acá NO existe `agricultor_lluvia_map`
 * (tabla puente vieja, 404 confirmado): `resolveAgricultorLluviaId()` es
 * ahora un passthrough, no una resolución real. Se conserva la función (y su
 * nombre) porque `clima/page.tsx` la sigue llamando así.
 *
 * `vista_seguimiento_lluvia` es la única vista del módulo que no expone
 * `zona` (verificado contra el schema real) — `attachZona()` la resuelve
 * desde `estaciones.zona` por `codigo_estacion`, no desde
 * `lotes_seguimiento_lluvia` (esa tabla tampoco existe ya en este proyecto).
 * Las funciones "solo master" tienen nombres separados a propósito y sin
 * filtro por defecto, para que sea estructuralmente difícil llamarlas por
 * error desde un flujo de agricultor.
 */

export interface LoteSeguimientoRow {
  id: string
  agricultor_id: string | null
  agricultor: string | null
  unidad_produccion: string | null
  lote: string | null
  ha_a_cosechar: number | null
  codigo_estacion: string | null
  station_id: string | null
  fecha_inicio_siembra: string | null
  dias_inicio_post_siembra: number | null
  duracion_dias: number | null
  meta_lluvia_mm: number | null
  fecha_inicio_rango: string | null
  fecha_fin_rango: string | null
  dias_transcurridos: number | null
  lluvia_acumulada_mm: number | null
  pct_completacion: number | null
  racha_actual_dias_secos: number | null
  racha_maxima_dias_secos: number | null
  umbral_dia_seco_mm: number | null
  zona: string | null
}

export interface LluviaDiariaLoteRow {
  lote_id: string
  agricultor_id: string | null
  agricultor: string | null
  unidad_produccion: string | null
  lote: string | null
  station_id: string | null
  dia: string
  dia_del_periodo: number | null
  lluvia_mm: number | null
  lluvia_acumulada_mm: number | null
}

export interface LluviaMensualLoteRow {
  lote_id: string
  agricultor: string | null
  unidad_produccion: string | null
  lote: string | null
  zona: string | null
  station_id: string | null
  mes: string
  mes_label: string
  lluvia_mm_mes: number | null
  pct_mes_dentro_del_periodo: number | null
  mes_dentro_del_periodo: boolean | null
}

export interface LluviaMensualZonaRow {
  zona: string
  mes: string
  mes_label: string
  estaciones_incluidas: number | null
  lluvia_mm_promedio: number | null
  lluvia_mm_minimo: number | null
  lluvia_mm_maximo: number | null
}

export interface LluviaDiariaEstacionRow {
  station_id: string
  codigo_estacion: string | null
  zona: string | null
  dia: string
  anio: number
  mes_label: string
  lluvia_mm: number | null
  lecturas: number | null
  lluvia_acumulada_anual_mm: number | null
}

export interface PrediccionLluviaZonaRow {
  zona: string
  mes: number
  anio: number
  historico: number | null
  valor_real: number | null
  n_estaciones_reportando: number | null
  valor: number
  es_pronostico: boolean
  metodo_usado: string
  factor_usado: number | null
}

export interface PrediccionLluviaLoteRow {
  lote_id: string
  unidad_produccion: string | null
  lote: string | null
  agricultor_id: string | null
  agricultor: string | null
  zona: string | null
  station_id: string | null
  codigo_estacion: string | null
  mes: number
  anio: number
  historico: number | null
  valor_real: number | null
  dias_con_dato: number | null
  valor: number
  es_pronostico: boolean
  es_mes_excluido_por_calidad: boolean
  metodo_usado: string
  factor_usado: number | null
  fuente_tipo: string
  fuente_station_id: string | null
  fuente_distancia_km: number | null
}

export interface LluviaDistribucionNormalRow {
  anio: number
  n_muestras: number | null
  media: number | null
  desv_estandar: number | null
  x: number
  densidad_probabilidad: number | null
}

/**
 * Antes resolvía agricultor_key → agricultor_lluvia_id vía una tabla puente.
 * En este proyecto las vistas de lluvia ya usan `agricultores.agricultor_id`
 * directo, así que no hay nada que resolver — passthrough.
 */
export async function resolveAgricultorLluviaId(agricultorId: string): Promise<string | null> {
  return agricultorId || null
}

/** Lotes en seguimiento de UN agricultor (ya resuelto a agricultor_lluvia_id). */
export async function getLotesDeAgricultor(agricultorLluviaId: string): Promise<LoteSeguimientoRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_seguimiento_lluvia')
    .select('*')
    .eq('agricultor_id', agricultorLluviaId)
    .order('lote')
  return attachZona(supabase, (data ?? []) as LoteSeguimientoRow[])
}

/**
 * `vista_seguimiento_lluvia` NO expone `zona` (confirmado contra el schema
 * real — a diferencia de todas las demás vistas de este módulo, que sí la
 * traen). Se resuelve acá desde `estaciones.zona` por `codigo_estacion`, que
 * la vista sí trae.
 */
async function attachZona(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lotes: LoteSeguimientoRow[],
): Promise<LoteSeguimientoRow[]> {
  if (lotes.length === 0) return lotes
  const codigos = Array.from(new Set(lotes.map(l => l.codigo_estacion).filter((c): c is string => !!c)))
  if (codigos.length === 0) return lotes
  const { data: estaciones } = await supabase
    .from('estaciones')
    .select('codigo_estacion, zona')
    .in('codigo_estacion', codigos)
  const zonaPorCodigo = new Map((estaciones ?? []).map(e => [e.codigo_estacion as string, e.zona as string | null]))
  return lotes.map(l => ({ ...l, zona: l.codigo_estacion ? (zonaPorCodigo.get(l.codigo_estacion) ?? null) : null }))
}

/** Serie diaria (día del periodo propio de cada lote) para un conjunto de lotes ya resueltos. */
export async function getLluviaDiariaPorLotes(loteIds: string[]): Promise<LluviaDiariaLoteRow[]> {
  if (loteIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_lluvia_diaria_lote')
    .select('*')
    .in('lote_id', loteIds)
    .order('dia')
  return (data ?? []) as LluviaDiariaLoteRow[]
}

/** Histórico mensual completo (no acotado al periodo del lote) para un conjunto de lotes. */
export async function getLluviaMensualPorLotes(loteIds: string[]): Promise<LluviaMensualLoteRow[]> {
  if (loteIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_lluvia_mensual_lote')
    .select('*')
    .in('lote_id', loteIds)
    .order('mes')
  return (data ?? []) as LluviaMensualLoteRow[]
}

/** Pronóstico adaptativo por lote/mes del año actual, para un conjunto de lotes. */
export async function getPrediccionPorLotes(loteIds: string[]): Promise<PrediccionLluviaLoteRow[]> {
  if (loteIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_prediccion_lluvia_lote')
    .select('*')
    .in('lote_id', loteIds)
    .order('mes')
  return (data ?? []) as PrediccionLluviaLoteRow[]
}

export async function getLluviaMensualZona(zona: string): Promise<LluviaMensualZonaRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_lluvia_mensual_zona')
    .select('*')
    .eq('zona', zona)
    .order('mes')
  return (data ?? []) as LluviaMensualZonaRow[]
}

export async function getPrediccionZona(zona: string): Promise<PrediccionLluviaZonaRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_prediccion_lluvia_zona')
    .select('*')
    .eq('zona', zona)
    .order('mes')
  return (data ?? []) as PrediccionLluviaZonaRow[]
}

export async function getLluviaDiariaEstacionPorZona(zona: string): Promise<LluviaDiariaEstacionRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_lluvia_diaria_estacion')
    .select('*')
    .eq('zona', zona)
    .order('dia')
  return (data ?? []) as LluviaDiariaEstacionRow[]
}

/**
 * Lluvia diaria de las estaciones de un conjunto de lotes (multi-año, a
 * diferencia de `getLluviaDiariaPorLotes` que acota al periodo crítico de
 * cada lote). Usada para desglosar por semana el gráfico de lluvia mensual
 * del agricultor (ver `components/clima/prediccionMensual.ts`).
 */
export async function getLluviaDiariaEstacionPorStations(stationIds: string[]): Promise<LluviaDiariaEstacionRow[]> {
  if (stationIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_lluvia_diaria_estacion')
    .select('*')
    .in('station_id', stationIds)
    .order('dia')
  return (data ?? []) as LluviaDiariaEstacionRow[]
}

// ---------------------------------------------------------------------------
// Solo master — sin scope por agricultor. Nombres separados a propósito.
// ---------------------------------------------------------------------------

/** TODOS los lotes de TODOS los agricultores — el caller debe verificar profile.role === 'master' antes de llamar. */
export async function getTodosLosLotesGlobal(): Promise<LoteSeguimientoRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_seguimiento_lluvia')
    .select('*')
    .order('agricultor')
  return attachZona(supabase, (data ?? []) as LoteSeguimientoRow[])
}

/** Distribución de probabilidad global (no tiene columna zona/agricultor) — el caller debe verificar profile.role === 'master' antes de llamar. */
export async function getDistribucionNormalLluvia(): Promise<LluviaDistribucionNormalRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vista_distribucion_normal_lluvia')
    .select('*')
    .order('anio')
    .order('x')
  return (data ?? []) as LluviaDistribucionNormalRow[]
}
