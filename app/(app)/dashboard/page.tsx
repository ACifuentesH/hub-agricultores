import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sprout, Wheat, CloudSun, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Lotes del agricultor
  const { data: lotes } = await supabase
    .from('lote')
    .select('lote_id, nombre_lote, ha_sembradas, fecha_inicio_siembra_real, ha_perdidas, edo_gral_cultivo_v')
    .eq('AgricultorKey', profile.agricultor_key ?? '')

  // Último dato de clima
  const { data: climaMap } = await supabase
    .from('mapa_productor_clima')
    .select('productor_clima')
    .eq('agricultor_key', profile.agricultor_key ?? '')
    .single()

  const { data: climaReciente } = climaMap
    ? await supabase
        .from('clima_lecturas')
        .select('temp_c, hum_pct, lluvia_mm, fecha_hora')
        .eq('productor', climaMap.productor_clima)
        .order('fecha_hora', { ascending: false })
        .limit(1)
        .single()
    : { data: null }

  const totalHa = lotes?.reduce((s, l) => s + parseFloat(l.ha_sembradas ?? '0'), 0) ?? 0
  const totalPerdidas = lotes?.reduce((s, l) => s + parseFloat(l.ha_perdidas ?? '0'), 0) ?? 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Sprout className="text-green-600" size={24} />} label="Lotes activos" value={String(lotes?.length ?? 0)} />
        <KpiCard icon={<Wheat className="text-yellow-600" size={24} />} label="Ha sembradas" value={`${totalHa.toFixed(1)} ha`} />
        <KpiCard icon={<AlertTriangle className="text-red-500" size={24} />} label="Ha perdidas" value={`${totalPerdidas.toFixed(1)} ha`} />
        <KpiCard
          icon={<CloudSun className="text-blue-500" size={24} />}
          label="Temperatura actual"
          value={climaReciente ? `${climaReciente.temp_c}°C` : 'N/D'}
        />
      </div>

      {/* Tabla de lotes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Mis Lotes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Lote</th>
                <th className="px-4 py-3 text-left">Ha sembradas</th>
                <th className="px-4 py-3 text-left">Inicio siembra</th>
                <th className="px-4 py-3 text-left">Ha perdidas</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lotes?.map(l => (
                <tr key={l.lote_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{l.nombre_lote}</td>
                  <td className="px-4 py-3 text-gray-600">{l.ha_sembradas ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{l.fecha_inicio_siembra_real ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{l.ha_perdidas ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                      {l.edo_gral_cultivo_v ?? 'Activo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="p-2.5 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}
