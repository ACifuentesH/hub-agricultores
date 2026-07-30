'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { LluviaDistribucionNormalRow } from '@/lib/seguimiento-lluvia'
import { fmtNum } from '@/lib/seguimiento-lluvia-calc'
import { colorForYear } from '../chartTheme'

const MUESTRA_PEQUENA_UMBRAL = 5

interface EstadisticaAnio {
  anio: string
  n_muestras: number | null
  media: number | null
  desv_estandar: number | null
}

/**
 * Curva de densidad normal de la lluvia acumulada del periodo crítico, una
 * línea por año, con μ/σ/n debajo. Portado de `DistribucionProbabilidadView`
 * en `seguimiento-lluvia-saturno/src/routes/index.tsx` (líneas ~2879-3089),
 * alimentado por `getDistribucionNormalLluvia()` (vista global, sin columna
 * de zona/agricultor).
 */
export default function DistribucionProbabilidadChart({ rows }: { rows: LluviaDistribucionNormalRow[] }) {
  const availableYears = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) s.add(String(r.anio))
    return Array.from(s).sort()
  }, [rows])

  const [selectedYears, setSelectedYears] = useState<string[] | null>(null)
  const activeYears = selectedYears ?? availableYears

  const statsByYear = useMemo(() => {
    const m = new Map<string, EstadisticaAnio>()
    for (const r of rows) {
      const anio = String(r.anio)
      if (m.has(anio)) continue
      m.set(anio, {
        anio,
        n_muestras: r.n_muestras,
        media: r.media,
        desv_estandar: r.desv_estandar,
      })
    }
    return m
  }, [rows])

  const overlay = useMemo(() => {
    const active = new Set(activeYears)
    const byX = new Map<number, Record<string, number | null>>()
    for (const r of rows) {
      const anio = String(r.anio)
      if (!active.has(anio)) continue
      if (!byX.has(r.x)) byX.set(r.x, {})
      byX.get(r.x)![anio] = r.densidad_probabilidad === null || r.densidad_probabilidad === undefined
        ? null
        : Number(r.densidad_probabilidad)
    }
    const xs = Array.from(byX.keys()).sort((a, b) => a - b)
    return xs.map(x => ({ x, ...byX.get(x) }))
  }, [rows, activeYears])

  function toggleYear(year: string) {
    const base = selectedYears ?? availableYears
    const next = base.includes(year) ? base.filter(y => y !== year) : [...base, year]
    if (next.length > 0) setSelectedYears(next)
  }

  return (
    <div className="space-y-4">
      {availableYears.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="pb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Años
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableYears.map((y, i) => {
              const activo = activeYears.includes(y)
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => toggleYear(y)}
                  aria-pressed={activo}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    activo
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-500 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  style={activo ? { backgroundColor: colorForYear(y, i) } : undefined}
                >
                  {y}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          No hay datos de distribución de probabilidad disponibles.
        </div>
      ) : activeYears.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
          Selecciona al menos un año para ver la distribución.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Curva de densidad normal</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Eje X: lluvia acumulada (mm) · Eje Y: densidad de probabilidad
              </p>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlay} margin={{ top: 10, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 600]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Lluvia acumulada (mm)', position: 'insideBottom', offset: -4, fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={56}
                    label={{ value: 'Densidad', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip />
                  {activeYears.map((year, i) => (
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {activeYears.map((year, i) => {
              const stats = statsByYear.get(year)
              if (!stats) return null
              const muestraPequena = stats.n_muestras !== null && stats.n_muestras < MUESTRA_PEQUENA_UMBRAL
              return (
                <div key={year} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorForYear(year, i) }} />
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{year}</span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    μ = {fmtNum(stats.media, 1)}mm · σ = {fmtNum(stats.desv_estandar, 1)}mm · n = {stats.n_muestras ?? '—'}
                  </p>
                  {muestraPequena && (
                    <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                      Muestra pequeña
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
