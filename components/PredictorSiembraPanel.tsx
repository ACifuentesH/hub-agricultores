'use client'

import { useState } from 'react'
import { Sparkles, Calendar, TrendingUp, Loader2, AlertCircle, MapPin, Database, ChevronDown, ChevronUp } from 'lucide-react'
import type { PredictorContext, PredictorResponse, PredictorConfidence, PredictorAlternative } from '@/lib/predictor'

interface Props {
  context: PredictorContext | null
}

const CONFIDENCE_STYLES: Record<PredictorConfidence, string> = {
  HIGH:           'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300',
  MEDIUM:         'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
  LOW:            'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
  'VERY LOW':     'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300',
  INSUFFICIENT:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export default function PredictorSiembraPanel({ context }: Props) {
  const [data, setData] = useState<PredictorResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  if (!context) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <AlertCircle size={16} className="text-gray-400" />
        Predictor no disponible: este agricultor no tiene una estación Davis asociada todavía.
      </div>
    )
  }

  async function runPrediction() {
    if (!context) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const params = new URLSearchParams({
        lat: String(context.lat),
        lon: String(context.lon),
        producer: context.davisKey,
        name: context.displayName,
      })
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/predictor-siembra?${params}`
      const res = await fetch(url, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
      })
      const json = (await res.json()) as PredictorResponse | { ok: false; error: string }
      if (!('ok' in json) || !json.ok) {
        throw new Error('error' in json ? json.error : 'Error desconocido')
      }
      setData(json as PredictorResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al calcular')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/60">
            <Sparkles size={18} className="text-green-700 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Predictor de fecha óptima de siembra</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
              <MapPin size={11} /> {context.displayName}
              {context.estado && <span>· {context.estado}</span>}
              {context.davisDias != null && <span>· {context.davisDias}d Davis</span>}
            </p>
          </div>
        </div>
        <button
          onClick={runPrediction}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Calculando…
            </>
          ) : data ? (
            'Recalcular'
          ) : (
            <>
              <Calendar size={14} />
              Calcular
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {!data && !loading && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Calcula la mejor fecha para sembrar maíz blanco basándose en pronóstico, historial de la estación y modelo agroclimático
            (VPD, GDU, balance hídrico, ENSO). El cálculo demora ~10-20 segundos.
          </p>
        )}

        {loading && <PredictorSkeleton />}

        {data && <PredictorResult data={data} showDetails={showDetails} onToggleDetails={() => setShowDetails(s => !s)} />}
      </div>
    </div>
  )
}

function PredictorSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
      <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      <p className="text-xs text-gray-400 text-center">Consultando CHIRPS, NASA POWER, Open-Meteo y Davis…</p>
    </div>
  )
}

function PredictorResult({
  data,
  showDetails,
  onToggleDetails,
}: {
  data: PredictorResponse
  showDetails: boolean
  onToggleDetails: () => void
}) {
  const { d_day, climate, alternatives, data_mode } = data
  const confidenceClass = CONFIDENCE_STYLES[d_day.confidence] ?? CONFIDENCE_STYLES.INSUFFICIENT

  return (
    <div className="space-y-5">
      {/* D-Day hero card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-green-700 to-green-900 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-10">
            <Calendar size={140} />
          </div>
          <p className="text-xs uppercase tracking-wider text-green-100 font-medium">Fecha óptima recomendada</p>
          <p className="text-3xl font-bold mt-1">{d_day.label}</p>
          <p className="text-sm text-green-100 mt-1">
            {d_day.days_away >= 0
              ? `En ${d_day.days_away} días`
              : `Hace ${Math.abs(d_day.days_away)} días`}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${confidenceClass}`}>
              {d_day.confidence}
            </span>
            <span className="text-xs text-green-100">
              GDU {d_day.cycle.gdu}/{d_day.cycle.gdu_target} · Balance {d_day.cycle.water_balance > 0 ? '+' : ''}{d_day.cycle.water_balance} mm
            </span>
          </div>
        </div>

        <ScoreRing score={d_day.score} />
      </div>

      {/* Breakdown */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
          <TrendingUp size={12} /> Desglose del puntaje
        </p>
        <div className="space-y-1.5">
          {d_day.breakdown.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-200 w-44 shrink-0">{b.label}</span>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${(b.pts / b.max) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums w-12 text-right">
                {b.pts}/{b.max}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-32 text-right truncate" title={b.value}>
                {b.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Alternativas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {alternatives.slice(0, 4).map((a) => (
              <AlternativeCard key={a.date} a={a} />
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {data.reasoning && (
        <div className="bg-green-50/50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-900/40 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> Análisis del agrónomo IA
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
            {data.reasoning}
          </div>
        </div>
      )}

      {/* Toggleable climate context */}
      <button
        onClick={onToggleDetails}
        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 inline-flex items-center gap-1"
      >
        {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showDetails ? 'Ocultar detalles' : 'Mostrar contexto climático'}
      </button>

      {showDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-gray-100 dark:border-gray-800">
          <ContextItem label="Lluvia anual" value={`${climate.annual_rain_mm} mm`} />
          <ContextItem label="Temp. promedio" value={`${climate.temp_avg_c}°C`} />
          <ContextItem label="Días estrés/año" value={`${climate.stress_days_yr}`} />
          <ContextItem label="Región" value={climate.region === 'llanos_centrales' ? 'Llanos Centrales' : 'Llanos Occidentales'} />
          {climate.enso?.nino34_anomaly_3m_avg != null && (
            <ContextItem label="ENSO Niño3.4" value={`${climate.enso.nino34_anomaly_3m_avg.toFixed(2)} (${climate.enso.phase})`} />
          )}
          <ContextItem
            label="Modo datos"
            value={data_mode === 'davis_hybrid' ? `${d_day.cycle.data_sources.davis_pct}% Davis` : 'NASA + CHIRPS'}
            icon={<Database size={11} />}
          />
        </div>
      )}
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 78 ? '#16a34a' : score >= 58 ? '#3b82f6' : score >= 38 ? '#f59e0b' : '#ef4444'

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 flex flex-col items-center justify-center">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Puntaje</p>
      <div className="relative w-24 h-24">
        <svg className="-rotate-90 w-24 h-24" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
          <circle
            cx="48" cy="48" r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{score}</span>
          <span className="text-[10px] text-gray-400">/ 100</span>
        </div>
      </div>
    </div>
  )
}

function AlternativeCard({ a }: { a: PredictorAlternative }) {
  const confidenceClass = CONFIDENCE_STYLES[a.confidence] ?? CONFIDENCE_STYLES.INSUFFICIENT
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{a.label}</span>
        <span className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">{a.score}</span>
      </div>
      <span className={`inline-flex mt-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${confidenceClass}`}>
        {a.confidence}
      </span>
      <p className="text-[10px] text-gray-400 mt-1.5">VPD {a.vpd} · {a.nd}d secos · {a.temp}°C</p>
    </div>
  )
}

function ContextItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{value}</p>
    </div>
  )
}
