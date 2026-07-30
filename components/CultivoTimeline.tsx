'use client'

import { useMemo } from 'react'
import CornStage from './CornStage'
import { getStageFromDays } from '@/lib/corn-stages'

interface Props {
  fechaSiembra: string | null
  diasCiclo?: number
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TIMELINE_MONTHS = 12

/**
 * Dark "tech" timeline panel — Maize Growth Timeline.
 * 12 month cells, glowing "Hoy" pill marker, ciclo indicator with end-dots,
 * and 6 corn growth SVGs distributed across the planting cycle.
 */
export default function CultivoTimeline({ fechaSiembra, diasCiclo = 120 }: Props) {
  const today = new Date()
  const yearStart = new Date(today.getFullYear(), 0, 1)

  const months = useMemo(
    () => Array.from({ length: TIMELINE_MONTHS }, (_, i) => MONTHS_ES[i]),
    []
  )

  const totalMs = TIMELINE_MONTHS * 30.44 * 86400000

  const todayPct = useMemo(() => {
    const elapsedMs = today.getTime() - yearStart.getTime()
    return Math.max(0, Math.min(1, elapsedMs / totalMs))
  }, [today, yearStart, totalMs])

  const siembraDate = fechaSiembra ? new Date(fechaSiembra) : null
  const cosechaDate = siembraDate ? new Date(siembraDate.getTime() + diasCiclo * 86400000) : null

  const siembraPct = siembraDate
    ? Math.max(0, Math.min(1, (siembraDate.getTime() - yearStart.getTime()) / totalMs))
    : null
  const cosechaPct = cosechaDate
    ? Math.max(0, Math.min(1, (cosechaDate.getTime() - yearStart.getTime()) / totalMs))
    : null

  const diasDesde = siembraDate
    ? Math.floor((today.getTime() - siembraDate.getTime()) / 86400000)
    : 0

  const stages = useMemo(() => {
    if (siembraPct === null || cosechaPct === null) return []
    const span = cosechaPct - siembraPct
    const offsets = [0.05, 0.20, 0.40, 0.60, 0.78, 0.95]
    return [0, 1, 2, 3, 4, 5].map((s, i) => ({
      stage: s as 0 | 1 | 2 | 3 | 4 | 5,
      leftPct: (siembraPct + span * offsets[i]) * 100,
    }))
  }, [siembraPct, cosechaPct])

  const currentStage = getStageFromDays(diasDesde)

  return (
    <div
      className="relative rounded-2xl bg-gradient-to-b from-gray-950 to-gray-900 border border-green-500/20 p-6"
      style={{ boxShadow: '0 0 40px rgba(34, 197, 94, 0.08), inset 0 0 30px rgba(0, 0, 0, 0.3)' }}
    >
      {/* Panel label */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Ciclo del maíz
        </p>
      </div>

      {/* Cuerpo de la línea de tiempo.
          Antes las plantas eran `absolute … bottom-0` respecto a ESTE div, y su
          borde inferior caía al final del panel —o sea, por debajo de la barra
          de meses y del indicador de ciclo—, que es justo donde se veían. Ahora
          la franja superior (marcador "Hoy" + plantas) es un bloque propio en
          flujo normal, así que las plantas se apoyan en SU base y quedan
          siempre encima de los meses, pase lo que pase con el alto del panel. */}
      <div className="relative pb-12">
        {/* Franja superior: 128 px reparten el marcador "Hoy" (~34 px arriba) y
            las plantas de 48 px apoyadas abajo, sin que se toquen. */}
        <div className="relative h-32">
          {/* Hoy marker (glowing pill + arrow) */}
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-30"
            style={{ left: `${todayPct * 100}%` }}
          >
            <div
              className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-lg"
              style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.6), 0 0 30px rgba(34, 197, 94, 0.3)' }}
            >
              Hoy
            </div>
            <svg width="14" height="10" viewBox="0 0 14 10" className="text-green-500 mt-0.5">
              <path d="M7 10 L0 0 L14 0 Z" fill="currentColor" />
            </svg>
          </div>

          {/* Plantas por etapa, apoyadas en la base de la franja */}
          <div className="absolute inset-0 pointer-events-none">
            {stages.map(({ stage, leftPct }, i) => {
              const isPast = stage <= currentStage
              const isCurrent = stage === currentStage
              return (
                <div
                  key={stage}
                  className="absolute -translate-x-1/2"
                  style={{
                    left: `${leftPct}%`,
                    bottom: 0,
                    opacity: isPast ? 1 : 0.45,
                    filter: isCurrent
                      ? 'drop-shadow(0 0 8px rgba(132, 204, 22, 0.6))'
                      : isPast ? 'none' : 'grayscale(0.4)',
                  }}
                >
                  <CornStage stage={stage} delay={i * 0.18} size={48} />
                </div>
              )
            })}
          </div>

          {/* Resplandor de la etapa actual, pegado al borde inferior de la
              franja para que caiga sobre la barra de meses */}
          {siembraPct !== null && cosechaPct !== null && (
            <div
              className="absolute bottom-0 -translate-x-1/2 translate-y-1/2 w-32 h-6 pointer-events-none rounded-full"
              style={{
                left: `${todayPct * 100}%`,
                background: 'radial-gradient(ellipse, rgba(132, 204, 22, 0.4), transparent 70%)',
              }}
            />
          )}
        </div>

        {/* Month bar */}
        <div className="relative grid grid-cols-12 border-t border-b border-gray-700">
          {months.map((m, i) => (
            <div
              key={i}
              className="relative text-center py-3 text-xs font-medium text-gray-500 border-r border-gray-800 last:border-r-0"
            >
              {m}
              {/* Tick on top */}
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-1.5 bg-gray-600" />
            </div>
          ))}
        </div>

        {/* Cycle indicator (line + end dots) */}
        {siembraPct !== null && cosechaPct !== null && (
          <div className="relative mt-3 h-4">
            <div
              className="absolute top-1/2 h-px bg-gradient-to-r from-green-500 to-amber-500 -translate-y-1/2"
              style={{
                left: `${siembraPct * 100}%`,
                width: `${(cosechaPct - siembraPct) * 100}%`,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-green-500"
              style={{ left: `${siembraPct * 100}%` }}
              title="Inicio siembra"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300"
              style={{ left: `${cosechaPct * 100}%` }}
              title="Cosecha estimada"
            />
            <div
              className="absolute -translate-x-1/2 mt-3 text-[10px] font-medium uppercase tracking-wider text-gray-400"
              style={{ left: `${((siembraPct + cosechaPct) / 2) * 100}%`, top: '100%' }}
            >
              Ciclo {getCicloName(siembraDate!)}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .grid-cols-12 {
          grid-template-columns: repeat(12, minmax(0, 1fr));
        }
      `}</style>
    </div>
  )
}

function getCicloName(siembra: Date): string {
  const month = siembra.getMonth()
  if (month >= 4 && month <= 9) return 'Invierno'
  return 'Verano'
}

