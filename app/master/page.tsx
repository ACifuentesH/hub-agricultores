import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { Users, Wheat, TrendingUp } from 'lucide-react'

export default async function MasterPage() {
  await requireRole('master')
  const supabase = createServiceClient()

  const { data: agricultores } = await supabase
    .from('agropecuaria')
    .select('AgricultorKey, nombre_agropecuaria, cedula, correo_electronico')
    .order('nombre_agropecuaria')

  const { data: rendimientos } = await supabase
    .from('Rendimiento')
    .select('AgricultorKey, hectareas_totales, rendimiento')

  const { data: allLotes } = await supabase
    .from('lote')
    .select('AgricultorKey, ha_sembradas, ha_perdidas, ha_cosechadas')

  const rendByKey = Object.fromEntries(
    (rendimientos ?? []).map(r => [r.AgricultorKey, r])
  )

  const lotesByKey = (allLotes ?? []).reduce<Record<string, typeof allLotes>>((acc, l) => {
    if (!l?.AgricultorKey) return acc
    if (!acc[l.AgricultorKey]) acc[l.AgricultorKey] = []
    acc[l.AgricultorKey]!.push(l)
    return acc
  }, {})

  const totalHaSembradas = (allLotes ?? []).reduce((s, l) => s + parseFloat(l?.ha_sembradas ?? '0'), 0)
  const totalHaPerdidas = (allLotes ?? []).reduce((s, l) => s + parseFloat(l?.ha_perdidas ?? '0'), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Vista Master — Todos los Agricultores</h1>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
          <Users className="text-green-600" size={28} />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total agricultores</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{agricultores?.length ?? 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
          <Wheat className="text-yellow-500" size={28} />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ha sembradas totales</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalHaSembradas.toFixed(0)} ha</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
          <TrendingUp className="text-red-500" size={28} />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ha perdidas totales</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalHaPerdidas.toFixed(0)} ha</p>
          </div>
        </div>
      </div>

      {/* Tabla de agricultores */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Agricultores del programa</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Agricultor</th>
                <th className="px-4 py-3 text-left">Cédula</th>
                <th className="px-4 py-3 text-left">Correo</th>
                <th className="px-4 py-3 text-right">Lotes</th>
                <th className="px-4 py-3 text-right">Ha sembradas</th>
                <th className="px-4 py-3 text-right">Ha perdidas</th>
                <th className="px-4 py-3 text-right">Rend. (t/ha)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agricultores?.map(a => {
                const lotes = lotesByKey[a.AgricultorKey] ?? []
                const haSem = lotes.reduce((s, l) => s + parseFloat(l?.ha_sembradas ?? '0'), 0)
                const haPer = lotes.reduce((s, l) => s + parseFloat(l?.ha_perdidas ?? '0'), 0)
                const rend = rendByKey[a.AgricultorKey]

                return (
                  <tr key={a.AgricultorKey} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{a.nombre_agropecuaria}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.cedula ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{a.correo_electronico ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{lotes.length}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{haSem.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{haPer.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700 dark:text-green-400">{rend?.rendimiento?.toFixed(2) ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
