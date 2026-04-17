import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import FinanzasCharts from '@/components/charts/FinanzasCharts'

export default async function FinanzasPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: unidades } = await supabase
    .from('unidad_produccion')
    .select(`
      codigo_up, nombre,
      costo_total_semillas, costo_total_agroquimicos, costo_total_fertilizantes, costo_total_enmienda,
      costo_total_mecanizacion, costo_total_operaciones, costo_total_financiamiento,
      costo_total, ingreso_venta, utilidad_total, utilidad_agricultor,
      numero_total_ha_unidad, rendimiento_ha, valor_meta_rend_ha, precio_maiz_usd_ton,
      ha_perdidas_acumuladas
    `)
    .in('agropecuaria_id', await getAgroId(supabase, profile.agricultor_key ?? ''))

  const totales = {
    inversion: unidades?.reduce((s, u) => s + parseFloat(String(u.costo_total ?? '0')), 0) ?? 0,
    ingreso: unidades?.reduce((s, u) => s + parseFloat(String(u.ingreso_venta ?? '0')), 0) ?? 0,
    utilidad: unidades?.reduce((s, u) => s + parseFloat(String(u.utilidad_total ?? '0')), 0) ?? 0,
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Finanzas (P&L)</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Inversión total" value={formatUSD(totales.inversion)} color="text-red-600" />
        <SummaryCard label="Ingreso venta" value={formatUSD(totales.ingreso)} color="text-blue-600" />
        <SummaryCard label="Utilidad total" value={formatUSD(totales.utilidad)} color={totales.utilidad >= 0 ? 'text-green-700' : 'text-red-600'} />
      </div>

      {unidades?.map(u => (
        <div key={u.codigo_up} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">{u.nombre}</h3>
          </div>
          <div className="p-5 space-y-5">
            {/* Cost breakdown */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Desglose de costos</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Semillas', val: u.costo_total_semillas },
                  { label: 'Agroquímicos', val: u.costo_total_agroquimicos },
                  { label: 'Fertilizantes', val: u.costo_total_fertilizantes },
                  { label: 'Enmienda', val: u.costo_total_enmienda },
                  { label: 'Mecanización', val: String(u.costo_total_mecanizacion) },
                  { label: 'Operaciones', val: String(u.costo_total_operaciones) },
                  { label: 'Financiamiento', val: u.costo_total_financiamiento },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{formatUSD(parseFloat(val ?? '0'))}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Punto de equilibrio */}
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-green-600">Rendimiento real</p>
                <p className="font-bold text-green-900 dark:text-green-200">{u.rendimiento_ha ?? '—'} t/ha</p>
              </div>
              <div>
                <p className="text-xs text-green-600">Meta rendimiento</p>
                <p className="font-bold text-green-900 dark:text-green-200">{u.valor_meta_rend_ha ?? '—'} t/ha</p>
              </div>
              <div>
                <p className="text-xs text-green-600">Precio maíz</p>
                <p className="font-bold text-green-900 dark:text-green-200">${u.precio_maiz_usd_ton ?? '—'}/t</p>
              </div>
              <div>
                <p className="text-xs text-green-600">Utilidad agricultor</p>
                <p className="font-bold text-green-900 dark:text-green-200">{formatUSD(u.utilidad_agricultor ?? 0)}</p>
              </div>
            </div>

            <FinanzasCharts unidad={u} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function formatUSD(val: number) {
  if (!val || isNaN(val)) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

async function getAgroId(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, agriKey: string) {
  const { data } = await supabase
    .from('agropecuaria')
    .select('agropecuaria_id')
    .eq('AgricultorKey', agriKey)
    .single()
  return data?.agropecuaria_id ? [data.agropecuaria_id] : []
}
