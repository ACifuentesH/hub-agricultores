'use client'

import { useMemo } from 'react'
import CornStage, { getStageFromDays, getStageMeta } from './CornStage'

interface Props {
  /** ISO date (YYYY-MM-DD) of real planting start */
  fechaSiembra: string | null
  /** Days until estimated harvest (default 120 for corn) */
  diasCiclo?: number
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TIMELINE_MONTHS = 14

/**
 * Horizontal cycle timeline replicating the reference image:
 * - 14 month cells (this Jan → next Feb)
 * - "Hoy" arrow at current month
 * - "Ciclo" indicator from siembra → cosecha estimada
 * - 6 corn growth SVGs anchored to their phase month
 */
export default function CultivoTimeline({ fechaSiembra, diasCiclo = 120 }: Props) {
  const today = new Date()
  const yearStart = new Date(today.getFullYear(), 0, 1)

  const months = useMemo(() => {
    return Array.from({ length: TIMELINE_MONTHS }, (_, i) => {
      const d = new Date(yearStart.getFullYear(), i, 1)
      return { label: MONTHS_ES[d.getMonth()], year: d.getFullYear(), index: i }
    })
  }, [yearStart])

  // Today position (0 → 1) along the timeline
  const todayPct = useMemo(() => {
    const totalMs = TIMELINE_MONTHS * 30.44 * 86400000
    const elapsedMs = today.getTime() - yearStart.getTime()
    return Math.max(0, Math.min(1, elapsedMs / totalMs))
  }, [today, yearStart])

  const siembraDate = fechaSiembra ? new Date(fechaSiembra) : null
  const cosechaDate = siembraDate
    ? new Date(siembraDate.getTime() + diasCiclo * 86400000)
    : null

  const totalMs = TIMELINE_MONTHS * 30.44 * 86400000
  const siembraPct = siembraDate
    ? Math.max(0, Math.min(1, (siembraDate.getTime() - yearStart.getTime()) / totalMs))
    : null
  const cosechaPct = cosechaDate
    ? Math.max(0, Math.min(1, (cosechaDate.getTime() - yearStart.getTime()) / totalMs))
    : null

  const diasDesde = siembraDate
    ? Math.floor((today.getTime() - siembraDate.getTime()) / 86400000)
    : 0

  // Build 6 stage anchor positions across the cycle
  const stages = useMemo(() => {
    if (siembraPct === null || cosechaPct === null) return []
    const span = cosechaPct - siembraPct
    return [0, 1, 2, 3, 4, 5].map((s) => {
      // Place each stage at proportional offset (0.05, 0.20, 0.40, 0.60, 0.78, 0.95)
      const offsets = [0.05, 0.20, 0.40, 0.60, 0.78, 0.95]
      return {
        stage: s as 0 | 1 | 2 | 3 | 4 | 5,
        leftPct: (siembraPct + span * offsets[s]) * 100,
      }
    })
  }, [siembraPct, cosechaPct])

  const currentStage = getStageFromDays(diasDesde)

  return (
    <div className="w-full">
      {/* Timeline frame */}
      <div className="relative pt-20 pb-10">
        {/* Hoy marker (arrow + label) above */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-20"
          style={{ left: `${todayPct * 100}%` }}
        >
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Hoy</span>
          <svg width="14" height="10" viewBox="0 0 14 10" className="text-gray-700 dark:text-gray-200">
            <path d="M7 10 L0 0 L14 0 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Corn stages floating above the bar, positioned across the cycle */}
        <div className="absolute inset-x-0 top-8 h-12 pointer-events-none">
          {stages.map(({ stage, leftPct }, i) => {
            const isPast = stage <= currentStage
            return (
              <div
                key={stage}
                className="absolute -translate-x-1/2"
                style={{
                  left: `${leftPct}%`,
                  bottom: 0,
                  opacity: isPast ? 1 : 0.35,
                  filter: isPast ? 'none' : 'grayscale(0.5)',
                }}
              >
                <CornStage stage={stage} delay={i * 0.15} size={32} />
              </div>
            )
          })}
        </div>

        {/* Month bar */}
        <div className="relative grid grid-cols-14 border-t border-b border-gray-200 dark:border-gray-700 bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-gray-800 dark:to-gray-900">
          {months.map((m, i) => (
            <div
              key={i}
              className="text-center py-2 text-[10px] font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
            >
              {m.label}
            </div>
          ))}

          {/* Cycle indicator (line + dots) */}
          {siembraPct !== null && cosechaPct !== null && (
            <>
              <div
                className="absolute top-1/2 h-0.5 bg-green-700 dark:bg-green-500 -translate-y-1/2 z-10"
                style={{
                  left: `${siembraPct * 100}%`,
                  width: `${(cosechaPct - siembraPct) * 100}%`,
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-green-700 dark:bg-green-500 ring-2 ring-white dark:ring-gray-900 z-10"
                style={{ left: `${siembraPct * 100}%` }}
                title="Inicio siembra"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-600 ring-2 ring-white dark:ring-gray-900 z-10"
                style={{ left: `${cosechaPct * 100}%` }}
                title="Cosecha estimada"
              />
            </>
          )}

          {/* Today vertical line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-700 dark:bg-gray-300 z-10"
            style={{ left: `${todayPct * 100}%` }}
          />
        </div>

        {/* Cycle label below bar */}
        {siembraPct !== null && cosechaPct !== null && (
          <div
            className="absolute -translate-x-1/2 mt-1"
            style={{
              left: `${((siembraPct + cosechaPct) / 2) * 100}%`,
              top: 'calc(100% - 28px)',
            }}
          >
            <span className="text-[10px] font-medium text-green-800 dark:text-green-400 uppercase tracking-wider">
              Ciclo {getCicloName(siembraDate!)}
            </span>
          </div>
        )}
      </div>

      {/* Current stage label */}
      {siembraDate && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            Día {diasDesde} de {diasCiclo}
          </span>
          <span className="font-medium text-green-800 dark:text-green-400">
            Etapa actual: {getStageMeta(currentStage).phase} ({getStageMeta(currentStage).label})
          </span>
        </div>
      )}

      <style jsx>{`
        .grid-cols-14 {
          grid-template-columns: repeat(14, minmax(0, 1fr));
        }
      `}</style>
    </div>
  )
}

function getCicloName(siembra: Date): string {
  const month = siembra.getMonth()
  // In Venezuela, Invierno (rainy) ≈ May-Oct, Verano ≈ Nov-Apr
  if (month >= 4 && month <= 9) return 'Invierno'
  return 'Verano'
}
