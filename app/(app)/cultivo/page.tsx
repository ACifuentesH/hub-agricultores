import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CultivoTimeline from '@/components/CultivoTimeline'
import { getCurrentStageInfo } from '@/lib/corn-stages'
import { getCurrentConditions, getClimateSeries } from '@/lib/clima'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import UltimaVisitaCard from '@/components/UltimaVisitaCard'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import IrrigationRing from '@/components/IrrigationRing'
import ClimateSparkline from '@/components/ClimateSparkline'
import DataSourceBadge from '@/components/DataSourceBadge'
import { CloudSun, CloudRain, Sun, Cloud, Sprout, AlertCircle, CalendarOff, FlaskConical } from 'lucide-react'
import { freshnessLevel, freshnessTextClass, formatDateShort } from '@/lib/freshness'
import { resolveCiclo } from '@/lib/ciclo'
import { FASE_CORTA } from '@/lib/agro-glosario'
import FechaSiembraEditor from '@/components/FechaSiembraEditor'

// Datos vivos: nunca cachear (lotes/clima/condiciones cambian frecuentemente)
export const dynamic = 'force-dynamic'

const DIAS_CICLO = 120

export default async function CultivoPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string; ciclo?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)
  const ciclo = resolveCiclo(params.ciclo)

  // Master with no selection: show selector + prompt, no data fetch
  if (scope.isMaster && !scope.agricultorKey) {
    const agricultores = await listAgricultores()
    return (
      <MasterEmptyState
        title="Línea de tiempo del cultivo"
        subtitle="Vista master — selecciona un agricultor para ver sus lotes y fases."
        agricultores={agricultores}
        selected={null}
      />
    )
  }

  const agricultorKey = scope.agricultorKey ?? ''
  const supabase = await createClient()
  const [{ data: lotes }, conditions, series, agricultores, { data: visitas }] = await Promise.all([
    supabase
      .from('lote')
      .select('lote_id, nombre_lote, codigo_lote, ha_sembradas, fecha_inicio_siembra, fecha_inicio_siembra_real, ha_cosechadas, rendimiento_real, ha_perdidas, unidad_produccion_v, compactacion, segmentacion_particulas, drenajes_internos, condicion_drenaje')
      .eq('AgricultorKey', agricultorKey)
      .eq('ciclo', ciclo)
      .order('fecha_inicio_siembra_real', { ascending: true }),
    getCurrentConditions(agricultorKey),
    getClimateSeries(agricultorKey, 14),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
    // Última visita técnica por lote — mismo origen que la fase del cultivo
    supabase
      .from('v_lote_detalle')
      .select('lote_id, fecha_visita, tecnico, fase, observaciones, acuerdos, estado_experto')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo),
  ])

  // Condición de suelo e insumos aplicados por lote — movidos aquí desde el
  // antiguo módulo "Suelo", que pasó a ser el repositorio de Documentación.
  // producto_registro se cruza por nombre de lote (lote_v) Y por ciclo: sin el
  // filtro de ciclo, los insumos de 2025 aparecían bajo el filtro 2026 en los
  // lotes cuyo nombre se repite entre ciclos.
  const nombresLote = (lotes ?? []).map(l => l.nombre_lote).filter(Boolean) as string[]
  const { data: insumos } = nombresLote.length
    ? await supabase
        .from('producto_registro')
        .select('lote_v, nombre_producto, categoria_producto, dosis_real_ha, dosis_recomendada_v, ha_aplicadas, fecha_registro')
        .in('lote_v', nombresLote)
        .eq('ciclo', ciclo)
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

  // Índice de visitas por lote, para no recorrer el array en cada tarjeta
  const visitaPorLote = new Map(
    (visitas ?? []).map(v => [v.lote_id as string, v as unknown as import('@/components/UltimaVisitaCard').Visita]),
  )
  const visitaDe = (loteId: string) => visitaPorLote.get(loteId)

  const WeatherIcon = pickWeatherIcon(conditions.descripcion)
  const tempDisplay = conditions.tempC != null ? `${conditions.tempC.toFixed(1)}°C` : '—'
  const tempLevel = freshnessLevel(conditions.fecha)
  const tempIsStale = tempLevel === 'warn' || tempLevel === 'stale'

  // Separar lotes con / sin fecha de siembra real (decisión 2026-04-18: marcar diferente)
  const lotesConFecha = (lotes ?? []).filter(l => l.fecha_inicio_siembra_real != null && l.fecha_inicio_siembra_real !== '')
  const lotesSinFecha = (lotes ?? []).filter(l => l.fecha_inicio_siembra_real == null || l.fecha_inicio_siembra_real === '')

  return (
    <div className="space-y-6">
      {/* Header with title + current conditions chip */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Ciclo completo del maíz — desde siembra hasta cosecha — por lote.
            {scope.isMaster && scope.agropecuariaName && (
              <span className="ml-2 text-green-700 dark:text-green-400 font-medium">
                · {scope.agropecuariaName}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {scope.isMaster && (
            <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
          )}
          <div className="flex flex-col items-end gap-1.5">
            <div
              className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm shadow-lg ${
                tempLevel === 'stale' ? 'border border-red-500/40' : tempLevel === 'warn' ? 'border border-amber-500/40' : 'border border-green-500/30'
              }`}
              style={{ boxShadow: tempIsStale ? '0 0 20px rgba(245, 158, 11, 0.18)' : '0 0 20px rgba(34, 197, 94, 0.15)' }}
              title={conditions.fecha ? `Última lectura: ${new Date(conditions.fecha).toLocaleString('es-VE')}` : 'Sin estación asignada'}
            >
              <span className="text-gray-400 text-xs">Condiciones {tempIsStale ? 'registradas:' : 'actuales:'}</span>
              <span className={`font-semibold ${tempIsStale ? freshnessTextClass(tempLevel) : ''}`}>{tempDisplay}</span>
              {tempIsStale && conditions.fecha && (
                <span className="text-amber-300 text-[11px]">({formatDateShort(conditions.fecha)})</span>
              )}
              {conditions.humPct != null && (
                <span className="text-gray-400 text-xs">· {conditions.humPct.toFixed(0)}% HR</span>
              )}
              <WeatherIcon size={16} className={tempIsStale ? 'text-amber-400' : 'text-green-400'} />
            </div>
            <DataSourceBadge source={conditions.source} fecha={conditions.fecha} size="sm" />
          </div>
        </div>
      </div>

      {/* Índice navegable de lotes (chips clicables que saltan al ancla) */}
      {(lotes?.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium mb-2">
            {lotes!.length} lote{lotes!.length === 1 ? '' : 's'} · click para navegar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lotes!.map(l => {
              const tieneFecha = l.fecha_inicio_siembra_real != null && l.fecha_inicio_siembra_real !== ''
              return (
                <a
                  key={l.lote_id}
                  href={`#lote-${l.lote_id}`}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    tieneFecha
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/60'
                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  }`}
                  title={tieneFecha
                    ? `Sembrado: ${l.fecha_inicio_siembra_real}`
                    : 'Sin fecha de siembra real'}
                >
                  {l.nombre_lote}
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-lote panels — solo lotes con fecha de siembra real */}
      <div className="space-y-6">
        {lotesConFecha.map((l, idx) => {
          const fechaReal = l.fecha_inicio_siembra_real
          const stageInfo = getCurrentStageInfo(fechaReal)
          const diasDesde = stageInfo?.dias ?? 0

          // Mock irrigation: derived from days-since-planting (placeholder until DB has it)
          const irrigation = Math.max(50, Math.min(98, 95 - (idx * 3)))

          return (
            <div key={l.lote_id} id={`lote-${l.lote_id}`} className="space-y-4 scroll-mt-20">
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
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  Siembra <span className="text-gray-700 dark:text-gray-300 font-medium">{l.fecha_inicio_siembra_real ?? '—'}</span>
                  {scope.isMaster && (
                    <FechaSiembraEditor
                      loteId={l.lote_id}
                      loteNombre={l.nombre_lote ?? l.lote_id}
                      fechaActual={l.fecha_inicio_siembra_real ?? null}
                    />
                  )}
                </div>
              </div>

              {/* Main timeline panel */}
              <CultivoTimeline fechaSiembra={fechaReal} diasCiclo={DIAS_CICLO} />

              {/* Fila de indicadores del lote (incluye la última visita técnica) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Días desde siembra">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {diasDesde}
                    </span>
                    <span className="text-xs text-gray-400">/ {DIAS_CICLO} d</span>
                  </div>
                </StatCard>

                <StatCard title="Estado de riego">
                  {/* El anillo medía 96 px y las etiquetas no partían línea:
                      en una columna estrecha "Población establecida" se salía
                      de la tarjeta. Anillo más chico, etiquetas que envuelven
                      y min-w-0 para que el flex pueda encogerlas. */}
                  <div className="flex items-center gap-3">
                    <IrrigationRing percent={irrigation} label="Óptimo" size={76} />
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      <Chip>Población establecida</Chip>
                      <Chip>Plantabilidad</Chip>
                    </div>
                  </div>
                </StatCard>

                <StatCard title="Clima del lote">
                  {series.tempSeries.length > 0 ? (
                    <>
                      <ClimateSparkline series1={series.tempSeries} series2={series.humSeries} label1="Temp" label2="Humedad" />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Rango: {series.tempMin.toFixed(1)}° → {series.tempMax.toFixed(1)}° (14d)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">Sin datos de clima.</p>
                  )}
                </StatCard>

                <StatCard title="Resumen de fase">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {visitaDe(l.lote_id)?.fase
                      ? `Fase ${visitaDe(l.lote_id)!.fase} medida en campo. ${
                          stageInfo ? getPhaseDescription(stageInfo.stage) : ''
                        }`
                      : stageInfo
                        ? `Etapa ${stageInfo.meta.label} — ${stageInfo.meta.phase}. ${getPhaseDescription(stageInfo.stage)}`
                        : 'Lote sin fecha de siembra real registrada.'}
                  </p>
                </StatCard>

                <UltimaVisitaCard v={visitaDe(l.lote_id) ?? null} />
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

      {/* Lotes pendientes de cargar fecha de siembra real */}
      {lotesSinFecha.length > 0 && (
        <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2">
            <CalendarOff size={16} className="text-amber-700 dark:text-amber-400" />
            <h2 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
              Pendientes de cargar fecha de siembra confirmada · {lotesSinFecha.length} lote{lotesSinFecha.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-amber-100/40 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[11px] uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Lote</th>
                  <th className="px-4 py-2 text-left">Código</th>
                  <th className="px-4 py-2 text-left">Unidad</th>
                  <th className="px-4 py-2 text-left">Fecha planeada</th>
                  <th className="px-4 py-2 text-right">Ha sembradas</th>
                  {scope.isMaster && <th className="px-4 py-2 text-right">Fecha de siembra</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
                {lotesSinFecha.map(l => (
                  <tr
                    key={l.lote_id}
                    id={`lote-${l.lote_id}`}
                    className="hover:bg-amber-100/30 dark:hover:bg-amber-950/30 scroll-mt-20"
                  >
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{l.nombre_lote}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{l.codigo_lote ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{l.unidad_produccion_v ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{l.fecha_inicio_siembra ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">{l.ha_sembradas ?? '—'}</td>
                    {scope.isMaster && (
                      <td className="px-4 py-2 text-right">
                        <FechaSiembraEditor
                          loteId={l.lote_id}
                          loteNombre={l.nombre_lote ?? l.lote_id}
                          fechaActual={null}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Estos lotes no aparecen en la línea de tiempo porque no tienen fecha de siembra real registrada. Pídale al equipo agronómico que la complete.
          </div>
        </div>
      )}

      {/* Condición de suelo e insumos por lote (antes vivían en el módulo Suelo).
          Se listan TODOS los lotes, con o sin fecha de siembra, para no perder
          la información de los que aún no entran en la línea de tiempo. */}
      {(lotes?.length ?? 0) > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Condición de suelo e insumos
            </h2>
          </div>

          {lotes!.map(l => (
            <div
              key={`suelo-${l.lote_id}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">{l.nombre_lote}</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{l.codigo_lote}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Compactación: <b className="text-gray-700 dark:text-gray-200">{l.compactacion ?? '—'}</b></span>
                  <span>Drenaje: <b className="text-gray-700 dark:text-gray-200">{l.condicion_drenaje ?? '—'}</b></span>
                  <span>Drenajes internos: <b className="text-gray-700 dark:text-gray-200">{l.drenajes_internos ?? '—'}</b></span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-left">Categoría</th>
                      <th className="px-4 py-3 text-right">Dosis real (ha)</th>
                      <th className="px-4 py-3 text-right">Dosis recom. (ha)</th>
                      <th className="px-4 py-3 text-right">Ha aplicadas</th>
                      <th className="px-4 py-3 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(insumosByLote[l.nombre_lote as string] ?? []).slice(0, 10).map((ins, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{ins?.nombre_producto}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
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
                    {!(insumosByLote[l.nombre_lote as string]?.length) && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                          Sin registros de insumos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
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
  // Sin whitespace-nowrap: en tarjetas estrechas la etiqueta debe poder
  // partirse en dos líneas antes que desbordar el borde.
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] leading-snug text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {children}
    </span>
  )
}

function pickWeatherIcon(descripcion: string) {
  switch (descripcion) {
    case 'Lluvioso': return CloudRain
    case 'Soleado':  return Sun
    case 'Nublado':  return Cloud
    default:         return CloudSun
  }
}

function getPhaseDescription(stage: 0 | 1 | 2 | 3 | 4 | 5): string {
  // Texto único compartido con el asistente (lib/agro-glosario.ts)
  return FASE_CORTA[stage]
}
