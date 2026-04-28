/**
 * Freshness helpers — política unificada de antigüedad de datos.
 *
 * Decisión de negocio (18-abr-2026): se considera "fresco" cualquier dato con
 * antigüedad ≤ 24 horas. Más allá de eso, el valor se sigue mostrando pero
 * acompañado por su fecha entre paréntesis y con estilo visual de advertencia.
 */

export const STALE_HOURS = 24

export function ageHours(fecha: string | Date | null): number {
  if (!fecha) return Infinity
  const t = typeof fecha === 'string' ? new Date(fecha).getTime() : fecha.getTime()
  if (!Number.isFinite(t)) return Infinity
  return (Date.now() - t) / 36e5
}

export function isStale(fecha: string | Date | null, maxHours = STALE_HOURS): boolean {
  return ageHours(fecha) > maxHours
}

/** Severity bucket for color coding. */
export function freshnessLevel(
  fecha: string | Date | null,
  maxHours = STALE_HOURS,
): 'fresh' | 'warn' | 'stale' | 'missing' {
  const h = ageHours(fecha)
  if (!Number.isFinite(h)) return 'missing'
  if (h <= maxHours) return 'fresh'
  if (h <= maxHours * 7) return 'warn'    // entre 1 día y 1 semana → ámbar
  return 'stale'                          // > 1 semana → rojo
}

/** Tailwind text-color class matching the freshness level. */
export function freshnessTextClass(level: ReturnType<typeof freshnessLevel>): string {
  switch (level) {
    case 'fresh':   return ''
    case 'warn':    return 'text-amber-600 dark:text-amber-400'
    case 'stale':   return 'text-red-600 dark:text-red-400'
    case 'missing': return 'text-gray-400 dark:text-gray-500'
  }
}

/** "20 mar" / "20 mar 25" depending on whether the year matches current. */
export function formatDateShort(fecha: string | Date | null): string {
  if (!fecha) return ''
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (!Number.isFinite(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' }),
  })
}

/**
 * Compose a human label that respects the freshness policy.
 *  - Fresh data → just the value (e.g. "28°C")
 *  - Stale data → value + parenthesised date (e.g. "28°C (1 ago 25)")
 *  - Missing → "—"
 */
export function valueWithFreshness(
  value: string | null,
  fecha: string | Date | null,
  maxHours = STALE_HOURS,
): { text: string; level: ReturnType<typeof freshnessLevel>; isStale: boolean } {
  const level = freshnessLevel(fecha, maxHours)
  if (value == null || value === '') {
    return { text: '—', level: 'missing', isStale: true }
  }
  if (level === 'fresh') {
    return { text: value, level, isStale: false }
  }
  const date = formatDateShort(fecha)
  return {
    text: date ? `${value} (${date})` : value,
    level,
    isStale: true,
  }
}
