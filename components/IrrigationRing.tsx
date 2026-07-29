'use client'

interface Props {
  percent: number
  label?: string
  size?: number
}

export default function IrrigationRing({ percent, label = 'Óptimo', size = 96 }: Props) {
  const r = 38
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = c * (1 - clamped / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle
          cx={50} cy={50} r={r}
          stroke="currentColor"
          strokeWidth={6}
          fill="none"
          className="text-gray-200 dark:text-gray-800"
        />
        <circle
          cx={50} cy={50} r={r}
          stroke="currentColor"
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-green-500 transition-[stroke-dashoffset] duration-700"
          style={{ filter: 'drop-shadow(0 0 6px rgb(34 197 94 / 0.6))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
          {clamped}%
        </span>
        <span className="text-[10px] text-green-600 dark:text-green-400 mt-0.5 uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  )
}
