'use client'

import { useMemo, useState } from 'react'
import { Search, User } from 'lucide-react'
import type { LoteSeguimientoRow } from '@/lib/seguimiento-lluvia'
import { fmtNum, effectiveRainPct, daysPct, estadoLlenado } from '@/lib/seguimiento-lluvia-calc'
import EstadoLlenadoBadge from './EstadoLlenadoBadge'
import ProgressBar from './ProgressBar'

type SortKey = 'dias' | 'lluvia'

/**
 * Ranking global de lotes de TODOS los agricultores, ordenado por avance de
 * días de la fase de llenado (y luego por % de lluvia). Portado de
 * `GlobalAgricultoresView` en `seguimiento-lluvia-saturno/src/routes/index.tsx`
 * (líneas ~940-1076). Solo debe recibir datos ya resueltos por
 * `getTodosLosLotesGlobal()` — no filtra por agricultor, así que no debe
 * usarse fuera del contexto master.
 */
export default function GlobalAgricultoresTable({ lotes }: { lotes: LoteSeguimientoRow[] }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('dias')

  const rankedRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? lotes.filter(r =>
          `${r.agricultor ?? ''} ${r.unidad_produccion ?? ''} ${r.lote ?? ''}`
            .toLowerCase()
            .includes(q)
        )
      : lotes

    return [...list].sort((a, b) => {
      const daysA = daysPct(a.dias_transcurridos, a.duracion_dias) ?? -1
      const daysB = daysPct(b.dias_transcurridos, b.duracion_dias) ?? -1
      const rainA = effectiveRainPct(a) ?? -1
      const rainB = effectiveRainPct(b) ?? -1

      if (sortBy === 'dias') {
        if (daysB !== daysA) return daysB - daysA
        if (rainB !== rainA) return rainB - rainA
      } else {
        if (rainB !== rainA) return rainB - rainA
        if (daysB !== daysA) return daysB - daysA
      }
      return `${a.agricultor ?? ''} ${a.lote ?? ''}`.localeCompare(`${b.agricultor ?? ''} ${b.lote ?? ''}`)
    })
  }, [lotes, search, sortBy])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 dark:border-gray-700">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar agricultor, finca o lote..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
          {(['dias', 'lluvia'] as SortKey[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              aria-pressed={sortBy === key}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                sortBy === key
                  ? 'bg-white text-green-700 shadow-sm dark:bg-gray-900 dark:text-green-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {key === 'dias' ? 'Ordenar por días %' : 'Ordenar por lluvia %'}
            </button>
          ))}
        </div>
        <span className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {rankedRows.length} lote(s)
        </span>
      </div>

      {rankedRows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          No hay lotes que coincidan.
        </div>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="w-10 px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Agricultor</th>
                <th className="px-3 py-2 text-left font-medium">Finca</th>
                <th className="w-32 px-3 py-2 text-left font-medium">Lote</th>
                <th className="px-3 py-2 text-left font-medium">Zona</th>
                <th className="w-40 px-3 py-2 text-left font-medium">Días %</th>
                <th className="w-40 px-3 py-2 text-left font-medium">Lluvia %</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Racha seca actual</th>
                <th className="px-3 py-2 text-left font-medium">Racha seca máx.</th>
                <th className="px-3 py-2 text-right font-medium">Ha</th>
                <th className="px-3 py-2 text-right font-medium">Lluvia (mm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rankedRows.map((r, i) => {
                const pctDias = daysPct(r.dias_transcurridos, r.duracion_dias)
                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
                    <td className="px-3 py-2 tabular-nums text-gray-400 dark:text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <User size={13} className="shrink-0 text-green-700 dark:text-green-400" />
                        <span className="truncate">{r.agricultor ?? '—'}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500 dark:text-gray-400">
                      {r.unidad_produccion ?? '—'}
                    </td>
                    <td className="max-w-[140px] px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{r.lote ?? '—'}</span>
                        {!r.station_id && (
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            sin estación
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.zona ?? '—'}</td>
                    <td className="px-3 py-2"><ProgressBar pct={pctDias} /></td>
                    <td className="px-3 py-2"><ProgressBar pct={effectiveRainPct(r)} /></td>
                    <td className="px-3 py-2"><EstadoLlenadoBadge estado={estadoLlenado(pctDias)} /></td>
                    <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-300">
                      {r.racha_actual_dias_secos ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-300">
                      {r.racha_maxima_dias_secos ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ha_a_cosechar, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.lluvia_acumulada_mm, 1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
