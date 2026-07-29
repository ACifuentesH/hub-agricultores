/**
 * Ciclo agrícola activo — fuente ÚNICA de verdad para filtrar datos por año.
 *
 * El selector 2025/2026 se retiró: el ciclo 2025 está cerrado y ver sus datos
 * mezclados con los del ciclo en curso confundía más de lo que aportaba. Ahora
 * toda la app trabaja siempre sobre CICLO_ACTIVO.
 *
 * `resolveCiclo` se conserva (ignorando su argumento) para que un enlace viejo
 * o una versión cacheada en la PWA con ?ciclo=2025 no deje al agricultor
 * mirando un ciclo cerrado sin manera de volver: cae al ciclo activo.
 *
 * Nota histórica, por si vuelve a hacer falta filtrar por año:
 * `agropecuaria.ciclo` NO sirve como filtro — puede traer el valor combinado
 * '2025,2026' (6 perfiles lo tienen), que nunca iguala a `lote.ciclo`
 * ('2025' | '2026') y dejaba al agricultor sin lotes.
 */

export const CICLOS = ['2026', '2025'] as const
export type Ciclo = (typeof CICLOS)[number]

/** Ciclo sobre el que trabaja toda la app. */
export const CICLO_ACTIVO: Ciclo = '2026'

/** @deprecated Alias de CICLO_ACTIVO; se mantiene por compatibilidad. */
export const CICLO_DEFAULT = CICLO_ACTIVO

/** Devuelve siempre el ciclo activo; el parámetro se ignora a propósito. */
export function resolveCiclo(_raw?: string | null): Ciclo {
  return CICLO_ACTIVO
}
