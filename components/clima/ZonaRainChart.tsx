'use client'

/**
 * Lluvia mensual promedio de UNA zona climática, un año por línea, con el
 * año actual partido en tramo sólido (real) + punteado (pronóstico). Portado
 * de `ZonaClimaChart` en `seguimiento-lluvia-saturno/src/routes/index.tsx`
 * (líneas ~2223-2366), pero para una sola zona a la vez — el original
 * renderizaba el par Oriente/Occidente lado a lado con un `yDomain`
 * compartido para que ambos ejes fueran comparables; acá no aplica porque
 * solo hay una zona, así que el eje Y se autoescala.
 *
 * `getLluviaMensualZona(zona)` / `getPrediccionZona(zona)` ya filtran por
 * zona server-side, así que a diferencia del original no hace falta volver
 * a filtrar `rows`/`prediccion` por `r.zona === zona` acá.
 */

import { ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { LluviaMensualZonaRow, PrediccionLluviaZonaRow } from '@/lib/seguimiento-lluvia'
import { colorForYear } from './chartTheme'
import {
  ANIO_ACTUAL,
  buildPrediccionOverlay,
  esBajaConfianza,
  prediccionMesDeZona,
} from './prediccionMensual'
import { PrediccionTooltip, renderPrediccionDot } from './AgricultorRainMonthlyChart'

interface Props {
  zona: string
  mensual: LluviaMensualZonaRow[]
  prediccion: PrediccionLluviaZonaRow[]
}

export default function ZonaRainChart({ zona, mensual, prediccion }: Props) {
  const points = mensual.map(r => ({
    mes: r.mes,
    value: r.lluvia_mm_promedio === null || r.lluvia_mm_promedio === undefined ? 0 : Number(r.lluvia_mm_promedio),
  }))
  const actual = prediccion.map(prediccionMesDeZona)

  const overlay = buildPrediccionOverlay(points, actual)
  const historicalYears = overlay.years.filter(y => y !== ANIO_ACTUAL)
  const tieneAnioActual = overlay.years.includes(ANIO_ACTUAL)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{zona}</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Lluvia mensual promedio de la zona</p>
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

      {points.length === 0 && actual.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          Sin datos para {zona}.
        </div>
      ) : (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={overlay.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9 }}
                  interval={0}
                  tickFormatter={(value: string) => value.slice(0, 3)}
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
                    dot={{ r: 3 }}
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
              &quot;!&quot;: mes con hueco de datos (pocas estaciones reportando).
            </p>
          )}
          {esBajaConfianza(actual) && (
            <p className="mt-1 rounded border border-red-300/50 bg-red-50 px-2 py-1 text-[10px] leading-snug text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              Pronóstico de baja confianza — pocos meses de referencia disponibles este año.
            </p>
          )}
        </>
      )}
    </div>
  )
}
