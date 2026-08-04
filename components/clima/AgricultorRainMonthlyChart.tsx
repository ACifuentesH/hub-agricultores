'use client'

/**
 * Lluvia mensual del agricultor (promedio entre sus lotes), un año por
 * línea, con el año actual partido en tramo sólido (real) + punteado
 * (pronóstico). Portado de la sección "mensual" de `GraficasView` en
 * `seguimiento-lluvia-saturno/src/routes/index.tsx` (líneas ~2055-2154);
 * la agregación real/pronóstico vive en `./prediccionMensual.ts`.
 */

import { ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { LluviaMensualLoteRow, PrediccionLluviaLoteRow, LluviaDiariaEstacionRow } from '@/lib/seguimiento-lluvia'
import { fmtNum } from '@/lib/seguimiento-lluvia-calc'
import { colorForYear } from './chartTheme'
import {
  ANIO_ACTUAL,
  agregarPrediccionLotesPorMes,
  buildPrediccionOverlaySemanal,
  esBajaConfianza,
} from './prediccionMensual'

interface Props {
  mensual: LluviaMensualLoteRow[]
  prediccion: PrediccionLluviaLoteRow[]
  /** Lluvia diaria de las estaciones del agricultor — desglosa cada mes en 4 puntos semanales. */
  diaria: LluviaDiariaEstacionRow[]
}

export default function AgricultorRainMonthlyChart({ mensual, prediccion, diaria }: Props) {
  const prediccionActual = agregarPrediccionLotesPorMes(prediccion)

  // Los lotes de un mismo agricultor reciben básicamente la misma lluvia,
  // así que promediarlos entre sí mes a mes deja el diagrama limpio.
  const sums = new Map<string, { sum: number; count: number }>()
  for (const r of mensual) {
    const entry = sums.get(r.mes) ?? { sum: 0, count: 0 }
    entry.sum += Number(r.lluvia_mm_mes) || 0
    entry.count += 1
    sums.set(r.mes, entry)
  }
  const monthlyAvgPoints = Array.from(sums.entries()).map(([mes, v]) => ({
    mes,
    value: v.count > 0 ? v.sum / v.count : 0,
  }))

  const overlay = buildPrediccionOverlaySemanal(monthlyAvgPoints, prediccionActual, diaria)
  const historicalYears = overlay.years.filter(y => y !== ANIO_ACTUAL)
  const tieneAnioActual = overlay.years.includes(ANIO_ACTUAL)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Lluvia mensual</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Promedio entre tus lotes, un año por línea
          </p>
        </div>
        {overlay.years.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            {overlay.years.map((year, i) => (
              <span key={year} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForYear(year, i) }} />
                {year}
              </span>
            ))}
          </div>
        )}
      </div>

      {overlay.years.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          Sin datos de lluvia mensual todavía.
        </div>
      ) : (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={overlay.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  // Un punto cada semana (48 en total) para poder pararse en
                  // cualquiera, pero solo se rotula la primera semana de cada
                  // mes — mismo aspecto de 12 etiquetas que tenía el gráfico
                  // mensual.
                  tickFormatter={(value: string) => (value.endsWith('S1') ? value.slice(0, 3) : '')}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={44}
                  label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <Tooltip content={<PrediccionTooltip />} />
                {historicalYears.map((year, i) => (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={year}
                    name={year}
                    stroke={colorForYear(year, i)}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
                {tieneAnioActual && (
                  <Line
                    type="monotone"
                    dataKey="actual_real"
                    name={ANIO_ACTUAL}
                    stroke={colorForYear(ANIO_ACTUAL, 0)}
                    strokeWidth={2}
                    dot={renderPrediccionDot}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
                {tieneAnioActual && (
                  <Line
                    type="monotone"
                    dataKey="actual_pronostico"
                    name={`${ANIO_ACTUAL} (pronóstico)`}
                    stroke={colorForYear(ANIO_ACTUAL, 0)}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={renderPrediccionDot}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {tieneAnioActual && (
            <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
              Línea sólida: dato real. Línea punteada: pronóstico de {ANIO_ACTUAL}. Punto rojo con
              &quot;!&quot;: mes con hueco de datos.
            </p>
          )}
          {esBajaConfianza(prediccionActual) && (
            <p className="mt-1 rounded border border-red-300/50 bg-red-50 px-2 py-1 text-[10px] leading-snug text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              Pronóstico de baja confianza — pocos meses de referencia disponibles este año.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// Marcador distinto (círculo de alerta) para los meses con hueco de datos —
// el punto sí tiene un valor numérico (el pronóstico), pero viene de una
// lectura poco confiable, y eso debe verse en el gráfico, no solo en el
// tooltip.
export function renderPrediccionDot(props: {
  cx?: number
  cy?: number
  payload?: Record<string, unknown>
  stroke?: string
}) {
  const { cx, cy, payload, stroke } = props
  if (cx === undefined || cy === undefined) return <g />
  if (payload?.actual_es_excluido === true) {
    return (
      <g key={`dot-${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#fff">
          !
        </text>
      </g>
    )
  }
  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={stroke} />
}

export function PrediccionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string | null
    color?: string
    dataKey?: string | number
    payload?: Record<string, unknown>
  }>
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  const items = payload.filter(p => {
    if (p.value === null || p.value === undefined) return false
    // El ancla de "actual_pronostico" en el último mes real repite el mismo
    // valor que "actual_real" — no hace falta mostrarlo dos veces.
    const key = String(p.dataKey ?? p.name ?? '')
    if (key === 'actual_pronostico') {
      const real = (p.payload ?? {})['actual_real']
      if (real !== null && real !== undefined && Number(real) === Number(p.value)) return false
    }
    return true
  })
  if (items.length === 0) return null
  return (
    <div className="max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1.5 font-semibold text-gray-800 dark:text-gray-100">{String(label)}</div>
      <div className="space-y-1.5">
        {items.map(p => {
          const key = String(p.dataKey ?? p.name ?? '')
          const row = p.payload ?? {}
          const esPronostico = key === 'actual_pronostico'
          const esActual = key === 'actual_real' || esPronostico
          const nombre = esActual ? (esPronostico ? `${ANIO_ACTUAL} (pronóstico)` : ANIO_ACTUAL) : p.name
          return (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={
                    esPronostico
                      ? 'h-2 w-2 shrink-0 rounded-full border border-dashed'
                      : 'h-2 w-2 shrink-0 rounded-full'
                  }
                  style={esPronostico ? { borderColor: p.color } : { backgroundColor: p.color }}
                />
                <span className="text-gray-500 dark:text-gray-400">{nombre}</span>
                <span className="ml-auto pl-3 font-medium tabular-nums text-gray-800 dark:text-gray-100">
                  {fmtNum(Number(p.value), 1)} mm
                </span>
              </div>
              {esActual && row.actual_es_excluido === true && (
                <p className="text-[10px] leading-snug text-red-600 dark:text-red-400">
                  Dato de sensor no confiable este mes — se usó pronóstico en su lugar.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
