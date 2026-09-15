import { BatteryFull, BatteryLow, Wifi, WifiOff } from 'lucide-react'
import type { EstacionSalud, NivelSalud } from '@/lib/clima'

const ESTILO: Record<NivelSalud, { texto: string; color: string; punto: string }> = {
  buena:    { texto: 'Buena',    color: 'text-emerald-700 dark:text-emerald-400', punto: 'bg-emerald-500' },
  media:    { texto: 'Media',    color: 'text-amber-700 dark:text-amber-400',     punto: 'bg-amber-500' },
  baja:     { texto: 'Baja',     color: 'text-orange-700 dark:text-orange-400',   punto: 'bg-orange-500' },
  mala:     { texto: 'Mala',     color: 'text-red-700 dark:text-red-400',         punto: 'bg-red-500' },
  sin_dato: { texto: 'Sin dato', color: 'text-gray-400 dark:text-gray-500',       punto: 'bg-gray-300 dark:bg-gray-600' },
}

function Fila({
  icono, label, nivel, valor,
}: {
  icono: React.ReactNode
  label: string
  nivel: NivelSalud
  valor: string | null
}) {
  const e = ESTILO[nivel]
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
        {icono}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {valor && <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">{valor}</span>}
        <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} aria-hidden="true" />
        <span className={`text-xs font-medium ${e.color}`}>{e.texto}</span>
      </div>
    </div>
  )
}

export default function EstacionSaludCard({ salud }: { salud: EstacionSalud | null }) {
  if (!salud) return null

  const bateriaIcono = salud.bateriaNivel === 'baja'
    ? <BatteryLow size={16} />
    : <BatteryFull size={16} />
  const wifiIcono = salud.wifiNivel === 'sin_dato'
    ? <WifiOff size={16} />
    : <Wifi size={16} />

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Tu estación
      </p>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <Fila
          icono={bateriaIcono}
          label="Batería"
          nivel={salud.bateriaNivel}
          valor={null}
        />
        <Fila
          icono={wifiIcono}
          label="Wifi"
          nivel={salud.wifiNivel}
          valor={salud.wifiRssi != null ? `${salud.wifiRssi} dBm` : null}
        />
      </div>
    </div>
  )
}
