import { CloudRain, Cloud, Snowflake, Wind, Flame, AlertTriangle, ShieldCheck } from 'lucide-react'
import type { Alert, AlertIcon, AlertSeverity } from '@/lib/clima'

interface Props {
  alerts: Alert[]
}

const ICONS: Record<AlertIcon, typeof CloudRain> = {
  rain: CloudRain,
  storm: Cloud,
  cold: Snowflake,
  wind: Wind,
  heat: Flame,
}

const SEVERITY_STYLES: Record<AlertSeverity, { wrap: string; icon: string; badge: string; label: string }> = {
  danger: {
    wrap: 'border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/40',
    icon: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300',
    label: 'Crítica',
  },
  warn: {
    wrap: 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
    label: 'Atención',
  },
  info: {
    wrap: 'border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40',
    icon: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300',
    label: 'Aviso',
  },
}

export default function AlertsPanel({ alerts }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          Alertas agronómicas
        </h3>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          Próximos {alerts.length > 0 ? '7' : ''} días
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 py-3 text-sm text-gray-500 dark:text-gray-400">
          <ShieldCheck size={20} className="text-green-600 dark:text-green-400" />
          <span>Sin alertas. Pronóstico dentro de rangos normales.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const Icon = ICONS[a.icon]
            const styles = SEVERITY_STYLES[a.severity]
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${styles.wrap}`}
              >
                <Icon size={20} className={`${styles.icon} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-100">
                      {a.title}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${styles.badge}`}>
                      {styles.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {a.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
