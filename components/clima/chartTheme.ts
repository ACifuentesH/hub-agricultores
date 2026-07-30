/**
 * Paleta de colores compartida para todos los charts del módulo de
 * seguimiento de lluvia por lote (portado desde `seguimiento-lluvia-saturno`,
 * que usaba tokens oklch propios vía shadcn/Tailwind v4). Acá se define una
 * sola vez para que ningún componente nuevo invente su propio color —
 * verificados a ojo contra el fondo carbón cálido del modo oscuro
 * (`--color-gray-950: #161712` en `app/globals.css`) y blanco en modo claro.
 */

/** Línea principal de lluvia (per-lote y agregados) — azul, semántica de agua, distinto del verde de marca. */
export const RAIN_LINE_COLOR = '#0284c7' // sky-600

/** Línea de referencia punteada (meta de lluvia del lote) — semántica de alerta/objetivo. */
export const META_LINE_COLOR = '#ef4444' // red-500

/** Línea de temperatura — cálido, semántica de calor, sin chart de referencia en el proyecto original. */
export const TEMP_LINE_COLOR = '#d97706' // amber-600

/**
 * Colores fijos por año para que 2024/2025/2026 se vean siempre igual en
 * todos los gráficos (por agricultor y por zona) — mismo propósito que
 * `YEAR_COLORS` del proyecto original, mismo 2024=ámbar, pero 2026 (ciclo
 * activo) pasa a usar el verde de marca en vez del token `--chart-1` genérico.
 */
export const YEAR_COLORS: Record<string, string> = {
  '2024': '#f59e0b', // amber-500
  '2025': '#0ea5e9', // sky-500
  '2026': '#15803d', // green-700 (marca, mismo verde que "ciclo activo" en el resto de la app)
}

/** Paleta de respaldo para series sin año fijo asignado (>3 series, u otros contextos). */
export const CHART_COLORS = [
  '#15803d', // green-700
  '#f59e0b', // amber-500
  '#0ea5e9', // sky-500
  '#a855f7', // purple-500
  '#14b8a6', // teal-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#eab308', // yellow-500
]

export function colorForIndex(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]
}

export function colorForYear(year: string, fallbackIndex: number): string {
  return YEAR_COLORS[year] ?? colorForIndex(fallbackIndex + 3)
}
