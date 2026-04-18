import { createClient } from './supabase/server'

export interface CurrentConditions {
  tempC: number | null
  humPct: number | null
  lluviaMm: number | null
  fecha: string | null
  descripcion: string
  productorClima: string | null
}

export interface ClimateSeries {
  /** normalized 0-1 daily averages, oldest → newest */
  tempSeries: number[]
  humSeries: number[]
  /** raw min/max for legend tooltips */
  tempMin: number
  tempMax: number
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
 * Resolve the weather station ("productor_clima") for an agricultor.
 * Returns null if no mapping exists yet.
 */
async function resolveProductorClima(agricultorKey: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('mapa_productor_clima')
    .select('productor_clima')
    .eq('agricultor_key', agricultorKey)
    .limit(1)
    .maybeSingle()
  return data?.productor_clima ?? null
}

/** Latest reading from clima_lecturas. Falls back to nulls. */
export async function getCurrentConditions(agricultorKey: string): Promise<CurrentConditions> {
  const productor = await resolveProductorClima(agricultorKey)
  if (!productor) {
    return { tempC: null, humPct: null, lluviaMm: null, fecha: null, descripcion: 'Sin estación', productorClima: null }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('clima_lecturas')
    .select('temp_c, hum_pct, lluvia_mm, fecha_hora, solar_rad_wm2')
    .eq('productor', productor)
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return { tempC: null, humPct: null, lluviaMm: null, fecha: null, descripcion: 'Sin datos', productorClima: productor }
  }

  return {
    tempC: data.temp_c,
    humPct: data.hum_pct,
    lluviaMm: data.lluvia_mm,
    fecha: data.fecha_hora,
    descripcion: describeCondition(data.lluvia_mm, data.solar_rad_wm2, data.hum_pct),
    productorClima: productor,
  }
}

/** Daily aggregated series for the last N days. */
export async function getClimateSeries(agricultorKey: string, days = 14): Promise<ClimateSeries> {
  const productor = await resolveProductorClima(agricultorKey)
  if (!productor) return emptySeries()

  const since = new Date(Date.now() - days * 86400000).toISOString()
  const supabase = await createClient()
  const { data } = await supabase
    .from('clima_lecturas')
    .select('fecha_hora, temp_c, hum_pct')
    .eq('productor', productor)
    .gte('fecha_hora', since)
    .order('fecha_hora', { ascending: true })

  if (!data || data.length === 0) return emptySeries()

  // Bucket by day
  const byDay = new Map<string, { temps: number[]; hums: number[] }>()
  for (const row of data) {
    if (!row.fecha_hora) continue
    const day = String(row.fecha_hora).slice(0, 10)
    const bucket = byDay.get(day) ?? { temps: [], hums: [] }
    if (row.temp_c != null) bucket.temps.push(row.temp_c)
    if (row.hum_pct != null) bucket.hums.push(row.hum_pct)
    byDay.set(day, bucket)
  }

  const days_sorted = Array.from(byDay.keys()).sort()
  const dailyTemp = days_sorted.map(d => avg(byDay.get(d)!.temps))
  const dailyHum  = days_sorted.map(d => avg(byDay.get(d)!.hums))

  const tempMin = Math.min(...dailyTemp.filter(Number.isFinite))
  const tempMax = Math.max(...dailyTemp.filter(Number.isFinite))
  const humMin  = Math.min(...dailyHum.filter(Number.isFinite))
  const humMax  = Math.max(...dailyHum.filter(Number.isFinite))

  return {
    tempSeries: dailyTemp.map(v => normalize(v, tempMin, tempMax)),
    humSeries:  dailyHum.map(v => normalize(v, humMin, humMax)),
    tempMin,
    tempMax,
  }
}

function avg(xs: number[]): number {
  if (xs.length === 0) return NaN
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function normalize(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0.5
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (v - min) / (max - min)))
}

function emptySeries(): ClimateSeries {
  return { tempSeries: [], humSeries: [], tempMin: 0, tempMax: 0 }
}

function describeCondition(lluvia: number | null, solar: number | null, hum: number | null): string {
  if (lluvia != null && lluvia > 0.5) return 'Lluvioso'
  if (solar != null && solar > 600) return 'Soleado'
  if (hum != null && hum > 80)      return 'Nublado'
  return 'Parcial'
}

/**
 * Get the next N days of forecast. Falls back to the most-recent download batch
 * if no future-dated rows exist (so demo data still renders).
 */
export async function getForecast(agricultorKey: string, days = 7): Promise<ForecastBundle> {
  const productor = await resolveProductorClima(agricultorKey)
  if (!productor) return { rows: [], descargadoEn: null, isStale: true }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Try future-dated forecast first
  const { data: futureRows } = await supabase
    .from('clima_forecast')
    .select('fecha, temp_max_c, temp_min_c, lluvia_mm, prob_lluvia_pct, hum_avg_pct, viento_max_kmh, descargado_en')
    .eq('productor_clima', productor)
    .gte('fecha', today)
    .order('fecha', { ascending: true })
    .limit(days)

  if (futureRows && futureRows.length > 0) {
    return {
      rows: futureRows.map(stripDescargado),
      descargadoEn: futureRows[0]?.descargado_en ?? null,
      isStale: false,
    }
  }

  // Fall back to latest batch (whatever date)
  const { data: latestBatch } = await supabase
    .from('clima_forecast')
    .select('fecha, temp_max_c, temp_min_c, lluvia_mm, prob_lluvia_pct, hum_avg_pct, viento_max_kmh, descargado_en')
    .eq('productor_clima', productor)
    .order('fecha', { ascending: true })
    .order('descargado_en', { ascending: false })
    .limit(days)

  if (!latestBatch || latestBatch.length === 0) {
    return { rows: [], descargadoEn: null, isStale: true }
  }

  const lastFecha = latestBatch[latestBatch.length - 1]?.fecha
  const ageMs = lastFecha ? Date.now() - new Date(lastFecha).getTime() : Infinity
  const isStale = ageMs > 2 * 86400000

  return {
    rows: latestBatch.map(stripDescargado),
    descargadoEn: latestBatch[0]?.descargado_en ?? null,
    isStale,
  }
}

function stripDescargado(row: ForecastDay & { descargado_en?: string }): ForecastDay {
  const { descargado_en: _drop, ...rest } = row
  void _drop
  return rest
}

/**
 * Heuristic agronomic alerts derived from a forecast bundle. Pure logic.
 * Thresholds tuned for Venezuelan llanos corn — adjust as agronomy team tunes.
 */
export function computeAlerts(rows: ForecastDay[]): Alert[] {
  const alerts: Alert[] = []
  for (const r of rows) {
    const dia = formatShortDate(r.fecha)

    // Lluvia fuerte → siempre danger
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

    // Calor extremo (umbral conservador para maíz)
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

    // Frío inusual (en llano venezolano, <12°C ya es señal)
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

    // Viento fuerte (acame del maíz)
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
  // Sort by severity (danger first), then date
  const order = { danger: 0, warn: 1, info: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.fecha.localeCompare(b.fecha))
}

function formatShortDate(iso: string): string {
  // Force UTC interpretation so "2026-04-20" doesn't shift by timezone
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
}
