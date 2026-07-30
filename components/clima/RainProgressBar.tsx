/**
 * Barra de progreso de lluvia vs. meta (mm), con degradado que escala por
 * el % de la meta alcanzado. Portada de `RainBar` en
 * `seguimiento-lluvia-saturno/src/routes/index.tsx` (líneas ~168-198),
 * recoloreada con la paleta Tailwind de esta app.
 */

import { fmtNum } from '@/lib/seguimiento-lluvia-calc'

interface Props {
  lluvia: number | null
  meta: number | null
}

export default function RainProgressBar({ lluvia, meta }: Props) {
  const l = lluvia === null || lluvia === undefined ? null : Number(lluvia)
  const m = meta === null || meta === undefined ? null : Number(meta)
  if (l === null) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">Sin dato</span>
  }
  const hasMeta = m !== null && m > 0
  const pct = hasMeta ? (l / m!) * 100 : 0
  const width = Math.min(100, Math.max(0, pct))
  const over = hasMeta && pct > 100
  let fillClass = 'bg-sky-500'
  if (hasMeta) {
    if (pct >= 100) fillClass = 'bg-green-700'
    else if (pct >= 50) fillClass = 'bg-amber-500'
    else fillClass = 'bg-red-500'
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-full ${fillClass} transition-all`} style={{ width: `${width}%` }} />
        {over && <div className="absolute inset-y-0 right-0 w-0.5 bg-white/70 dark:bg-gray-900/70" />}
      </div>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="font-semibold text-gray-800 dark:text-gray-100">{fmtNum(l, 1)} mm</span>
        <span className="text-gray-500 dark:text-gray-400">{hasMeta ? `meta ${fmtNum(m, 0)}` : 'sin meta'}</span>
      </div>
    </div>
  )
}
