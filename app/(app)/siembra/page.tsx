import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SiembraPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: lotes } = await supabase
    .from('lote')
    .select('lote_id, nombre_lote, codigo_lote, ha_sembradas, fecha_inicio_siembra, fecha_inicio_siembra_real, ha_sembradas_agro, unidad_produccion_v')
    .eq('AgricultorKey', profile.agricultor_key ?? '')
    .order('fecha_inicio_siembra_real', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Siembra</h1>
      <p className="text-gray-500 text-sm">Fechas de inicio de siembra por lote.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lotes?.map(l => {
          const fechaReal = l.fecha_inicio_siembra_real
          const diasDesdeSiembra = fechaReal
            ? Math.floor((Date.now() - new Date(fechaReal).getTime()) / 86400000)
            : null

          return (
            <div key={l.lote_id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{l.nombre_lote}</h3>
                  <p className="text-xs text-gray-400">{l.codigo_lote}</p>
                </div>
                {diasDesdeSiembra !== null && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Día {diasDesdeSiembra}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Fecha plan</span>
                  <span>{l.fecha_inicio_siembra ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fecha real</span>
                  <span className="font-medium text-gray-800">{l.fecha_inicio_siembra_real ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Ha sembradas</span>
                  <span>{l.ha_sembradas ?? '—'} ha</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Unidad producción</span>
                  <span className="text-xs">{l.unidad_produccion_v ?? '—'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
