'use client'

/**
 * Chart de temperatura diaria promedio de la estación asignada al
 * agricultor. Sin equivalente literal en `seguimiento-lluvia-saturno` (ese
 * proyecto no tiene temperatura) — se sigue la misma estética de tarjeta que
 * `LoteRainChart` para que el módulo se vea como un solo sistema.
 *
 * `getClimateSeries()` (lib/clima.ts) no expone valores diarios crudos: solo
 * una serie normalizada 0-1 por día + el mínimo/máximo global del período.
 * Denormalizamos acá para que el eje Y muestre °C reales en vez de 0-1.
 */

import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ClimateSeries } from '@/lib/clima'
import { fmtNum } from '@/lib/seguimiento-lluvia-calc'
import { TEMP_LINE_COLOR } from './chartTheme'

interface Props {
  series: ClimateSeries
}

function denormalize(v: number, min: number, max: number): number {
  if (max === min) return min
  return min + v * (max - min)
}

export default function TemperatureChart({ series }: Props) {
  const n = series.tempSeries.length
  const data = series.tempSeries.map((v, i) => {
    const offset = n - 1 - i
    return {
      label: offset === 0 ? 'Hoy' : `-${offset}d`,
      temp_c: Number(denormalize(v, series.tempMin, series.tempMax).toFixed(1)),
    }
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Temperatura</h3>
        <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          Promedio diario de la estación asignada
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          Sin datos de temperatura todavía.
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 14 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={34} unit="°C" />
              <Tooltip content={<TemperaturaTooltip />} />
              <Line
                type="monotone"
                dataKey="temp_c"
                name="Temperatura"
                stroke={TEMP_LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 1.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function TemperaturaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number | string | null; color?: string }>
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]
  if (p.value === null || p.value === undefined) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 font-semibold text-gray-800 dark:text-gray-100">{label}</div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="text-gray-500 dark:text-gray-400">Temperatura</span>
        <span className="ml-auto pl-3 font-medium tabular-nums text-gray-800 dark:text-gray-100">
          {fmtNum(Number(p.value), 1)}°C
        </span>
      </div>
    </div>
  )
}
