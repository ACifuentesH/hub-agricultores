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
  avance_pct?: number | null
  rendimiento_kg_ha?: number | null
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
  const tipo = usarActividad ? v?.ultima_actividad_tipo : null
  const tecnico = usarActividad ? v?.ultima_actividad_tecnico : v?.tecnico
  const nota = usarActividad ? v?.ultima_actividad_comentario : (v?.acuerdos || v?.observaciones)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          <Sprout size={13} />
        </span>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Última acción agronómica
        </p>
      </div>

      {!fecha ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Todavía no hay registros de campo para este lote.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {formatDateShort(fecha)}
            </span>
            {tipo && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                {tipo}
              </span>
            )}
          </div>

          {tecnico && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Técnico: <span className="font-medium">{tecnico}</span>
            </p>
          )}

          {nota && (
            <div className="rounded-md border-l-2 border-green-500 bg-green-50/60 p-2 dark:bg-green-950/25">
              <p className="line-clamp-3 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                {nota}
              </p>
            </div>
          )}

          {v?.rendimiento_kg_ha != null && (
            <div className="border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Rendimiento real: <span className="font-semibold text-gray-800 dark:text-gray-100">{v.rendimiento_kg_ha.toLocaleString('es-VE')} kg/ha</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
