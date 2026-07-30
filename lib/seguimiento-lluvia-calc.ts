/**
 * Funciones puras portadas de `seguimiento-lluvia-saturno/src/routes/index.tsx`
 * (líneas ~86-270 del proyecto original). Sin fetch, sin JSX — la lógica de
 * negocio del seguimiento de lluvia por lote, reusable tanto en Server
 * Components como en los componentes cliente que la consumen.
 */

export function fmtNum(n: number | null, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('es-VE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** % completación de lluvia efectivo: si ya pasaron los días del rango, queda en 100. */
export function effectiveRainPct(r: {
  pct_completacion: number | null
  dias_transcurridos: number | null
  duracion_dias: number | null
}): number | null {
  const dt = r.dias_transcurridos
  const dur = r.duracion_dias
  if (dt !== null && dur !== null && dur > 0 && dt >= dur) return 100
  return r.pct_completacion === null || r.pct_completacion === undefined
    ? null
    : Number(r.pct_completacion)
}

export function daysPct(dt: number | null, dur: number | null): number | null {
  if (dt === null || dt === undefined) return null
  const d = dur && dur > 0 ? dur : 30
  return Math.min(100, Math.max(0, (dt / d) * 100))
}

// Rendimiento calculado a partir de la lluvia acumulada del lote (x, en mm),
// vía regresión cuadrática: y = ax² + bx + c (R² = 0.3599). Coeficientes
// tal cual el proyecto original — no recalculados acá.
const RENDIMIENTO_COEF_A = -7.0744e-5
const RENDIMIENTO_COEF_B = 0.034128085
const RENDIMIENTO_COEF_C = 1.288531493

export function rendimientoCalculado(mmLluvia: number | null): number | null {
  if (mmLluvia === null || mmLluvia === undefined) return null
  const x = Number(mmLluvia)
  return RENDIMIENTO_COEF_A * x * x + RENDIMIENTO_COEF_B * x + RENDIMIENTO_COEF_C
}

/**
 * Estado de la fase de llenado en función del avance de días del periodo
 * crítico (dias_transcurridos / duracion_dias), no de la lluvia acumulada.
 */
export function estadoLlenado(pctDias: number | null): string | null {
  if (pctDias === null || pctDias === undefined) return null
  if (pctDias >= 90) return 'Cierre de llenado'
  if (pctDias >= 30) return 'Llenado'
  return 'Aún no llena'
}

/**
 * Estado agregado de un grupo de lotes (ej. todos los lotes de un
 * agricultor): "Cierre de llenado" solo si TODOS los lotes cerraron, "Aún no
 * llena" solo si NINGUNO ha empezado a llenar todavía, y cualquier otra
 * mezcla se cuenta como "Llenado" — está en curso.
 */
export function estadoLlenadoAgregado(pctDiasList: Array<number | null>): string | null {
  const estados = pctDiasList.map(estadoLlenado).filter((e): e is string => e !== null)
  if (estados.length === 0) return null
  if (estados.every(e => e === 'Cierre de llenado')) return 'Cierre de llenado'
  if (estados.every(e => e === 'Aún no llena')) return 'Aún no llena'
  return 'Llenado'
}
