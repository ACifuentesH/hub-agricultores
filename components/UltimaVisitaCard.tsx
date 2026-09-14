import { Sprout } from 'lucide-react'
import { formatDateShort } from '@/lib/freshness'

export interface Visita {
  fecha_visita: string | null
  tecnico: string | null
  fase: string | null
  fase_fecha?: string | null
  fase_fuente?: string | null
  observaciones: string | null
  acuerdos: string | null
  estado_experto: string | null
  ultima_actividad_fecha?: string | null
  ultima_actividad_tipo?: string | null
  ultima_actividad_comentario?: string | null
  ultima_actividad_tecnico?: string | null
}

/**
 * Última acción agronómica registrada en el lote: la visita técnica formal
 * (tabla `seguimiento`) o la actividad de campo más reciente
 * (`actividades_registro` — control de plagas, fertilización, estimación de
 * rendimiento, aplicaciones con dron, etc.), la que sea más nueva de las
 * dos. No siempre es una "visita" en el sentido estricto, de ahí el nombre.
 */
export default function UltimaVisitaCard({ v }: { v: Visita | null }) {
  const visitaMs = v?.fecha_visita ? new Date(v.fecha_visita).getTime() : null
  const actividadMs = v?.ultima_actividad_fecha ? new Date(v.ultima_actividad_fecha).getTime() : null
  const usarActividad = actividadMs != null && (visitaMs == null || actividadMs > visitaMs)

  const fecha = usarActividad ? v?.ultima_actividad_fecha : v?.fecha_visita
  const dias = fecha ? Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <Sprout size={13} /> Última acción agronómica
      </p>

      {!fecha ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Todavía no hay registros de campo para este lote.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {formatDateShort(fecha)}
            </span>
            {dias != null && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`}
              </span>
            )}
          </div>

          {usarActividad ? (
            <>
              {v?.ultima_actividad_tipo && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Tipo: <span className="font-medium">{v.ultima_actividad_tipo}</span>
                </p>
              )}
              {v?.ultima_actividad_tecnico && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Técnico: <span className="font-medium">{v.ultima_actividad_tecnico}</span>
                </p>
              )}
              {v?.ultima_actividad_comentario && (
                <p className="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  {v.ultima_actividad_comentario}
                </p>
              )}
            </>
          ) : (
            <>
              {v?.tecnico && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Técnico: <span className="font-medium">{v.tecnico}</span>
                </p>
              )}
              {v?.observaciones && (
                <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Observaciones</p>
                  <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                    {v.observaciones}
                  </p>
                </div>
              )}
              {v?.acuerdos && (
                <div className="rounded-md border-l-2 border-green-500 bg-green-50/60 p-2 dark:bg-green-950/25">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-green-800 dark:text-green-300">
                    Acuerdos
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                    {v.acuerdos}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
