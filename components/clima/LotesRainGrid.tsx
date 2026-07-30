/**
 * Grilla de un `LoteRainChart` por lote en seguimiento de un agricultor.
 * Server Component — LoteRainChart es 'use client' pero puede renderizarse
 * directamente desde aquí sin que este wrapper también lo sea.
 */

import { AlertCircle } from 'lucide-react'
import type { LoteSeguimientoRow, LluviaDiariaLoteRow } from '@/lib/seguimiento-lluvia'
import LoteRainChart from './LoteRainChart'

interface Props {
  lotes: LoteSeguimientoRow[]
  dailyByLote: Map<string, LluviaDiariaLoteRow[]>
}

export default function LotesRainGrid({ lotes, dailyByLote }: Props) {
  if (lotes.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sin lotes en seguimiento de lluvia todavía.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lotes.map(lote => (
        <LoteRainChart key={lote.id} lote={lote} dailyRows={dailyByLote.get(lote.id) ?? []} />
      ))}
    </div>
  )
}
