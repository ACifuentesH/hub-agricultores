/**
 * Badge de racha de días secos consecutivos, escalando color a partir de 3
 * y 5 días. Portado de `DryStreakBadge` en
 * `seguimiento-lluvia-saturno/src/routes/index.tsx` (líneas ~200-214),
 * recoloreado con la paleta Tailwind de esta app.
 */

interface Props {
  value: number | null
}

export default function DryStreakBadge({ value }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
  }
  let cls = 'border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  if (value >= 5) {
    cls = 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
  } else if (value >= 3) {
    cls = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300'
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {value} {value === 1 ? 'día' : 'días'}
    </span>
  )
}
