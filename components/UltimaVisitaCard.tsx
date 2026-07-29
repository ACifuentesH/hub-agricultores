import { ClipboardCheck } from 'lucide-react'
import { formatDateShort } from '@/lib/freshness'

export interface Visita {
  fecha_visita: string | null
  tecnico: string | null
  fase: string | null
  observaciones: string | null
  acuerdos: string | null
  estado_experto: string | null
}

/**
 * Última visita técnica al lote, tal como la registró el técnico en Saturno
 * (tabla `seguimiento`). Es el mismo origen que alimenta la fase del cultivo.
 */
export default function UltimaVisitaCard({ v }: { v: Visita | null }) {
  const dias = v?.fecha_visita
    ? Math.floor((Date.now() - new Date(v.fecha_visita).getTime()) / 86400000)
    : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <ClipboardCheck size={13} /> Última visita
      </p>

      {!v?.fecha_visita ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin visitas registradas en este lote todavía.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {formatDateShort(v.fecha_visita)}
            </span>
            {dias != null && (
              <span className={`text-[11px] ${dias > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`}
              </span>
            )}
          </div>

          {v.tecnico && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Técnico: <span className="font-medium">{v.tecnico}</span>
            </p>
          )}

          {v.estado_experto && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Valoración: <span className="font-medium">{v.estado_experto}</span>
            </p>
          )}

          {v.observaciones && (
            <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Observaciones</p>
              <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                {v.observaciones}
              </p>
            </div>
          )}

          {v.acuerdos && (
            <div className="rounded-md border-l-2 border-green-500 bg-green-50/60 p-2 dark:bg-green-950/25">
              <p className="text-[10px] font-medium uppercase tracking-wider text-green-800 dark:text-green-300">
                Acuerdos
              </p>
              <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                {v.acuerdos}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
