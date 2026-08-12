import { createClient } from './supabase/server'
import type { AgricultorOption } from './access'

/** Origen de los datos de clima para un agricultor. */
export type ClimaFuente = 'davis' | 'triangulated' | 'sin_datos'
export type ClimaPrecision = 'aceptable' | 'media' | 'baja' | 'sin_estaciones_cercanas'

export interface ClimaSourceMeta {
  fuente: ClimaFuente
  davisKey: string | null
  /** Solo para triangulated: cuántas estaciones se usaron */
  nEstaciones?: number
  distMinKm?: number
  distMaxKm?: number
  estacionesUsadas?: string
  precision?: ClimaPrecision
  lat?: number | null
  lon?: number | null
}

export interface CurrentConditions {
  tempC: number | null
  humPct: number | null
  lluviaMm: number | null
  fecha: string | null
  descripcion: string
  productorClima: string | null
  source: ClimaSourceMeta
}

export interface ClimateSeries {
  /** normalized 0-1 daily averages, oldest → newest */
  tempSeries: number[]
  humSeries: number[]
  /** fecha "YYYY-MM-DD" de cada punto, mismo orden/índice que tempSeries/humSeries */
  dates: string[]
  /** raw min/max for legend tooltips */
  tempMin: number
  tempMax: number
  /**
   * true cuando la estación de esta serie nunca reportó temp_c (hardware de
   * solo-lluvia) — distinto de un hueco temporal de datos en una estación que
   * sí mide temperatura.
   */
  sinSensorTemperatura: boolean
}

export interface ForecastDay {
  fecha: string
  temp_max_c: number | null
  temp_min_c: number | null
  lluvia_mm: number | null
  prob_lluvia_pct: number | null
  hum_avg_pct: number | null
  viento_max_kmh: number | null
}

export interface ForecastBundle {
  rows: ForecastDay[]
  /** ISO timestamp of most-recent download batch */
  descargadoEn: string | null
  /** true when latest forecast date is older than 2 days behind today */
  isStale: boolean
}

export type AlertSeverity = 'info' | 'warn' | 'danger'
export type AlertIcon = 'rain' | 'heat' | 'cold' | 'wind' | 'storm'
export interface Alert {
  id: string
  severity: AlertSeverity
  icon: AlertIcon
  title: string
  detail: string
  fecha: string
}

/**
 * Resuelve la estación (codigo_estacion) de un agricultor: el schema nuevo
 * asigna la estación por lote (`lotes.codigo_estacion`), no por agricultor
 * directamente, así que se toma el primer lote con estación asignada.
 * Asunción explícita: si un agricultor tuviera lotes en más de una estación,
 * se muestra la del primero que aparezca — revisar si en la práctica hay
 * agricultores con estaciones distintas por lote.
 */
async function resolveEstacionAgricultor(agricultorId: string): Promise<string | null> {
  if (!agricultorId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('lotes')
    .select('codigo_estacion')
    .eq('agricultor_id', agricultorId)
    .not('codigo_estacion', 'is', null)
    .limit(1)
    .maybeSingle()
  return (data?.codigo_estacion as string | null) ?? null
}

/**
 * Convenience helper: resuelve solo el `codigo_estacion` para un agricultor.
 * Usado por páginas que necesitan consultar `lecturas_live`/`lecturas_diarias`
 * directamente (ej. histórico).
 */
export async function resolveStationId(agricultorKey: string): Promise<string | null> {
  return resolveEstacionAgricultor(agricultorKey)
}

const SIN_DATOS: CurrentConditions = {
  tempC: null,
  humPct: null,
  lluviaMm: null,
  fecha: null,
  descripcion: 'Sin datos',
  productorClima: null,
  source: { fuente: 'sin_datos', davisKey: null },
}

/**
 * Última lectura para un agricultor: resuelve su estación (vía `lotes`) y
 * trae la fila más reciente de `lecturas_live` con `temp_c` no nulo (las
 * últimas filas pueden ser resúmenes horarios sin temp_c si el sensor estaba
 * caído ese intervalo).
 */
export async function getCurrentConditions(agricultorKey: string): Promise<CurrentConditions> {
  if (!agricultorKey) return SIN_DATOS
  const supabase = await createClient()

  const codigoEstacion = await resolveEstacionAgricultor(agricultorKey)
  if (!codigoEstacion) return SIN_DATOS

  const { data: estacion } = await supabase
    .from('estaciones')
    .select('codigo_estacion, station_name')
    .eq('codigo_estacion', codigoEstacion)
    .maybeSingle()
  if (!estacion) return SIN_DATOS

  const { data: full } = await supabase
    .from('lecturas_live')
    .select('temp_c, hum_pct, lluvia_mm, fecha_hora, radiacion_w_m2')
    .eq('codigo_estacion', codigoEstacion)
    .not('temp_c', 'is', null)
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!full) {
    return {
      ...SIN_DATOS,
      productorClima: estacion.station_name,
      source: { fuente: 'davis', davisKey: estacion.station_name },
    }
  }

  return {
    tempC: full.temp_c,
    humPct: full.hum_pct,
    lluviaMm: full.lluvia_mm,
    fecha: full.fecha_hora,
    descripcion: describeCondition(full.lluvia_mm, full.radiacion_w_m2, full.hum_pct),
    productorClima: estacion.station_name,
    source: { fuente: 'davis', davisKey: estacion.station_name },
  }
}

/**
 * Serie diaria para los últimos N días — a diferencia de producción (que
 * agrupaba lecturas crudas por día en JS), acá se lee directo de
 * `lecturas_diarias`, que ya viene pre-agregada por estación/día.
 */
export async function getClimateSeries(agricultorKey: string, days = 14): Promise<ClimateSeries> {
  const codigoEstacion = await resolveEstacionAgricultor(agricultorKey)
  if (!codigoEstacion) return emptySeries()

  const supabase = await createClient()
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('lecturas_diarias')
    .select('dia, temp_c_avg, hum_pct_avg')
    .eq('codigo_estacion', codigoEstacion)
    .gte('dia', sinceDate)
    .order('dia', { ascending: true })

  if (!data || data.length === 0) return emptySeries(await esSensorSoloLluvia(supabase, codigoEstacion))

  const dailyTemp = data.map(r => (r.temp_c_avg != null ? Number(r.temp_c_avg) : NaN))
  const dailyHum = data.map(r => (r.hum_pct_avg != null ? Number(r.hum_pct_avg) : NaN))
  const dates = data.map(r => String(r.dia))

  // Estaciones de solo-lluvia (sin sensor de temperatura/humedad) traen filas
  // en la ventana pero con temp_c_avg/hum_pct_avg siempre null.
  if (dailyTemp.every(v => !Number.isFinite(v))) {
    return emptySeries(await esSensorSoloLluvia(supabase, codigoEstacion))
  }

  const tempMin = Math.min(...dailyTemp.filter(Number.isFinite))
  const tempMax = Math.max(...dailyTemp.filter(Number.isFinite))
  const humMin = Math.min(...dailyHum.filter(Number.isFinite))
  const humMax = Math.max(...dailyHum.filter(Number.isFinite))

  return {
    tempSeries: dailyTemp.map(v => normalize(v, tempMin, tempMax)),
    humSeries: dailyHum.map(v => normalize(v, humMin, humMax)),
    dates,
    tempMin,
    tempMax,
    sinSensorTemperatura: false,
  }
}

/** Chequeo barato (limit 1, ya filtrado por codigo_estacion) de si esta estación alguna vez reportó temp_c. */
async function esSensorSoloLluvia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  codigoEstacion: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('lecturas_live')
    .select('fecha_hora')
    .eq('codigo_estacion', codigoEstacion)
    .not('temp_c', 'is', null)
    .limit(1)
  return !data || data.length === 0
}

function normalize(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0.5
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (v - min) / (max - min)))
}

function emptySeries(sinSensorTemperatura = false): ClimateSeries {
  return { tempSeries: [], humSeries: [], dates: [], tempMin: 0, tempMax: 0, sinSensorTemperatura }
}

function describeCondition(lluvia: number | null, solar: number | null, hum: number | null): string {
  if (lluvia != null && lluvia > 0.5) return 'Lluvioso'
  if (solar != null && solar > 600) return 'Soleado'
  if (hum != null && hum > 80)      return 'Nublado'
  return 'Parcial'
}

/**
 * Pronóstico a N días: el schema nuevo no tiene tabla de pronóstico
 * (`clima_forecast` no existe) — decisión explícita de ocultar esta tarjeta
 * por ahora. Se conserva la función (siempre vacía) para no romper
 * `lib/asistente.ts`, que la sigue llamando.
 */
export async function getForecast(agricultorKey: string, days = 7): Promise<ForecastBundle> {
  void agricultorKey
  void days
  return { rows: [], descargadoEn: null, isStale: true }
}

/**
 * Alertas agronómicas heurísticas derivadas de un pronóstico. Lógica pura,
 * sin cambios — hoy siempre recibe `rows: []` porque `getForecast` no tiene
 * fuente de datos, así que devuelve `[]`.
 */
export function computeAlerts(rows: ForecastDay[]): Alert[] {
  const alerts: Alert[] = []
  for (const r of rows) {
    const dia = formatShortDate(r.fecha)

    if (r.lluvia_mm != null && r.lluvia_mm >= 30) {
      alerts.push({
        id: `rain-strong-${r.fecha}`,
        severity: 'danger',
        icon: 'storm',
        title: 'Lluvia fuerte',
        detail: `${r.lluvia_mm.toFixed(0)} mm el ${dia}. Posponer aplicaciones foliares y revisar drenajes.`,
        fecha: r.fecha,
      })
    } else if (r.prob_lluvia_pct != null && r.prob_lluvia_pct >= 70) {
      alerts.push({
        id: `rain-likely-${r.fecha}`,
        severity: 'info',
        icon: 'rain',
        title: 'Alta probabilidad de lluvia',
        detail: `${r.prob_lluvia_pct.toFixed(0)}% el ${dia} (${(r.lluvia_mm ?? 0).toFixed(1)} mm estimados).`,
        fecha: r.fecha,
      })
    }

    if (r.temp_max_c != null && r.temp_max_c >= 38) {
      alerts.push({
        id: `heat-${r.fecha}`,
        severity: r.temp_max_c >= 40 ? 'danger' : 'warn',
        icon: 'heat',
        title: 'Calor extremo',
        detail: `Máxima de ${r.temp_max_c.toFixed(1)}°C el ${dia}. Estrés térmico, considerar riego anticipado.`,
        fecha: r.fecha,
      })
    }

    if (r.temp_min_c != null && r.temp_min_c <= 12) {
      alerts.push({
        id: `cold-${r.fecha}`,
        severity: r.temp_min_c <= 8 ? 'danger' : 'warn',
        icon: 'cold',
        title: r.temp_min_c <= 8 ? 'Riesgo de helada' : 'Frío inusual',
        detail: `Mínima de ${r.temp_min_c.toFixed(1)}°C el ${dia}. Monitorear plántulas y protección.`,
        fecha: r.fecha,
      })
    }

    if (r.viento_max_kmh != null && r.viento_max_kmh >= 40) {
      alerts.push({
        id: `wind-${r.fecha}`,
        severity: r.viento_max_kmh >= 60 ? 'danger' : 'warn',
        icon: 'wind',
        title: 'Viento fuerte',
        detail: `Ráfagas de ${r.viento_max_kmh.toFixed(0)} km/h el ${dia}. Riesgo de acame en lotes en floración.`,
        fecha: r.fecha,
      })
    }
  }
  const order = { danger: 0, warn: 1, info: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.fecha.localeCompare(b.fecha))
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Lista de agricultores con al menos un lote en ciclo 2026, para el selector
 * de master en /clima. A diferencia de producción, acá no hay "perfiles
 * gemelos" que desambiguar (ver lib/access.ts) porque el ciclo vive en
 * `lotes`, no en la identidad del agricultor.
 */
export async function listAgricultores2026(): Promise<AgricultorOption[]> {
  const supabase = await createClient()
  const { data: lotes2026 } = await supabase
    .from('lotes')
    .select('agricultor_id')
    .ilike('ciclo', '%2026%')

  const ids = Array.from(new Set((lotes2026 ?? []).map(l => l.agricultor_id as string)))
  if (ids.length === 0) return []

  const { data } = await supabase
    .from('agricultores')
    .select('agricultor_id, nombre')
    .in('agricultor_id', ids)
    .order('nombre', { ascending: true })

  return (data ?? []).map(a => ({
    key: a.agricultor_id as string,
    nombre: (a.nombre as string | null) ?? (a.agricultor_id as string),
  }))
}
