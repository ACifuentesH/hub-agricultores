/**
 * Fila de 4 tarjetas de KPI agregadas sobre los lotes en seguimiento de
 * lluvia de un agricultor. Todo aritmética de cliente sobre `lotes` ya
 * cargado — no dispara ninguna consulta nueva. La forma de la tarjeta sigue
 * el `KpiCard` de `app/(app)/dashboard/page.tsx` (mismo look en toda la app),
 * los íconos siguen la elección del proyecto original
 * (`seguimiento-lluvia-saturno`, `StatCard` líneas ~271-296).
 */

import { Sprout, MapPin, Droplets, Cloud } from 'lucide-react'
import type { LoteSeguimientoRow } from '@/lib/seguimiento-lluvia'
import { effectiveRainPct, fmtNum } from '@/lib/seguimiento-lluvia-calc'

interface Props {
  lotes: LoteSeguimientoRow[]
}

export default function StatCardRow({ lotes }: Props) {
  const total = lotes.length
  const conEstacion = lotes.filter(l => l.station_id !== null && l.station_id !== undefined).length
  const sinEstacion = total - conEstacion

  const pcts = lotes.map(effectiveRainPct).filter((p): p is number => p !== null)
  const pctPromedio = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null

  const enPeriodoActivo = lotes.filter(
    l => l.dias_transcurridos !== null && l.duracion_dias !== null && l.dias_transcurridos < l.duracion_dias,
  ).length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={<Sprout className="text-green-600" size={22} />} label="Total de lotes" value={String(total)} />
      <StatCard
        icon={<MapPin className="text-blue-500" size={22} />}
        label="Estación asignada"
        value={String(conEstacion)}
        sub={sinEstacion > 0 ? `${sinEstacion} sin estación` : undefined}
      />
      <StatCard
        icon={<Droplets className="text-sky-500" size={22} />}
        label="% Completación promedio"
        value={pctPromedio !== null ? `${fmtNum(pctPromedio, 0)}%` : '—'}
      />
      <StatCard
        icon={<Cloud className="text-gray-500" size={22} />}
        label="En periodo activo"
        value={String(enPeriodoActivo)}
        sub={total > 0 ? `de ${total}` : undefined}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="truncate text-xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        {sub && <p className="mt-1 text-[11px] leading-tight text-gray-500 dark:text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}
