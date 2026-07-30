import { fmtNum } from '@/lib/seguimiento-lluvia-calc'

/**
 * Barra de progreso mínima (0-100%) para % de días o % de lluvia dentro de
 * las tablas/acordeones master. Portada de `ProgressBar` en
 * `seguimiento-lluvia-saturno/src/routes/index.tsx`.
 */
export default function ProgressBar({ pct }: { pct: number | null }) {
  const value = pct === null || pct === undefined ? null : Math.min(100, Math.max(0, pct))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-[64px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {value !== null && (
          <div
            className="h-full rounded-full bg-green-600 dark:bg-green-500"
            style={{ width: `${value}%` }}
          />
        )}
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {fmtNum(value, 0)}%
      </span>
    </div>
  )
}
