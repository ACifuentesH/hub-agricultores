import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sprout, Wheat, CloudSun, AlertTriangle } from 'lucide-react'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import { valueWithFreshness, freshnessTextClass, formatDateShort } from '@/lib/freshness'
import { getCurrentConditions, getForecast, computeAlerts } from '@/lib/clima'
import DataSourceBadge from '@/components/DataSourceBadge'
import { resolveCiclo } from '@/lib/ciclo'
import { labelCategoria } from '@/lib/documentos'
import NotificacionesButton, { type Novedad } from '@/components/NotificacionesButton'
import EstadoLotesCard from '@/components/EstadoLotesCard'
import FaseActualCard from '@/components/FaseActualCard'
import AvanceCultivoChart from '@/components/AvanceCultivoChart'
import MisComunicaciones from '@/components/MisComunicaciones'

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

  const [
    { data: lotes },
    { data: resumen },
    conditions,
    agricultores,
    forecast,
    { data: docsRecientes },
    { data: eventos },
  ] = await Promise.all([
    // v_lote_detalle ya trae ha plan, encaladas, estado, fase y avance
    supabase
      .from('v_lote_detalle')
      .select('lote_id, nombre, ha_plan, ha_encaladas, inicio_siembra, ha_sembradas, ha_perdidas, ha_cosechadas, estado_lote, fase, avance_pct')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo)
      .order('nombre'),
    supabase
      .from('v_agricultor_resumen')
      .select('*')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo)
      .maybeSingle(),
    getCurrentConditions(agricultorKey),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
    getForecast(agricultorKey, 7),
    supabase
      .from('lote_analisis_suelo')
      .select('id, nombre_archivo, categoria, uploaded_at, storage_path')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo)
      .order('uploaded_at', { ascending: false })
      .limit(5),
    supabase
      .from('lote_eventos')
      .select('id, lote_nombre, tipo, valor_anterior, valor_nuevo, created_at')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const filas = lotes ?? []
  const totalHa = filas.reduce((s, l) => s + (Number(l.ha_sembradas) || 0), 0)
  const totalPerdidas = filas.reduce((s, l) => s + (Number(l.ha_perdidas) || 0), 0)
  const lotesConSiembra = filas.filter(l => l.inicio_siembra != null).length

  // Cosecha y pérdidas solo tienen sentido cuando el ciclo ya reportó cierre
  const cicloTieneCierre = filas.some(
    l => (Number(l.ha_cosechadas) || 0) > 0 || (Number(l.ha_perdidas) || 0) > 0,
  )

  const tempKpi = valueWithFreshness(
    conditions.tempC != null ? `${conditions.tempC}°C` : null,
    conditions.fecha,
  )

  // ── Novedades para la campana ──
  const novedades: Novedad[] = []
  for (const a of computeAlerts(forecast.rows).slice(0, 5)) {
    novedades.push({ id: `clima-${a.id}`, tipo: 'clima', titulo: a.title, detalle: a.detail, fecha: a.fecha })
  }
  for (const d of docsRecientes ?? []) {
    novedades.push({
      id: `doc-${d.id}`,
      tipo: 'documento',
      titulo: `Nuevo documento · ${labelCategoria(d.categoria as string)}`,
      detalle: d.nombre_archivo as string,
      fecha: d.uploaded_at as string,
    })
  }
  for (const ev of eventos ?? []) {
    const nombre = (ev.lote_nombre as string | null) ?? 'un lote'
    novedades.push({
      id: `evt-${ev.id}`,
      tipo: 'cambio',
      titulo: `Fecha de siembra actualizada · ${nombre}`,
      detalle: ev.valor_anterior
        ? `Cambió de ${ev.valor_anterior} a ${ev.valor_nuevo ?? 'sin fecha'}.`
        : `Se registró la siembra el ${ev.valor_nuevo ?? '—'}.`,
      fecha: ev.created_at as string,
    })
  }
  if (tempKpi.isStale && tempKpi.level !== 'missing' && conditions.fecha) {
    novedades.push({
      id: 'clima-viejo',
      tipo: 'dato_viejo',
      titulo: 'Lectura de clima desactualizada',
      detalle: `La última lectura de tu estación es del ${formatDateShort(conditions.fecha)}.`,
      fecha: conditions.fecha,
    })
  }
  novedades.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {scope.isMaster && scope.agropecuariaName && (
            <p className="mt-1 text-sm font-medium text-green-700 dark:text-green-400">
              {scope.agropecuariaName}
            </p>
          )}
          <div className="mt-2">
            <DataSourceBadge source={conditions.source} fecha={conditions.fecha} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {scope.isMaster && (
            <MasterAgricultorSelector agricultores={agricultores} selected={scope.agricultorKey} />
          )}
          <NotificacionesButton novedades={novedades} agricultorKey={agricultorKey} />
        </div>
      </div>

      {/* KPIs a la izquierda; estado y fase apilados a la derecha */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          <KpiCard
            icon={<Sprout className="text-green-600" size={24} />}
            label={`Lotes del ciclo ${ciclo}`}
            value={String(filas.length)}
            hint={filas.length > 0 ? `${lotesConSiembra} con siembra confirmada` : undefined}
            hintLevel={lotesConSiembra === 0 && filas.length > 0 ? 'warn' : undefined}
          />
          <KpiCard
            icon={<Wheat className="text-yellow-600" size={24} />}
            label="Ha sembradas"
            value={`${totalHa.toFixed(1)} ha`}
          />
          <KpiCard
            icon={<CloudSun className="text-blue-500" size={24} />}
            label="Temperatura actual"
            value={tempKpi.text}
            valueClass={freshnessTextClass(tempKpi.level)}
            hint={tempKpi.isStale && tempKpi.level !== 'missing' ? 'Lectura con más de 24 h' : undefined}
            hintLevel={tempKpi.level === 'stale' ? 'danger' : tempKpi.level === 'warn' ? 'warn' : undefined}
          />
          {cicloTieneCierre && (
            <KpiCard
              icon={<AlertTriangle className="text-red-500" size={24} />}
              label="Ha perdidas"
              value={`${totalPerdidas.toFixed(1)} ha`}
            />
          )}
        </div>

        <div className="space-y-4">
          <EstadoLotesCard r={resumen as never} />
          <FaseActualCard
            fase={(resumen?.fase_dominante as string | null) ?? null}
            lotesConFase={(resumen?.lotes_con_fase as number) ?? 0}
            lotesTotales={filas.length}
          />
        </div>
      </div>

      {/* Avance del ciclo, justo debajo de los KPIs */}
      <AvanceCultivoChart
        lotes={filas.map(l => ({
          nombre: l.nombre as string,
          avance_pct: l.avance_pct as number | null,
          fase: l.fase as string | null,
          estado_lote: l.estado_lote as string | null,
        }))}
        avancePromedio={(resumen?.avance_promedio as number | null) ?? null}
      />

      {/* Lotes */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Mis lotes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                  <td className="px-4 py-3"><EstadoChip estado={l.estado_lote as string | null} /></td>
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

      <MisComunicaciones docs={(docsRecientes ?? []) as never} />
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

function EstadoChip({ estado }: { estado: string | null }) {
  if (!estado) {
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

function KpiCard({
  icon, label, value, valueClass, hint, hintLevel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
  hint?: string
  hintLevel?: 'info' | 'warn' | 'danger'
}) {
  const hintColor =
    hintLevel === 'danger' ? 'text-red-600 dark:text-red-400'
    : hintLevel === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : 'text-gray-500 dark:text-gray-400'
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`truncate text-xl font-bold text-gray-800 dark:text-gray-100 ${valueClass ?? ''}`}>{value}</p>
        {hint && <p className={`mt-1 text-[11px] leading-tight ${hintColor}`}>{hint}</p>}
      </div>
    </div>
  )
}
