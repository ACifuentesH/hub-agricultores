import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sprout, Wheat, CloudSun, AlertTriangle } from 'lucide-react'
import { resolveAgricultorScope, listAgricultores } from '@/lib/access'
import MasterAgricultorSelector from '@/components/MasterAgricultorSelector'
import MasterEmptyState from '@/components/MasterEmptyState'
import { valueWithFreshness, freshnessTextClass } from '@/lib/freshness'
import { getCurrentConditions } from '@/lib/clima'
import DataSourceBadge from '@/components/DataSourceBadge'
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

  const [{ data: lotes }, conditions, agricultores] = await Promise.all([
    supabase
      .from('lote')
      .select('lote_id, nombre_lote, ha_sembradas, fecha_inicio_siembra_real, ha_perdidas, edo_gral_cultivo_v')
      .eq('AgricultorKey', agricultorKey)
      .eq('ciclo', ciclo),
    getCurrentConditions(agricultorKey),
    scope.isMaster ? listAgricultores() : Promise.resolve([]),
  ])

  const totalHa = lotes?.reduce((s, l) => s + parseFloat(l.ha_sembradas ?? '0'), 0) ?? 0
  // Política: ha_perdidas null/vacío = 0 hectáreas perdidas (no fue reportado pero asumimos sin pérdidas).
  // Marcamos como posible outlier los lotes sin reporte explícito.
  const totalPerdidas = lotes?.reduce((s, l) => {
    const v = l.ha_perdidas
    if (v == null || v === '') return s
    return s + parseFloat(v)
  }, 0) ?? 0
  const lotesSinReportePerdidas = lotes?.filter(l => l.ha_perdidas == null || l.ha_perdidas === '').length ?? 0
  const lotesSinFechaReal = lotes?.filter(l => l.fecha_inicio_siembra_real == null || l.fecha_inicio_siembra_real === '').length ?? 0

  const tempKpi = valueWithFreshness(
    conditions.tempC != null ? `${conditions.tempC}°C` : null,
    conditions.fecha,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Sprout className="text-green-600" size={24} />} label="Lotes activos" value={String(lotes?.length ?? 0)} />
        <KpiCard
          icon={<Wheat className="text-yellow-600" size={24} />}
          label="Ha sembradas"
          value={`${totalHa.toFixed(1)} ha`}
          hint={lotesSinFechaReal > 0 ? `${lotesSinFechaReal} lotes sin fecha de siembra confirmada` : undefined}
        />
        <KpiCard
          icon={<AlertTriangle className="text-red-500" size={24} />}
          label="Ha perdidas"
          value={`${totalPerdidas.toFixed(1)} ha`}
          hint={lotesSinReportePerdidas > 0 ? `${lotesSinReportePerdidas} lotes sin reporte (posible outlier)` : undefined}
          hintLevel="warn"
        />
        <KpiCard
          icon={<CloudSun className="text-blue-500" size={24} />}
          label="Temperatura actual"
          value={tempKpi.text}
          valueClass={freshnessTextClass(tempKpi.level)}
          hint={tempKpi.isStale && tempKpi.level !== 'missing' ? 'Lectura con más de 24 h de antigüedad' : undefined}
          hintLevel={tempKpi.level === 'stale' ? 'danger' : tempKpi.level === 'warn' ? 'warn' : undefined}
        />
      </div>

      {/* Tabla de lotes */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Mis Lotes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
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
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{l.nombre_lote}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{l.ha_sembradas ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{l.fecha_inicio_siembra_real ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{l.ha_perdidas ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:text-green-400">
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

function KpiCard({
  icon,
  label,
  value,
  valueClass,
  hint,
  hintLevel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
  hint?: string
  hintLevel?: 'info' | 'warn' | 'danger'
}) {
  const hintColor =
    hintLevel === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : hintLevel === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-gray-500 dark:text-gray-400'
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-start gap-4">
      <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold text-gray-800 dark:text-gray-100 truncate ${valueClass ?? ''}`}>
          {value}
        </p>
        {hint && <p className={`text-[11px] mt-1 leading-tight ${hintColor}`}>{hint}</p>}
      </div>
    </div>
  )
}
