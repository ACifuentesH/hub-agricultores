import { CloudRain, Sun, CloudSun, Cloud, CloudDrizzle, Droplet } from 'lucide-react'
import type { ForecastDay } from '@/lib/clima'

interface Props {
  rows: ForecastDay[]
  descargadoEn: string | null
  isStale: boolean
}

/**
 * Horizontal 7-day forecast strip — one card per day with icon, temps, rain.
 * Pure presentational; data shape comes from `lib/clima#getForecast`.
 */
export default function ForecastStrip({ rows, descargadoEn, isStale }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
        Sin pronóstico disponible para esta estación.
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">Pronóstico 7 días</h3>
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          {isStale && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-medium">
              Datos desactualizados
            </span>
          )}
          {descargadoEn && (
            <span>Descargado: {new Date(descargadoEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {rows.map((d, i) => {
          const Icon = pickForecastIcon(d)
          const dateLabel = formatDay(d.fecha, i === 0)
          return (
            <div
              key={d.fecha}
              className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 flex flex-col items-center text-center"
            >
              <p className={`text-xs font-medium uppercase tracking-wide ${i === 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {dateLabel}
              </p>
              <Icon size={28} className="text-gray-700 dark:text-gray-300 my-1.5" />
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {d.temp_max_c != null ? `${Math.round(d.temp_max_c)}°` : '—'}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {d.temp_min_c != null ? `${Math.round(d.temp_min_c)}°` : ''}
                </span>
              </div>
              <div className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                <Droplet size={9} className="fill-current" />
                <span className="tabular-nums">
                  {d.prob_lluvia_pct != null ? `${Math.round(d.prob_lluvia_pct)}%` : '—'}
                </span>
              </div>
              {d.lluvia_mm != null && d.lluvia_mm > 0.1 && (
                <span className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                  {d.lluvia_mm.toFixed(1)} mm
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function pickForecastIcon(d: ForecastDay) {
  const rain = d.lluvia_mm ?? 0
  const prob = d.prob_lluvia_pct ?? 0
  const tmax = d.temp_max_c ?? 0
  const hum = d.hum_avg_pct ?? 0

  if (rain >= 10 || prob >= 70) return CloudRain
  if (rain > 0.5 || prob >= 40) return CloudDrizzle
  if (tmax >= 33 && hum < 60) return Sun
  if (hum >= 80) return Cloud
  return CloudSun
}

function formatDay(iso: string, isToday: boolean): string {
  if (isToday) return 'Hoy'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' })
}
