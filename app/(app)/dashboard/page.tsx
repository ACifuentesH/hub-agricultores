import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CloudSun, CloudRain, Sun, Cloud, Sprout, Wheat, AlertTriangle } from 'lucide-react'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import EstacionSaludCard from '@/components/EstacionSaludCard'
import { getCurrentConditions, getEstacionSalud } from '@/lib/clima'
import { freshnessLevel, freshnessTextClass, formatDateShort } from '@/lib/freshness'
import { resolveCiclo } from '@/lib/ciclo'

// Datos vivos: nunca cachear
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ agricultor?: string; ciclo?: string }>
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const params = await searchParams
  const scope = await resolveAgricultorScope(profile, params)
  const ciclo = resolveCiclo(params.ciclo)

  if (scope.isMaster && !scope.agricultorKey) {
    const agricultores = await listAgricultores()
    return (
      <MasterEmptyState
        title="Dashboard"
        subtitle="Vista master — selecciona un agricultor para ver sus KPIs y lotes."
        agricultores={agricultores}
        selected={null}
      />
    )
  }

  const agricultorKey = scope.agricultorKey ?? ''
  const supabase = await createClient()

  const [{ data: lotes }, conditions, agricultores, estacionSalud] = await Promise.all([
    // v_lote_detalle ya trae ha plan, encaladas, estado y estado de la última actividad
    supabase
      .from('v_lote_detalle')
      .select('lote_id, nombre, ha_plan, ha_encaladas, inicio_siembra, ha_sembradas, ha_perdidas, ha_cosechadas, estado_lote, ultima_actividad_fecha, ultima_actividad_tipo')
      .eq('agricultor_id', agricultorKey)
      .eq('ciclo', ciclo)
      .order('nombre'),
    getCurrentConditions(agricultorKey),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
    getEstacionSalud(agricultorKey),
  ])

  const filas = lotes ?? []
  const totalHaSembradas = filas.reduce((s, l) => s + (Number(l.ha_sembradas) || 0), 0)
  const totalHaPerdidas = filas.reduce((s, l) => s + (Number(l.ha_perdidas) || 0), 0)

  // Cosecha y pérdidas solo tienen sentido cuando el ciclo ya reportó cierre
  const cicloTieneCierre = filas.some(
    l => (Number(l.ha_cosechadas) || 0) > 0 || (Number(l.ha_perdidas) || 0) > 0,
  )

  const WeatherIcon = pickWeatherIcon(conditions.descripcion)
  const tempDisplay = conditions.tempC != null ? `${conditions.tempC.toFixed(1)}°C` : '—'
  const tempLevel = freshnessLevel(conditions.fecha)
  const tempIsStale = tempLevel === 'warn' || tempLevel === 'stale'

  const qsAgricultor = scope.isMaster && scope.agricultorKey
    ? `&agricultor=${encodeURIComponent(scope.agricultorKey)}`
    : ''

  return (
    <div className="space-y-6">
      {/* Header: selector (master) + barra de condiciones actuales */}
      <div className="space-y-3">
        {scope.isMaster && (
          <div className="flex justify-end">
            <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
          </div>
        )}
        <div
          className={`flex w-full items-center justify-center gap-2.5 rounded-full border bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800 dark:text-white dark:shadow-lg ${
            tempLevel === 'stale' ? 'border-red-300 dark:border-red-500/40' : tempLevel === 'warn' ? 'border-amber-300 dark:border-amber-500/40' : 'border-green-300 dark:border-green-500/30'
          }`}
          title={conditions.fecha ? `Última lectura: ${new Date(conditions.fecha).toLocaleString('es-VE')}` : 'Sin estación asignada'}
        >
          <span className="text-gray-500 text-xs dark:text-gray-400">Condiciones {tempIsStale ? 'registradas:' : 'actuales:'}</span>
          <span className={`font-semibold ${tempIsStale ? freshnessTextClass(tempLevel) : 'text-gray-900 dark:text-white'}`}>{tempDisplay}</span>
          {tempIsStale && conditions.fecha && (
            <span className="text-amber-600 text-[11px] dark:text-amber-300">({formatDateShort(conditions.fecha)})</span>
          )}
          {conditions.humPct != null && (
            <span className="text-gray-500 text-xs dark:text-gray-400">· {conditions.humPct.toFixed(0)}% HR</span>
          )}
          <WeatherIcon size={16} className={tempIsStale ? 'text-amber-500 dark:text-amber-400' : 'text-green-600 dark:text-green-400'} />
        </div>
      </div>

      {/* Indicadores del ciclo + salud de la estación */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          <KpiCard
            icon={<Sprout className="text-green-600" size={24} />}
            label={`Lotes del ciclo ${ciclo}`}
            value={String(filas.length)}
          />
          <KpiCard
            icon={<Wheat className="text-yellow-600" size={24} />}
            label="Ha sembradas"
            value={`${totalHaSembradas.toFixed(1)} ha`}
          />
          {cicloTieneCierre && (
            <KpiCard
              icon={<AlertTriangle className="text-red-500" size={24} />}
              label="Ha perdidas"
              value={`${totalHaPerdidas.toFixed(1)} ha`}
            />
          )}
        </div>
        <EstacionSaludCard salud={estacionSalud} />
      </div>

      {/* Lotes */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Mis lotes</h2>
        </div>
        {/* min-w + overflow-x: en el teléfono la tabla se desplaza en lugar de
            comprimirse; sin él, ocho columnas en 326 px partían cada celda en
            tres líneas y no había forma de leer una fila. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Lote</th>
                <th scope="col" className="px-4 py-3 text-right">Ha plan</th>
                <th scope="col" className="px-4 py-3 text-right">Ha encaladas</th>
                <th scope="col" className="px-4 py-3 text-left">Inicio siembra</th>
                <th scope="col" className="px-4 py-3 text-right">Ha sembradas</th>
                <th scope="col" className="px-4 py-3 text-right">Ha perdidas</th>
                <th scope="col" className="px-4 py-3 text-right">Ha cosechadas</th>
                <th scope="col" className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filas.map(l => (
                <tr key={l.lote_id as string} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{l.nombre as string}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{num(l.ha_plan)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{num(l.ha_encaladas)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {l.inicio_siembra ? formatDateShort(l.inicio_siembra as string) : <SinDato />}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{num(l.ha_sembradas)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{num(l.ha_perdidas)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{num(l.ha_cosechadas)}</td>
                  <td className="px-4 py-3">
                    <EstadoChip
                      estado={l.estado_lote as string | null}
                      ultimaActividadFecha={l.ultima_actividad_fecha as string | null}
                      ultimaActividadTipo={l.ultima_actividad_tipo as string | null}
                      enlaceLote={`/cultivo?x=1${qsAgricultor}#lote-${l.lote_id}`}
                    />
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No tienes lotes registrados en el ciclo {ciclo}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Números con un decimal; el cero se atenúa para que no compita visualmente. */
function num(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return <SinDato />
  if (n === 0) return <span className="text-gray-300 dark:text-gray-600">0</span>
  return n.toFixed(1)
}

function SinDato() {
  return <span className="text-gray-300 dark:text-gray-600" title="Sin dato registrado">—</span>
}

function EstadoChip({
  estado, ultimaActividadFecha, ultimaActividadTipo, enlaceLote,
}: {
  estado: string | null
  ultimaActividadFecha?: string | null
  ultimaActividadTipo?: string | null
  enlaceLote?: string
}) {
  if (!estado) {
    // Sin visita fenológica formal, pero puede que igual haya trabajo de
    // campo reciente (control de plagas, fertilización, estimación de
    // rendimiento...) cargado en Saturno por otra vía — mostrar "Sin
    // evaluar" a secas ahí hacía ver el lote abandonado sin estarlo. Se
    // linkea a la tarjeta del lote en Cultivo (no un title, que no se ve en
    // el teléfono) porque ahí sí sale técnico + comentario completos.
    if (ultimaActividadFecha) {
      const chip = (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60">
          {ultimaActividadTipo ?? 'Actividad registrada'}
        </span>
      )
      return enlaceLote
        ? <Link href={enlaceLote} title="Ver técnico y detalle en Cultivo">{chip}</Link>
        : chip
    }
    return <span className="text-xs text-gray-400 dark:text-gray-500">Sin evaluar</span>
  }
  const estilo: Record<string, string> = {
    'Excelente': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    'Muy bueno': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    'Bueno': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'Regular': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'Malo': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilo[estado] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
      {estado}
    </span>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="truncate text-xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      </div>
    </div>
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
