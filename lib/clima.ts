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
