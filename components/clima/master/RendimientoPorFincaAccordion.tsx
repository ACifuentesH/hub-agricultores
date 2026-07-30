'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Search } from 'lucide-react'
import type { LoteSeguimientoRow } from '@/lib/seguimiento-lluvia'
import { fmtNum, daysPct, estadoLlenado, estadoLlenadoAgregado, rendimientoCalculado } from '@/lib/seguimiento-lluvia-calc'
import EstadoLlenadoBadge from './EstadoLlenadoBadge'

interface Grupo {
  finca: string
  lotes: LoteSeguimientoRow[]
}

/**
 * Rendimiento calculado por finca, solo para lotes que ya cerraron su fase de
 * llenado ("Cierre de llenado" — 90%+ de los días del periodo crítico).
 * Portado de `RendimientoPorFincaView` en
 * `seguimiento-lluvia-saturno/src/routes/index.tsx` (líneas ~708-938).
 *
 * "Rend. dron" y "Rend. real" quedan como "—" literal: el proyecto original
 * tampoco tiene esas fuentes conectadas ("Módulo en construcción" en su
 * propio texto) — no es un hueco que este componente deba resolver.
 */
export default function RendimientoPorFincaAccordion({ lotes }: { lotes: LoteSeguimientoRow[] }) {
  const [search, setSearch] = useState('')

  const cerrados = useMemo(
    () => lotes.filter(r => estadoLlenado(daysPct(r.dias_transcurridos, r.duracion_dias)) === 'Cierre de llenado'),
    [lotes]
  )

  const totalLotesPorFinca = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of lotes) {
      const k = r.unidad_produccion ?? 'Sin finca'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [lotes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cerrados
    return cerrados.filter(r => `${r.unidad_produccion ?? ''} ${r.lote ?? ''}`.toLowerCase().includes(q))
  }, [cerrados, search])

  const grupos = useMemo(() => {
    const m = new Map<string, Grupo>()
    for (const r of filtered) {
      const k = r.unidad_produccion ?? 'Sin finca'
      if (!m.has(k)) m.set(k, { finca: k, lotes: [] })
      m.get(k)!.lotes.push(r)
    }
    return Array.from(m.values()).sort((a, b) => a.finca.localeCompare(b.finca))
  }, [filtered])

  // Promedio global: solo lotes de agricultores con TODOS sus lotes en
  // cierre de llenado, para no mezclar un rendimiento definitivo con uno que
  // todavía puede subir.
  const rendimientoGlobal = useMemo(() => {
    const porAgricultor = new Map<string, LoteSeguimientoRow[]>()
    for (const r of lotes) {
      const key = r.agricultor ?? 'Sin agricultor'
      if (!porAgricultor.has(key)) porAgricultor.set(key, [])
      porAgricultor.get(key)!.push(r)
    }
    let sum = 0
    let count = 0
    let agricultoresCerrados = 0
    for (const grupo of porAgricultor.values()) {
      const todosCerrados =
        grupo.length > 0 &&
        grupo.every(r => estadoLlenado(daysPct(r.dias_transcurridos, r.duracion_dias)) === 'Cierre de llenado')
      if (!todosCerrados) continue
      agricultoresCerrados += 1
      for (const r of grupo) {
        const y = rendimientoCalculado(r.lluvia_acumulada_mm)
        if (y !== null) {
          sum += y
          count += 1
        }
      }
    }
    return { avg: count > 0 ? sum / count : null, agricultores: agricultoresCerrados, lotes: count }
  }, [lotes])

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
        <div className="flex items-start gap-2">
          <BarChart3 size={16} className="mt-0.5 shrink-0 text-green-700 dark:text-green-400" />
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200">Módulo en construcción</p>
            <p className="mt-0.5">
              Rend. calculado usa la fórmula de regresión (y = -7.0744E-05x² + 0.034128085x +
              1.288531493, R² = 0.3599, x = mm de lluvia acumulada del lote). Las columnas Rend.
              dron y Rend. real se conectarán después contra su fuente de datos. Solo se listan
              lotes que ya cerraron su fase de llenado — el rendimiento de un lote a mitad de
              llenado todavía puede subir.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-lg bg-green-50 p-2.5 text-green-700 dark:bg-green-950/40 dark:text-green-400">
            <BarChart3 size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Rendimiento calculado promedio</p>
            <p className="mt-0.5 text-xl font-bold text-gray-800 dark:text-gray-100">
              {rendimientoGlobal.avg === null ? '—' : fmtNum(rendimientoGlobal.avg, 2)}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {rendimientoGlobal.agricultores > 0
                ? `Solo agricultores con todos los lotes en cierre de llenado (${rendimientoGlobal.agricultores} agricultor(es), ${rendimientoGlobal.lotes} lote(s))`
                : 'Todavía ningún agricultor tiene todos sus lotes en cierre de llenado'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 dark:border-gray-700">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por finca o lote..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
          />
        </div>
        <span className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {grupos.length} finca(s) · {filtered.length} lote(s)
        </span>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          No hay fincas con lotes en cierre de llenado que coincidan.
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g, idx) => {
            const totalHa = g.lotes.reduce((a, r) => a + (Number(r.ha_a_cosechar) || 0), 0)
            const rendimientoAcumulado =
              totalHa > 0
                ? g.lotes.reduce((a, r) => {
                    const y = rendimientoCalculado(r.lluvia_acumulada_mm)
                    return a + (y !== null ? y * (Number(r.ha_a_cosechar) || 0) : 0)
                  }, 0) / totalHa
                : null
            const estadoGrupo = estadoLlenadoAgregado(
              g.lotes.map(r => daysPct(r.dias_transcurridos, r.duracion_dias))
            )

            return (
              <details
                key={g.finca}
                open={idx < 3}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{g.finca}</span>
                  <EstadoLlenadoBadge estado={estadoGrupo} />
                  {rendimientoAcumulado !== null && (
                    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                      Rend. acumulado {fmtNum(rendimientoAcumulado, 2)}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    {g.lotes.length}/{totalLotesPorFinca.get(g.finca) ?? g.lotes.length} lotes completados
                    <span>{fmtNum(totalHa, 2)} ha</span>
                    <span className="transition-transform group-open:rotate-180">▾</span>
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Lote</th>
                        <th className="px-3 py-2 text-left font-medium">Estado</th>
                        <th className="px-3 py-2 text-right font-medium">Rend. dron</th>
                        <th className="px-3 py-2 text-right font-medium">Rend. calculado</th>
                        <th className="px-3 py-2 text-right font-medium">Rend. real</th>
                        <th className="px-3 py-2 text-right font-medium">Ha</th>
                        <th className="px-3 py-2 text-right font-medium">Lluvia (mm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {g.lotes.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/60">
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                            {r.lote ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            <EstadoLlenadoBadge
                              estado={estadoLlenado(daysPct(r.dias_transcurridos, r.duracion_dias))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">—</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtNum(rendimientoCalculado(r.lluvia_acumulada_mm), 2)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">—</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ha_a_cosechar, 2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.lluvia_acumulada_mm, 1)}</td>
                        </tr>
                      ))}
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
