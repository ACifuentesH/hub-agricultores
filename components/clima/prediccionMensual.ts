/**
 * Lógica pura de clasificación real/pronóstico y solapamiento de años para
 * la gráfica mensual de lluvia por agricultor, portada de
 * `seguimiento-lluvia-saturno/src/routes/index.tsx` (líneas ~1097-1420).
 *
 * Sin JSX a propósito — mismo criterio que `lib/seguimiento-lluvia-calc.ts`.
 */

import type { PrediccionLluviaLoteRow } from '@/lib/seguimiento-lluvia'

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Año que se pronostica — el pronóstico ya viene calculado desde Supabase. */
export const ANIO_ACTUAL = String(new Date().getFullYear())

// Número de mes (1-12) de "hoy" — distingue meses ya pasados/en curso de
// meses genuinamente futuros, independiente de lo que marque es_pronostico.
const MES_ACTUAL_NUMERO = new Date().getMonth() + 1

// Mínimo de días con lectura para considerar "completo" el dato real de un
// mes. Por debajo de esto se grafica igual el valor real (nunca se sustituye
// por el pronóstico) pero se marca como excluido por calidad.
const UMBRAL_DIAS_MINIMO = 15

export interface PrediccionMes {
  mes: number
  valor: number | null
  esPronostico: boolean
  esExcluidoPorCalidad: boolean
  metodoUsado: string | null
  factorUsado: number | null
}

/**
 * Clasifica un mes usando la realidad medida cuando existe, en vez de
 * confiar ciegamente en es_pronostico: un mes que ya pasó (o está en curso)
 * se grafica con su valor_real si lo tiene, así sea de pocos días — nunca se
 * sustituye por el pronóstico. La línea punteada queda reservada solo para
 * meses que todavía no empiezan.
 */
function clasificarMes(
  mes: number,
  valorReal: number | null,
  valorPronostico: number,
  diasConDato: number | null,
): { valor: number | null; esPronostico: boolean; esExcluidoPorCalidad: boolean } {
  if (mes > MES_ACTUAL_NUMERO) {
    return { valor: valorPronostico, esPronostico: true, esExcluidoPorCalidad: false }
  }
  if (valorReal !== null) {
    return {
      valor: valorReal,
      esPronostico: false,
      esExcluidoPorCalidad: diasConDato !== null && diasConDato < UMBRAL_DIAS_MINIMO,
    }
  }
  // Mes ya pasado sin ningún dato real: no hay nada que graficar.
  return { valor: null, esPronostico: false, esExcluidoPorCalidad: false }
}

/**
 * Varios lotes de un mismo agricultor se promedian mes a mes (cada lote se
 * clasifica primero con su propia realidad); si CUALQUIERA de sus lotes
 * quedó con hueco de calidad ese mes, el agregado se marca igual — más
 * seguro mostrar de más el aviso que de menos.
 */
export function agregarPrediccionLotesPorMes(rows: PrediccionLluviaLoteRow[]): PrediccionMes[] {
  const porMes = new Map<number, PrediccionLluviaLoteRow[]>()
  for (const r of rows) {
    if (!porMes.has(r.mes)) porMes.set(r.mes, [])
    porMes.get(r.mes)!.push(r)
  }
  const out: PrediccionMes[] = []
  for (const [mes, group] of porMes) {
    const clasificados = group.map(g => {
      const valorReal = g.valor_real === null || g.valor_real === undefined ? null : Number(g.valor_real)
      const diasConDato = g.dias_con_dato === null || g.dias_con_dato === undefined ? null : Number(g.dias_con_dato)
      return clasificarMes(mes, valorReal, Number(g.valor), diasConDato)
    })
    const valores = clasificados.map(c => c.valor).filter((v): v is number => v !== null)
    out.push({
      mes,
      valor: valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
      esPronostico: clasificados.some(c => c.esPronostico),
      esExcluidoPorCalidad: clasificados.some(c => c.esExcluidoPorCalidad),
      metodoUsado: group[0]?.metodo_usado ?? null,
      factorUsado:
        group[0]?.factor_usado === null || group[0]?.factor_usado === undefined
          ? null
          : Number(group[0].factor_usado),
    })
  }
  return out.sort((a, b) => a.mes - b.mes)
}

/** Pocos meses reales todavía, o el backend no tuvo con qué calcular nada. */
export function esBajaConfianza(actual: PrediccionMes[]): boolean {
  if (actual.length === 0) return false
  if (actual.every(r => r.metodoUsado === 'sin_datos')) return true
  const mesesReales = actual.filter(r => !r.esPronostico).length
  return mesesReales <= 2
}

function parseYearMonth(mes: string): { year: string; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(mes ?? '')
  if (!m) return null
  const monthIndex = Number(m[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return null
  return { year: m[1], monthIndex }
}

export type PrediccionOverlayRow = { monthIndex: number; month: string } & Record<string, unknown>

/**
 * Convierte lluvia mensual histórica ({mes: "YYYY-MM-01", value}, años
 * anteriores al actual) + el pronóstico ya resuelto del año actual (12
 * filas, una por mes) en filas por mes con una columna por año. El año
 * actual se parte en dos series (actual_real / actual_pronostico) para
 * poder dibujar un tramo sólido y uno punteado en la misma línea.
 */
export function buildPrediccionOverlay(
  historicalPoints: Array<{ mes: string; value: number }>,
  actual: PrediccionMes[],
): { data: PrediccionOverlayRow[]; years: string[] } {
  const rows: PrediccionOverlayRow[] = MESES_ES.map((month, monthIndex) => ({ monthIndex, month }))
  const yearsSet = new Set<string>()
  for (const p of historicalPoints) {
    const parsed = parseYearMonth(p.mes)
    if (!parsed || parsed.year === ANIO_ACTUAL) continue
    yearsSet.add(parsed.year)
    rows[parsed.monthIndex][parsed.year] = p.value
  }

  let lastRealMonthIndex = -1
  for (const r of actual) {
    if (!r.esPronostico && r.valor !== null) {
      lastRealMonthIndex = Math.max(lastRealMonthIndex, r.mes - 1)
    }
  }

  for (const r of actual) {
    const monthIndex = r.mes - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    const row = rows[monthIndex]
    if (r.esPronostico) {
      row.actual_pronostico = r.valor
    } else {
      row.actual_real = r.valor
    }
    row.actual_es_excluido = r.esExcluidoPorCalidad
  }

  // Ancla: el último mes real repite su valor en la serie de pronóstico
  // para que el tramo punteado arranque pegado al sólido, sin hueco.
  if (lastRealMonthIndex !== -1) {
    const anchorRow = rows[lastRealMonthIndex]
    if (anchorRow.actual_pronostico === undefined) {
      anchorRow.actual_pronostico = anchorRow.actual_real
    }
  }

  if (actual.length > 0) yearsSet.add(ANIO_ACTUAL)
  return { data: rows, years: Array.from(yearsSet).sort() }
}
