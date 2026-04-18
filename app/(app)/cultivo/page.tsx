import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CultivoTimeline, { getCurrentStageInfo } from '@/components/CultivoTimeline'
import IrrigationRing from '@/components/IrrigationRing'
import ClimateSparkline from '@/components/ClimateSparkline'
import ReportButtons from '@/components/ReportButtons'
import { CloudSun, Sprout } from 'lucide-react'

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

  return (
    <div className="space-y-6">
      {/* Header with title + current conditions chip */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Línea de tiempo del cultivo
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Ciclo completo del maíz — desde siembra hasta cosecha — por lote.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-gray-900 to-gray-800 border border-green-500/30 text-white text-sm shadow-lg"
          style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)' }}
        >
          <span className="text-gray-400 text-xs">Condiciones actuales:</span>
          <span className="font-semibold">18°C</span>
          <CloudSun size={16} className="text-green-400" />
        </div>
      </div>

      {/* Per-lote panels */}
      <div className="space-y-6">
        {lotes?.map((l, idx) => {
          const fechaReal = l.fecha_inicio_siembra_real
          const stageInfo = getCurrentStageInfo(fechaReal)
          const diasDesde = stageInfo?.dias ?? 0

          // Mock irrigation: derived from days-since-planting (placeholder until DB has it)
          const irrigation = Math.max(50, Math.min(98, 95 - (idx * 3)))

          // Mock climate sparklines (placeholder — to be wired to weatherlink)
          const tempSeries = [0.4, 0.5, 0.55, 0.62, 0.6, 0.7, 0.75, 0.72, 0.8, 0.78]
          const humSeries  = [0.3, 0.45, 0.5, 0.48, 0.55, 0.6, 0.58, 0.65, 0.62, 0.7]

          return (
            <div key={l.lote_id} className="space-y-4">
              {/* Lote header strip */}
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {l.nombre_lote}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {l.codigo_lote} · {l.unidad_produccion_v ?? 'Sin unidad'}
                  </p>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Siembra <span className="text-gray-700 dark:text-gray-300 font-medium">{l.fecha_inicio_siembra_real ?? '—'}</span>
                </div>
              </div>

              {/* Main timeline panel */}
              <CultivoTimeline fechaSiembra={fechaReal} diasCiclo={DIAS_CICLO} />

              {/* 4-card stat row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Días desde siembra">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {diasDesde}
                    </span>
                    <span className="text-xs text-gray-400">/ {DIAS_CICLO} d</span>
                  </div>
                </StatCard>

                <StatCard title="Estado riego">
                  <div className="flex items-center gap-4">
                    <IrrigationRing percent={irrigation} label="Óptimo" />
                    <div className="space-y-1.5 flex-1">
                      <Chip>Población establecida</Chip>
                      <Chip>Plantabilidad</Chip>
                    </div>
                  </div>
                </StatCard>

                <StatCard title="Clima del lote">
                  <ClimateSparkline series1={tempSeries} series2={humSeries} label1="Temp" label2="Humedad" />
                </StatCard>

                <StatCard title="Resumen de fase">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {stageInfo
                      ? `Etapa ${stageInfo.meta.label} — ${stageInfo.meta.phase}. ${getPhaseDescription(stageInfo.stage)}`
                      : 'Lote sin fecha de siembra real registrada.'}
                  </p>
                </StatCard>
              </div>

              {/* Reports row */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reportes</span>
                <ReportButtons loteId={l.lote_id} loteName={l.nombre_lote} />
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

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        {title}
      </p>
      {children}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full whitespace-nowrap">
      {children}
    </span>
  )
}

function getPhaseDescription(stage: 0 | 1 | 2 | 3 | 4 | 5): string {
  const descriptions = [
    'Emergencia y germinación: monitorea humedad superficial.',
    'Establecimiento: plántulas con primeras hojas verdaderas.',
    'Crecimiento vegetativo activo, alto consumo de nitrógeno.',
    'Floración y polinización: etapa crítica para el rendimiento.',
    'Llenado de grano: hidratación y sanidad determinan el peso.',
    'Madurez fisiológica: planificar la cosecha en los próximos días.',
  ]
  return descriptions[stage]
}
