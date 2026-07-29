import { Leaf } from 'lucide-react'
import { FASE_EXPLICACION } from '@/lib/agro-glosario'
import type { Stage } from '@/lib/corn-stages'

/**
 * Fase fenológica en la que está la mayoría de los lotes del agricultor.
 *
 * El dato es MEDIDO EN CAMPO por el técnico (V2, V5, R1…), no calculado a partir
 * de la fecha de siembra: es más fiable que estimarlo por días transcurridos.
 */

/** Agrupa las etapas de Saturno (V1..V12, R1..R6) en las 6 fases del glosario. */
function faseAStage(fase: string | null): Stage | null {
  if (!fase) return null
  const m = fase.trim().toUpperCase().match(/^([VR])(\d+)$/)
  if (!m) return null
  const [, tipo, nStr] = m
  const n = Number(nStr)
  if (tipo === 'V') {
    if (n <= 0) return 0
    if (n <= 6) return 1
    if (n <= 10) return 2
    return 3
  }
  // Reproductivas
  if (n <= 4) return 4
  return 5
}

const NOMBRE_FASE: Record<string, string> = {
  V: 'Crecimiento vegetativo',
  R: 'Etapa reproductiva',
}

export default function FaseActualCard({
  fase,
  lotesConFase,
  lotesTotales,
}: {
  fase: string | null
  lotesConFase: number
  lotesTotales: number
}) {
  const stage = faseAStage(fase)
  const tipo = fase?.trim().toUpperCase().charAt(0) ?? ''

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Leaf size={16} className="text-green-600" />
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Fase del cultivo
        </p>
      </div>

      {!fase ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin fase registrada. El técnico la anota durante la visita al lote.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {fase}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {NOMBRE_FASE[tipo] ?? 'Fase registrada'}
            </span>
          </div>

          {stage !== null && (
            <p className="mt-2.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {FASE_EXPLICACION[stage]}
            </p>
          )}

          <p className="mt-3 border-t border-gray-100 pt-2.5 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
            Fase más frecuente entre {lotesConFase} de tus {lotesTotales} lotes
          </p>
        </>
      )}
    </div>
  )
}
