import { Sprout } from 'lucide-react'

export interface ResumenEstados {
  lotes: number
  lotes_muy_buenos: number
  lotes_buenos: number
  lotes_regulares: number
  lotes_malos: number
  lotes_sin_evaluar: number
}

export interface EstadoLotesCardProps {
  r: ResumenEstados | null
  // De los "sin evaluar", cuántos igual tienen actividad de campo reciente
  // (actividades_registro) aunque no tengan visita fenológica formal — para
  // no dar a entender que esos lotes están abandonados.
  sinEvaluarConActividad?: number
}

/**
 * Distribución del estado general del cultivo por lote.
 *
 * El estado lo asigna el técnico en su visita (`edo_gral_cultivo_v`), así que
 * los lotes "sin evaluar" no son un error: son lotes que todavía no ha visitado.
 * Se muestran aparte para no ensuciar la lectura de los que sí tienen dato.
 */
export default function EstadoLotesCard({ r, sinEvaluarConActividad = 0 }: EstadoLotesCardProps) {
  if (!r || r.lotes === 0) return null

  const evaluados = r.lotes_muy_buenos + r.lotes_buenos + r.lotes_regulares + r.lotes_malos
  const filas = [
    { etiqueta: 'Muy bueno', n: r.lotes_muy_buenos, color: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400' },
    { etiqueta: 'Bueno', n: r.lotes_buenos, color: 'bg-green-500', texto: 'text-green-700 dark:text-green-400' },
    { etiqueta: 'Regular', n: r.lotes_regulares, color: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400' },
    { etiqueta: 'Malo', n: r.lotes_malos, color: 'bg-red-500', texto: 'text-red-700 dark:text-red-400' },
  ].filter(f => f.n > 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Sprout size={16} className="text-green-600" />
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Estado de mis lotes
        </p>
      </div>

      {evaluados === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ningún lote evaluado todavía. El estado lo registra el técnico en su visita.
        </p>
      ) : (
        <>
          {/* Barra proporcional: se lee el reparto de un vistazo */}
          <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            {filas.map(f => (
              <div
                key={f.etiqueta}
                className={f.color}
                style={{ width: `${(f.n / evaluados) * 100}%` }}
                title={`${f.etiqueta}: ${f.n}`}
              />
            ))}
          </div>

          <ul className="space-y-1.5">
            {filas.map(f => (
              <li key={f.etiqueta} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span className={`h-2 w-2 rounded-full ${f.color}`} aria-hidden="true" />
                  {f.etiqueta}
                </span>
                <span className={`font-semibold tabular-nums ${f.texto}`}>{f.n}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {r.lotes_sin_evaluar > 0 && (
        <p className="mt-3 border-t border-gray-100 pt-2.5 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {r.lotes_sin_evaluar} lote{r.lotes_sin_evaluar === 1 ? '' : 's'} sin valoración formal
          {sinEvaluarConActividad > 0 && (
            <> — {sinEvaluarConActividad} con actividad de campo registrada (ver en Cultivo)</>
          )}
        </p>
      )}
    </div>
  )
}
