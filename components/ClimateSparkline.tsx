'use client'

interface Props {
  /** Two series of equal length, normalized 0-1 */
  series1: number[]
  series2: number[]
  label1?: string
  label2?: string
}

export default function ClimateSparkline({ series1, series2, label1 = 'Temp', label2 = 'Humedad' }: Props) {
  const W = 200
  const H = 80
  const n = Math.max(series1.length, series2.length)

  const toPath = (data: number[]) => {
    if (data.length === 0) return ''
    return data
      .map((v, i) => {
        const x = (i / (n - 1)) * W
        const y = H - v * H
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-20">
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1={0} y1={y * H} x2={W} y2={y * H}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-gray-300 dark:text-gray-700"
            strokeDasharray="2 3"
          />
        ))}
        <path
          d={toPath(series2)}
          stroke="#84cc16"
          strokeWidth={1.5}
          fill="none"
          style={{ filter: 'drop-shadow(0 0 3px rgba(132, 204, 22, 0.5))' }}
        />
        <path
          d={toPath(series1)}
          stroke="#22c55e"
          strokeWidth={1.5}
          fill="none"
          style={{ filter: 'drop-shadow(0 0 3px rgba(34, 197, 94, 0.5))' }}
        />
      </svg>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 bg-green-500 rounded" /> {label1}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 bg-lime-500 rounded" /> {label2}
        </span>
      </div>
    </div>
  )
}
