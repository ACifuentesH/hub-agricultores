import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'

export default async function SueloPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)

  if (scope.isMaster && !scope.agricultorKey) {
    const agricultores = await listAgricultores()
    return (
      <MasterEmptyState
        title="Análisis de Suelo"
        subtitle="Vista master — selecciona un agricultor para ver sus condiciones de suelo e insumos."
        agricultores={agricultores}
        selected={null}
      />
    )
  }

  const agricultorKey = scope.agricultorKey ?? ''
  const supabase = await createClient()

  const [{ data: lotes }, agricultores] = await Promise.all([
    supabase
      .from('lote')
      .select('lote_id, nombre_lote, codigo_lote, compactacion, segmentacion_particulas, drenajes_internos, condicion_drenaje')
      .eq('AgricultorKey', agricultorKey),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
  ])

  const loteIds = lotes?.map(l => l.lote_id) ?? []

  const { data: insumos } = loteIds.length
    ? await supabase
        .from('producto_registro')
        .select('lote_v, nombre_producto, categoria_producto, dosis_real_ha, dosis_recomendada_v, ha_aplicadas, fecha_registro')
        .in('lote_v', lotes?.map(l => l.nombre_lote) ?? [])
        .order('fecha_registro', { ascending: false })
    : { data: [] }

  type InsumoRow = NonNullable<typeof insumos>[number]
  const insumosByLote = (insumos ?? []).reduce<Record<string, InsumoRow[]>>((acc, ins) => {
    if (!ins) return acc
    const k = ins.lote_v ?? 'Sin lote'
    if (!acc[k]) acc[k] = []
    acc[k]!.push(ins)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Análisis de Suelo</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Condiciones del suelo e insumos aplicados por lote.
            {scope.isMaster && scope.agropecuariaName && (
              <span className="ml-2 text-green-700 dark:text-green-400 font-medium">
                · {scope.agropecuariaName}
              </span>
            )}
          </p>
        </div>
        {scope.isMaster && (
          <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
        )}
      </div>

      {lotes?.map(l => (
        <div key={l.lote_id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">{l.nombre_lote}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">{l.codigo_lote}</p>
            </div>
            <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>Compactación: <b className="text-gray-700 dark:text-gray-200">{l.compactacion ?? '—'}</b></span>
              <span>Drenaje: <b className="text-gray-700 dark:text-gray-200">{l.condicion_drenaje ?? '—'}</b></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-right">Dosis real (ha)</th>
                  <th className="px-4 py-3 text-right">Dosis recom. (ha)</th>
                  <th className="px-4 py-3 text-right">Ha aplicadas</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(insumosByLote[l.nombre_lote] ?? []).slice(0, 10).map((ins, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{ins?.nombre_producto}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                        {ins?.categoria_producto}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{ins?.dosis_real_ha?.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{ins?.dosis_recomendada_v?.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{ins?.ha_aplicadas}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500">
                      {ins?.fecha_registro ? new Date(ins.fecha_registro).toLocaleDateString('es-VE') : '—'}
                    </td>
                  </tr>
                ))}
                {!(insumosByLote[l.nombre_lote]?.length) && (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400 dark:text-gray-500 text-sm">Sin registros de insumos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
