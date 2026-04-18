import { createClient } from './supabase/server'

export interface PredictorContext {
  agricultorKey: string
  davisKey: string
  displayName: string
  lat: number
  lon: number
  estado: string | null
  modoDatos: string | null
  davisDias: number | null
}

/**
 * Resolves the lat/lon/davis_key needed to call the predictor-siembra edge
 * function for a given agricultor. Returns null when no producer mapping
 * exists (e.g. demo farmers without a Davis station).
 */
export async function getPredictorContext(agricultorKey: string): Promise<PredictorContext | null> {
  if (!agricultorKey) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_productores_predictor')
    .select('agricultor_key, nombre, davis_key, lat, lon, estado, modo_datos, davis_dias')
    .eq('agricultor_key', agricultorKey)
    .maybeSingle()

  if (!data || data.lat == null || data.lon == null) return null

  return {
    agricultorKey: data.agricultor_key as string,
    davisKey: (data.davis_key as string | null) ?? '',
    displayName: (data.nombre as string | null) ?? agricultorKey,
    lat: Number(data.lat),
    lon: Number(data.lon),
    estado: (data.estado as string | null) ?? null,
    modoDatos: (data.modo_datos as string | null) ?? null,
    davisDias: (data.davis_dias as number | null) ?? null,
  }
}

/* ============================================================================
 * Edge function response types — mirrors predictor-siembra v19 output
 * ============================================================================ */

export type PredictorConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY LOW' | 'INSUFFICIENT'

export interface PredictorBreakdownItem {
  label: string
  pts: number
  max: number
  value: string
  ref: string
}

export interface PredictorPhase {
  rain_mm: number
  et0_mm: number
  balance_mm: number
  gdu: number
  dry_days: number
  stress_days: number
}

export interface PredictorCycle {
  days_data: number
  gdu: number
  gdu_target: number
  maturity_prob: number
  rain_30d: number
  rain_total: number
  et0_total: number
  water_balance: number
  flower_deficit: number
  flower_vpd_avg: number
  flower_temp_avg: number
  flower_nh: number
  flower_nh32: number
  dev_nd: number
  stress_days: number
  dry_days: number
  data_sources: {
    davis_real: number
    davis_median: number
    forecast: number
    external_api: number
    historico_db: number
    davis_pct: number
  }
  phases: Record<string, PredictorPhase>
}

export interface PredictorDDay {
  date: string
  label: string
  days_away: number
  score: number
  confidence: PredictorConfidence
  breakdown: PredictorBreakdownItem[]
  cycle: PredictorCycle
}

export interface PredictorAlternative {
  date: string
  label: string
  score: number
  confidence: PredictorConfidence
  vpd: number
  nd: number
  temp: number
  deficit: number
}

export interface PredictorClimate {
  annual_rain_mm: number
  temp_avg_c: number
  stress_days_yr: number
  rain_season_start: string
  ref_days: number
  region: 'llanos_centrales' | 'llanos_occidentales'
  enso?: {
    nino34_anomaly_3m_avg: number | null
    phase: string
    rain_scale_satellite_grid: number
    rain_scale_forecast_16d: number
    note: string
  }
}

export interface PredictorResponse {
  ok: boolean
  version: string
  location: { lat: number; lon: number; name: string; producer: string | null; region: string }
  data_mode: 'davis_hybrid' | 'chirps_nasa_openmeteo'
  climate: PredictorClimate
  d_day: PredictorDDay
  reasoning?: string
  alternatives: PredictorAlternative[]
  scoring_thresholds?: { region_note?: string }
}
