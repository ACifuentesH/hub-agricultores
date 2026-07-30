'use client'

import { useMemo, useState } from 'react'
import { Search, User } from 'lucide-react'
import type { LoteSeguimientoRow } from '@/lib/seguimiento-lluvia'
import { fmtNum, effectiveRainPct, daysPct, estadoLlenado, estadoLlenadoAgregado } from '@/lib/seguimiento-lluvia-calc'
import EstadoLlenadoBadge from './EstadoLlenadoBadge'
import ProgressBar from './ProgressBar'

interface Grupo {
  nombre: string
  lotes: LoteSeguimientoRow[]
}

/**
 * Acordeón agrupado por agricultor: un `<details>` por agricultor con el
 * estado agregado en la cabecera y el detalle de cada lote adentro. Portado
 * de `PorAgricultorView` en `seguimiento-lluvia-saturno/src/routes/index.tsx`
 * (líneas ~541-706). Se usa `<details>/<summary>` nativo en vez del
 * Accordion de Radix del proyecto original (no se agregan dependencias
 * nuevas a este repo).
 */
export default function PorAgricultorAccordion({ lotes }: { lotes: LoteSeguimientoRow[] }) {
  const [search, setSearch] = useState('')

  const grupos = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? lotes.filter(r =>
          `${r.agricultor ?? ''} ${r.lote ?? ''} ${r.unidad_produccion ?? ''}`
            .toLowerCase()
            .includes(q)
        )
      : lotes

    const m = new Map<string, Grupo>()
    for (const r of filtered) {
      const key = r.agricultor ?? 'Sin agricultor'
      if (!m.has(key)) m.set(key, { nombre: key, lotes: [] })
      m.get(key)!.lotes.push(r)
    }
    return Array.from(m.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [lotes, search])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 dark:border-gray-700">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por agricultor, lote o unidad..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
          />
        </div>
        <span className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {grupos.length} agricultor(es)
        </span>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          No hay agricultores que coincidan.
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g, idx) => {
            const totalHa = g.lotes.reduce((a, r) => a + (Number(r.ha_a_cosechar) || 0), 0)
            const totalLluvia = g.lotes.reduce((a, r) => a + (Number(r.lluvia_acumulada_mm) || 0), 0)
            const estadoGrupo = estadoLlenadoAgregado(
              g.lotes.map(r => daysPct(r.dias_transcurridos, r.duracion_dias))
            )

            return (
              <details
                key={g.nombre}
                open={idx < 3}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <User size={15} className="shrink-0 text-green-700 dark:text-green-400" />
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{g.nombre}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {g.lotes.length} lote(s) · {fmtNum(totalHa, 2)} ha · {fmtNum(totalLluvia, 1)} mm
                  </span>
                  <EstadoLlenadoBadge estado={estadoGrupo} />
                  <span className="ml-auto shrink-0 text-xs text-gray-400 transition-transform group-open:rotate-180 dark:text-gray-500">
                    ▾
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Unidad</th>
                        <th className="px-3 py-2 text-left font-medium">Lote</th>
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
                      {g.lotes.map(r => {
                        const pctDias = daysPct(r.dias_transcurridos, r.duracion_dias)
                        return (
                          <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                              {r.unidad_produccion ?? '—'}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                              {r.lote ?? '—'}
                            </td>
                            <td className="px-3 py-2"><ProgressBar pct={pctDias} /></td>
                            <td className="px-3 py-2"><ProgressBar pct={effectiveRainPct(r)} /></td>
                            <td className="px-3 py-2">
                              <EstadoLlenadoBadge estado={estadoLlenado(pctDias)} />
                            </td>
                            <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-300">
                              {r.racha_actual_dias_secos ?? '—'}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-300">
                              {r.racha_maxima_dias_secos ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtNum(r.ha_a_cosechar, 2)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmtNum(r.lluvia_acumulada_mm, 1)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
