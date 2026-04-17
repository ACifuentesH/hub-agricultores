import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CultivoTimeline from '@/components/CultivoTimeline'
import ReportButtons from '@/components/ReportButtons'
import { Sprout, Calendar, TrendingUp, AlertTriangle, MapPin, Wheat } from 'lucide-react'

const DIAS_CICLO = 120

export default async function CultivoPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: lotes } = await supabase
    .from('lote')
    .select('lote_id, nombre_lote, codigo_lote, ha_sembradas, fecha_inicio_siembra, fecha_inicio_siembra_real, ha_cosechadas, rendimiento_real, ha_perdidas, unidad_produccion_v')
    .eq('AgricultorKey', profile.agricultor_key ?? '')
    .order('fecha_inicio_siembra_real', { ascending: true })

  // Aggregate KPIs
  const totalHaSembradas = lotes?.reduce((s, l) => s + (Number(l.ha_sembradas) || 0), 0) ?? 0
  const totalHaCosechadas = lotes?.reduce((s, l) => s + (Number(l.ha_cosechadas) || 0), 0) ?? 0
  const totalHaPerdidas = lotes?.reduce((s, l) => s + (Number(l.ha_perdidas) || 0), 0) ?? 0
  const lotesActivos = lotes?.filter(l => l.fecha_inicio_siembra_real).length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Cultivo</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Ciclo completo del cultivo — desde siembra hasta cosecha — con seguimiento por lote.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={MapPin}    label="Lotes activos"    value={lotesActivos.toString()}            tone="green" />
        <Kpi icon={Sprout}    label="Ha sembradas"     value={`${totalHaSembradas.toFixed(1)} ha`} tone="lime" />
        <Kpi icon={Wheat}     label="Ha cosechadas"    value={`${totalHaCosechadas.toFixed(1)} ha`} tone="amber" />
        <Kpi icon={AlertTriangle} label="Ha perdidas"  value={`${totalHaPerdidas.toFixed(1)} ha`}  tone="red" />
      </div>

      {/* Per-lote timelines */}
      <div className="space-y-4">
        {lotes?.map(l => {
          const fechaReal = l.fecha_inicio_siembra_real
          const diasDesde = fechaReal
            ? Math.floor((Date.now() - new Date(fechaReal).getTime()) / 86400000)
            : null
          const fechaCosechaEst = fechaReal
            ? new Date(new Date(fechaReal).getTime() + DIAS_CICLO * 86400000).toLocaleDateString('es-VE')
            : null

          return (
            <div key={l.lote_id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">{l.nombre_lote}</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {l.codigo_lote} · {l.unidad_produccion_v ?? 'Sin unidad'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full">
                    <Calendar size={12} /> Siembra: {l.fecha_inicio_siembra_real ?? '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full">
                    <Wheat size={12} /> Cosecha est.: {fechaCosechaEst ?? '—'}
                  </span>
                  {diasDesde !== null && (
                    <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full">
                      Día {diasDesde}
                    </span>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="px-5 py-4">
                <CultivoTimeline fechaSiembra={l.fecha_inicio_siembra_real} diasCiclo={DIAS_CICLO} />
              </div>

              {/* Stats grid */}
              <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Ha sembradas"    value={`${l.ha_sembradas ?? '—'} ha`} />
                <Stat label="Ha cosechadas"   value={`${l.ha_cosechadas ?? '—'} ha`} />
                <Stat label="Ha perdidas"     value={`${l.ha_perdidas ?? '0'} ha`} />
                <Stat label="Rendimiento"     value={l.rendimiento_real ? `${l.rendimiento_real}` : '—'} highlight />
              </div>

              {/* Reportes disponibles */}
              <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-gray-400" />
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Reportes disponibles
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ReportChip label="Plantabilidad" />
                  <ReportChip label="Población establecida" />
                  <ReportChip label="Análisis de costos" />
                  <ReportChip label="Rendimiento esperado vs. real" />
                  <ReportButtons loteId={l.lote_id} loteName={l.nombre_lote} />
                </div>
              </div>
            </div>
          )
        })}

        {(!lotes || lotes.length === 0) && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <Sprout size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No hay lotes registrados todavía.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const TONES = {
  green: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40',
  lime:  'text-lime-700  dark:text-lime-400  bg-lime-50  dark:bg-lime-950/40',
  amber: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
  red:   'text-red-700   dark:text-red-400   bg-red-50   dark:bg-red-950/40',
} as const

function Kpi({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  value: string
  tone: keyof typeof TONES
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${TONES[tone]}`}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{value}</p>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'}`}>
        {value}
      </p>
    </div>
  )
}

function ReportChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-xs px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:border-green-600 hover:text-green-700 dark:hover:text-green-400 dark:hover:border-green-500 transition-colors cursor-pointer">
      {label}
    </span>
  )
}
