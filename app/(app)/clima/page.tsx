import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClimaDashboard from '@/components/charts/ClimaDashboard'
import ForecastStrip from '@/components/ForecastStrip'
import AlertsPanel from '@/components/AlertsPanel'
import DataSourceBadge from '@/components/DataSourceBadge'
import DescargarHistoricoClimaBtn from '@/components/DescargarHistoricoClimaBtn'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import { getForecast, computeAlerts, getCurrentConditions, resolveStationId } from '@/lib/clima'
import { AlertCircle } from 'lucide-react'
import CurrentConditionsCard from '@/components/clima/CurrentConditionsCard'

// Datos vivos: nunca cachear
export const dynamic = 'force-dynamic'

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {scope.isMaster && scope.agropecuariaName && (
            <p className="text-sm text-green-700 dark:text-green-400 font-medium mt-1">
              {scope.agropecuariaName}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DataSourceBadge source={conditions.source} fecha={conditions.fecha} size="sm" />
            {conditions.source.fuente === 'davis' && (
              <DescargarHistoricoClimaBtn
                agricultorKey={scope.isMaster ? scope.agricultorKey : null}
                agricultorNombre={scope.agropecuariaName}
                size="sm"
              />
            )}
          </div>
        </div>
        {scope.isMaster && (
          <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
        )}
      </div>

      {/* Tarjeta de lectura ACTUAL — piloto HeroUI v3 (Card + Chip) */}
      <CurrentConditionsCard conditions={conditions} />

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
