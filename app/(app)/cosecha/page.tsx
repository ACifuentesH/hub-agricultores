import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CornGrowthSimulator from '@/components/CornGrowthSimulator'
import ReportButtons from '@/components/ReportButtons'

export default async function CosechaPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: lotes } = await supabase
    .from('lote')
    .select('lote_id, nombre_lote, codigo_lote, ha_sembradas, fecha_inicio_siembra_real, ha_cosechadas, rendimiento_real, ha_perdidas')
    .eq('AgricultorKey', profile.agricultor_key ?? '')

  // unidades not needed for this page's display

  // Estimated harvest: ~120 days from planting for corn
  const DIAS_COSECHA = 120

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Cosecha</h1>
      <p className="text-gray-500 text-sm">Estado estimado del cultivo y fechas de cosecha proyectadas por lote.</p>

      <div className="space-y-4">
        {lotes?.map(l => {
          const fechaReal = l.fecha_inicio_siembra_real
          const diasDesde = fechaReal
            ? Math.floor((Date.now() - new Date(fechaReal).getTime()) / 86400000)
            : null
          const fechaCosechaEst = fechaReal
            ? new Date(new Date(fechaReal).getTime() + DIAS_COSECHA * 86400000).toLocaleDateString('es-VE')
            : null
          const pctCrecimiento = diasDesde !== null ? Math.min(100, Math.round((diasDesde / DIAS_COSECHA) * 100)) : 0

          return (
            <div key={l.lote_id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row gap-5">
                <CornGrowthSimulator diasDesde={diasDesde ?? 0} />

                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{l.nombre_lote}</h3>
                      <p className="text-xs text-gray-400">{l.codigo_lote}</p>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                      {pctCrecimiento}% desarrollo
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${pctCrecimiento}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat label="Inicio siembra" value={l.fecha_inicio_siembra_real ?? '—'} />
                    <Stat label="Cosecha estimada" value={fechaCosechaEst ?? '—'} highlight />
                    <Stat label="Ha sembradas" value={`${l.ha_sembradas ?? '—'} ha`} />
                    <Stat label="Ha cosechadas" value={`${l.ha_cosechadas ?? '—'} ha`} />
                    <Stat label="Rendimiento real" value={l.rendimiento_real ?? '—'} />
                    <Stat label="Ha perdidas" value={`${l.ha_perdidas ?? '0'} ha`} />
                  </div>

                  {/* Recomendaciones */}
                  <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800 space-y-1">
                    <p className="font-medium">Fechas recomendadas</p>
                    {diasDesde !== null && fechaReal && (
                      <>
                        <p>🌊 Próximo riego: {new Date(new Date(fechaReal).getTime() + (Math.floor(diasDesde / 10) + 1) * 10 * 86400000).toLocaleDateString('es-VE')}</p>
                        <p>🌿 Próxima fertilización: {new Date(new Date(fechaReal).getTime() + (Math.floor(diasDesde / 30) + 1) * 30 * 86400000).toLocaleDateString('es-VE')}</p>
                      </>
                    )}
                  </div>

                  <ReportButtons loteId={l.lote_id} loteName={l.nombre_lote} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-green-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
