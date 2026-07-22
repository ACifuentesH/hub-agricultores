/**
 * Ciclo agrícola activo — fuente ÚNICA de verdad para filtrar datos por año.
 *
 * Por qué existe: `agropecuaria.ciclo` NO sirve como filtro. Puede traer el
 * valor combinado '2025,2026' (6 perfiles lo tienen), que nunca iguala a
 * `lote.ciclo` ('2025' | '2026') y dejaba al agricultor sin lotes. Además hay
 * 7 agricultores con lotes en ambos ciclos bajo la misma AgricultorKey, así que
 * el ciclo tiene que ser una elección explícita del usuario, no algo derivado
 * del perfil.
 *
 * Se transporta por query param (?ciclo=2026) para que llegue a los Server
 * Components sin estado global.
 */

export const CICLOS = ['2026', '2025'] as const
export type Ciclo = (typeof CICLOS)[number]

/** Ciclo por defecto cuando no viene en la URL. */
export const CICLO_DEFAULT: Ciclo = '2026'

/** Normaliza el query param a un ciclo válido. */
export function resolveCiclo(raw?: string | null): Ciclo {
  const v = raw?.trim()
  return (CICLOS as readonly string[]).includes(v ?? '') ? (v as Ciclo) : CICLO_DEFAULT
}
