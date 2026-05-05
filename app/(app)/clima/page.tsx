import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClimaDashboard from '@/components/charts/ClimaDashboard'
import ForecastStrip from '@/components/ForecastStrip'
import AlertsPanel from '@/components/AlertsPanel'
import DataSourceBadge from '@/components/DataSourceBadge'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import { getForecast, computeAlerts, getCurrentConditions, resolveStationId } from '@/lib/clima'
import { Thermometer, Droplets, CloudRain as CloudRainIcon, MapPin, AlertCircle } from 'lucide-react'
import { formatDateShort, freshnessTextClass, freshnessLevel } from '@/lib/freshness'

export default async function ClimaPage({
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
        title="Clima"
        subtitle="Vista master — selecciona un agricultor para ver su estación y pronóstico."
        agricultores={agricultores}
        selected={null}
      />
    )
  }

  const agricultorKey = scope.agricultorKey ?? ''
  const supabase = await createClient()

  const [conditions, agricultores, forecast] = await Promise.all([
    getCurrentConditions(agricultorKey),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
    getForecast(agricultorKey, 7),
  ])

  const productorClima = conditions.source.davisKey
  const alerts = computeAlerts(forecast.rows)

  // Últimos 30 días de lecturas (horarias) — solo cuando hay Davis directo
  // Usa station_id del nuevo universo weather_readings.
  const stationId = conditions.source.davisKey ? await resolveStationId(agricultorKey) : null
  const { data: lecturasRaw } = stationId
    ? await supabase
        .from('weather_readings')
        .select('fecha_hora, temp_c, temp_max_c, temp_min_c, hum_pct, lluvia_mm, ts')
        .eq('station_id', stationId)
        .order('ts', { ascending: false })
        .limit(720)
    : { data: [] }

  // weather_readings.fecha_hora es text "naive" (UTC) — convertimos a ISO con Z
  // para que el frontend lo trate consistentemente con el resto del sistema.
  const lecturas = (lecturasRaw ?? []).map(l => ({
    ...l,
    fecha_hora: typeof l.fecha_hora === 'string' ? l.fecha_hora.replace(' ', 'T') + 'Z' : l.fecha_hora,
  }))

  const tempLevel = freshnessLevel(conditions.fecha)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Clima</h1>
          {scope.isMaster && scope.agropecuariaName && (
            <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-1">
              {scope.agropecuariaName}
            </p>
          )}
          <div className="mt-2">
            <DataSourceBadge source={conditions.source} fecha={conditions.fecha} size="sm" />
          </div>
        </div>
        {scope.isMaster && (
          <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
        )}
      </div>

      {/* Tarjeta de lectura ACTUAL — siempre visible cuando hay datos (davis o triangulado) */}
      {conditions.tempC != null && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Lectura más reciente</h2>
            {conditions.fecha && (
              <span className={`text-xs ${freshnessTextClass(tempLevel)}`}>
                {tempLevel === 'fresh' ? 'Actualizada' : 'Última lectura'}: {formatDateShort(conditions.fecha)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ClimaStat
              icon={<Thermometer size={18} className="text-orange-500" />}
              label="Temperatura"
              value={`${conditions.tempC.toFixed(1)}°C`}
            />
            {conditions.humPct != null && (
              <ClimaStat
                icon={<Droplets size={18} className="text-blue-500" />}
                label="Humedad"
                value={`${conditions.humPct.toFixed(0)}%`}
              />
            )}
            {conditions.lluviaMm != null && (
              <ClimaStat
                icon={<CloudRainIcon size={18} className="text-sky-500" />}
                label="Lluvia"
                value={`${conditions.lluviaMm.toFixed(1)} mm`}
              />
            )}
            <ClimaStat
              icon={<MapPin size={18} className="text-green-600" />}
              label="Origen"
              value={
                conditions.source.fuente === 'davis'
                  ? conditions.source.davisKey ?? 'Davis'
                  : conditions.source.fuente === 'triangulated'
                    ? `IDW · ${conditions.source.nEstaciones ?? 0} est.`
                    : 'Sin estación'
              }
            />
          </div>
          {conditions.source.fuente === 'triangulated' && conditions.source.estacionesUsadas && (
            <p className="mt-4 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 rounded p-2.5">
              <strong>Estimación triangulada:</strong> {conditions.source.estacionesUsadas}.
              {conditions.source.precision && ` Precisión estimada: ${conditions.source.precision}.`}
            </p>
          )}
        </div>
      )}

      {productorClima ? (
        <>
          {/* Pronóstico + alertas en grid 2 columnas en lg */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ForecastStrip
                rows={forecast.rows}
                descargadoEn={forecast.descargadoEn}
                isStale={forecast.isStale}
              />
            </div>
            <AlertsPanel alerts={alerts} />
          </div>

          {/* Histórico (lecturas reales) */}
          <ClimaDashboard lecturas={lecturas ?? []} />
        </>
      ) : conditions.source.fuente === 'triangulated' ? (
        <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40 p-5 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">Pronóstico extendido no disponible para esta ubicación.</p>
            <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              La lectura actual proviene de triangulación entre estaciones cercanas, pero el pronóstico de 7 días requiere
              tener una estación Davis propia mapeada. Asignar una estación Davis a este agricultor habilitará pronóstico
              y alertas predictivas.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold mb-1 text-gray-700 dark:text-gray-300">No hay datos de clima disponibles.</p>
            <p className="leading-relaxed">
              Este agricultor no tiene estación Davis asignada ni coordenadas en <code>unidad_produccion</code> para triangular
              desde estaciones cercanas. Cargar lat/lon en el perfil del agricultor habilitará la triangulación.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ClimaStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</p>
      </div>
    </div>
  )
}
