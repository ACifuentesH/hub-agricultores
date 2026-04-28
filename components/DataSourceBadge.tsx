import { Antenna, Radio, AlertCircle, Triangle } from 'lucide-react'
import type { ClimaSourceMeta } from '@/lib/clima'
import { formatDateShort, freshnessLevel, freshnessTextClass } from '@/lib/freshness'

/**
 * Pill-style badge that surfaces WHERE the climate data came from for the
 * currently-selected agricultor.
 *
 * - davis directo  → green pill, station name + última lectura
 * - triangulado    → amber pill, n estaciones + rango de distancias + precisión
 * - sin_datos      → gray pill, prompt para asignar estación
 *
 * Stale-data marking layers on top of the source so the user always sees both
 * "de dónde viene" y "qué tan reciente es".
 */
export default function DataSourceBadge({
  source,
  fecha,
  size = 'md',
}: {
  source: ClimaSourceMeta
  fecha: string | null
  size?: 'sm' | 'md'
}) {
  const compact = size === 'sm'
  const padding = compact ? 'px-2 py-1' : 'px-3 py-1.5'
  const fontSize = compact ? 'text-[10px]' : 'text-[11px]'
  const iconSize = compact ? 10 : 12

  if (source.fuente === 'sin_datos') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full ${padding} ${fontSize} font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700`}
        title="Este agricultor no tiene estación Davis ni coordenadas para triangular. Cargar lat/lon en unidad_produccion para habilitar."
      >
        <AlertCircle size={iconSize} />
        Sin estación asignada
      </span>
    )
  }

  if (source.fuente === 'triangulated') {
    const precisionLabel: Record<string, string> = {
      aceptable: 'precisión aceptable',
      media: 'precisión media',
      baja: 'precisión baja',
      sin_estaciones_cercanas: 'sin estaciones cercanas',
    }
    const precision = source.precision ? precisionLabel[source.precision] ?? source.precision : ''
    const distRange =
      source.distMinKm != null && source.distMaxKm != null
        ? source.distMinKm === source.distMaxKm
          ? `${source.distMinKm} km`
          : `${source.distMinKm}–${source.distMaxKm} km`
        : null
    const tooltip = source.estacionesUsadas
      ? `Estimación IDW desde ${source.nEstaciones ?? 0} estación(es): ${source.estacionesUsadas}`
      : `Estimación triangulada desde ${source.nEstaciones ?? 0} estación(es)`

    const fecha_meta = freshnessLevel(fecha)
    const fechaText = fecha ? formatDateShort(fecha) : null

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full ${padding} ${fontSize} font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50`}
        title={tooltip}
      >
        <Triangle size={iconSize} className="fill-amber-400/40" />
        Triangulado
        {source.nEstaciones != null && <span className="opacity-80">· {source.nEstaciones} est.</span>}
        {distRange && <span className="opacity-80">· {distRange}</span>}
        {precision && <span className="opacity-80">· {precision}</span>}
        {fechaText && fecha_meta !== 'fresh' && (
          <span className={`opacity-80 ${freshnessTextClass(fecha_meta)}`}>· {fechaText}</span>
        )}
      </span>
    )
  }

  // davis directo
  const fecha_meta = freshnessLevel(fecha)
  const fechaText = fecha ? formatDateShort(fecha) : null
  const isStale = fecha_meta === 'warn' || fecha_meta === 'stale'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${padding} ${fontSize} font-medium border ${
        isStale
          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900/50'
          : 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/50'
      }`}
      title={
        source.davisKey
          ? `Estación Davis directa: ${source.davisKey}${fecha ? ' — última lectura ' + new Date(fecha).toLocaleString('es-VE') : ''}`
          : 'Estación Davis directa'
      }
    >
      {isStale ? <Radio size={iconSize} /> : <Antenna size={iconSize} />}
      Davis
      {source.davisKey && <span className="opacity-80">· {source.davisKey}</span>}
      {fechaText && isStale && (
        <span className={`opacity-80 ${freshnessTextClass(fecha_meta)}`}>· {fechaText}</span>
      )}
    </span>
  )
}
