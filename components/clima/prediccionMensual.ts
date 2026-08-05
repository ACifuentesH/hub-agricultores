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
 * confiar ciegamente en es_pronostico — EXCEPTO en el mes en curso mientras
 * todavía no acumula suficientes días de dato (`UMBRAL_DIAS_MINIMO`, mismo
 * umbral que ya usa la vista para decidir `es_pronostico`): recién empezado
 * el mes, `valor_real` es casi siempre 0 o casi 0 porque apenas pasaron uno o
 * dos días, y mostrar eso como "dato real" se lee como "no llovió nada este
 * mes" en vez de "todavía no hay mes que mostrar". Ahí se usa el pronóstico
 * (histórico × factor) que la vista ya calculó, igual que para meses
 * genuinamente futuros — y a medida que se acumulan días reales (la vista
 * pasa `es_pronostico` a false) vuelve a graficarse el dato medido.
 *
 * Para meses ya cerrados, en cambio, sigue prefiriendo el valor_real así sea
 * de pocos días (nunca sustituido por el pronóstico) — ahí sí es un dato
 * real, aunque incompleto, y se marca esExcluidoPorCalidad en vez de ocultarlo.
 */
function clasificarMes(
  mes: number,
  valorReal: number | null,
  valorPronostico: number,
  diasConDato: number | null,
  esPronosticoVista: boolean,
): { valor: number | null; esPronostico: boolean; esExcluidoPorCalidad: boolean } {
  if (mes > MES_ACTUAL_NUMERO) {
    return { valor: valorPronostico, esPronostico: true, esExcluidoPorCalidad: false }
  }
  if (mes === MES_ACTUAL_NUMERO && esPronosticoVista) {
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
 *
 * Excepción: el PRIMER mes con algún dato real de cada lote nunca se marca
 * como "hueco de calidad", así tenga pocos días — es el mes de instalación
 * de la estación a medias, no una falla. Confirmado con datos reales: varias
 * estaciones instaladas fines de mayo 2026 mostraban ese mes con el marcador
 * de alerta solo por haber arrancado a mitad de mes.
 */
export function agregarPrediccionLotesPorMes(rows: PrediccionLluviaLoteRow[]): PrediccionMes[] {
  const primerMesConDatoPorLote = new Map<string, number>()
  for (const r of rows) {
    const dias = r.dias_con_dato === null || r.dias_con_dato === undefined ? 0 : Number(r.dias_con_dato)
    if (dias <= 0) continue
    const actual = primerMesConDatoPorLote.get(r.lote_id)
    if (actual === undefined || r.mes < actual) primerMesConDatoPorLote.set(r.lote_id, r.mes)
  }

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
      const clasificado = clasificarMes(mes, valorReal, Number(g.valor), diasConDato, g.es_pronostico === true)
      const esPrimerMesDelLote = primerMesConDatoPorLote.get(g.lote_id) === mes
      return esPrimerMesDelLote ? { ...clasificado, esExcluidoPorCalidad: false } : clasificado
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

/** Acumulado dentro del mes al cierre de cada semana (S1..S4 = días 1–7/8–14/15–21/22–fin). */
export type DesgloseSemanal = [number | null, number | null, number | null, number | null]

export type PrediccionOverlayRow = {
  monthIndex: number
  month: string
  /** Desglose semanal por serie (clave = 'actual_real' | 'actual_pronostico' | año) — solo para el tooltip. */
  semanas: Record<string, DesgloseSemanal>
} & Record<string, unknown>

function ultimoDiaDelMes(anio: number, monthIndex: number): number {
  return new Date(anio, monthIndex + 1, 0).getDate()
}

function fechaISO(anio: number, monthIndex: number, dia: number): string {
  return `${anio}-${String(monthIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * [cierre semana 1, cierre semana 2, cierre semana 3, cierre semana 4] de
 * lluvia acumulada DENTRO del mes, sumando el dato diario disponible (semanas
 * fijas por día-del-mes: 1–7, 8–14, 15–21, 22–fin — no ISO, alcanza para
 * ubicar el punto). `null` si no hay ningún dato diario ese mes.
 */
function acumuladoSemanalCrudo(
  dailyByDate: Map<string, number>,
  anio: number,
  monthIndex: number,
): [number, number, number, number] | null {
  const ultimoDia = ultimoDiaDelMes(anio, monthIndex)
  const cortes = [7, 14, 21, ultimoDia]
  const marcas: number[] = []
  let acumulado = 0
  let huboDato = false
  let corteIdx = 0
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const v = dailyByDate.get(fechaISO(anio, monthIndex, dia))
    if (v !== undefined) {
      acumulado += v
      huboDato = true
    }
    while (corteIdx < cortes.length && dia === cortes[corteIdx]) {
      marcas.push(acumulado)
      corteIdx++
    }
  }
  while (marcas.length < 4) marcas.push(acumulado)
  return huboDato ? (marcas as [number, number, number, number]) : null
}

/**
 * Desglose semanal que SIEMPRE cierra en `total` (el mismo valor mensual ya
 * calculado — nunca se recalcula desde el dato diario, solo se usa para
 * repartir la forma de la acumulación dentro del mes). Sin dato diario ese
 * mes, devuelve `[null, null, null, total]` — el tooltip entonces no muestra
 * desglose (ver `hayDesglose` en el componente).
 */
function desgloseSemanal(
  dailyByDate: Map<string, number>,
  anio: number,
  monthIndex: number,
  total: number | null,
): DesgloseSemanal {
  if (total === null) return [null, null, null, null]
  const crudo = acumuladoSemanalCrudo(dailyByDate, anio, monthIndex)
  if (!crudo || crudo[3] <= 0) return [null, null, null, total]
  const factor = total / crudo[3]
  return [crudo[0] * factor, crudo[1] * factor, crudo[2] * factor, total]
}

/**
 * Convierte lluvia mensual histórica ({mes: "YYYY-MM-01", value}, años
 * anteriores al actual) + el pronóstico ya resuelto del año actual (12
 * filas, una por mes) en filas por mes con una columna por año — un punto
 * por mes en el gráfico, igual que siempre. Cada fila lleva además
 * `semanas`, el desglose de esa lluvia dentro del mes (S1..S4, a partir del
 * dato diario de las estaciones del agricultor — `diaria`,
 * `vista_lluvia_diaria_estacion`), que el tooltip muestra al pararse en el
 * punto sin cambiar el gráfico en sí. El año actual se parte en dos series
 * (actual_real / actual_pronostico) para poder dibujar un tramo sólido y uno
 * punteado en la misma línea.
 */
export function buildPrediccionOverlay(
  historicalPoints: Array<{ mes: string; value: number }>,
  actual: PrediccionMes[],
  diaria: Array<{ dia: string | null; lluvia_mm: number | null }>,
): { data: PrediccionOverlayRow[]; years: string[] } {
  const rows: PrediccionOverlayRow[] = MESES_ES.map((month, monthIndex) => ({ monthIndex, month, semanas: {} }))
  const yearsSet = new Set<string>()

  // Promedio diario entre estaciones, por si el agricultor tiene lotes en más de una.
  const sumByDate = new Map<string, { sum: number; count: number }>()
  for (const r of diaria) {
    if (!r.dia || r.lluvia_mm === null || r.lluvia_mm === undefined) continue
    const e = sumByDate.get(r.dia) ?? { sum: 0, count: 0 }
    e.sum += Number(r.lluvia_mm)
    e.count += 1
    sumByDate.set(r.dia, e)
  }
  const dailyByDate = new Map<string, number>()
  for (const [dia, e] of sumByDate) dailyByDate.set(dia, e.count > 0 ? e.sum / e.count : 0)

  for (const p of historicalPoints) {
    const parsed = parseYearMonth(p.mes)
    if (!parsed || parsed.year === ANIO_ACTUAL) continue
    yearsSet.add(parsed.year)
    const row = rows[parsed.monthIndex]
    row[parsed.year] = p.value
    row.semanas[parsed.year] = desgloseSemanal(dailyByDate, Number(parsed.year), parsed.monthIndex, p.value)
  }

  let lastRealMonthIndex = -1
  for (const r of actual) {
    if (!r.esPronostico && r.valor !== null) {
      lastRealMonthIndex = Math.max(lastRealMonthIndex, r.mes - 1)
    }
  }

  const anioActualNum = Number(ANIO_ACTUAL)
  for (const r of actual) {
    const monthIndex = r.mes - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    const row = rows[monthIndex]
    const campo = r.esPronostico ? 'actual_pronostico' : 'actual_real'
    row[campo] = r.valor
    row.actual_es_excluido = r.esExcluidoPorCalidad
    row.semanas[campo] = desgloseSemanal(dailyByDate, anioActualNum, monthIndex, r.valor)
  }

  // Ancla: el último mes real repite su valor en la serie de pronóstico
  // para que el tramo punteado arranque pegado al sólido, sin hueco.
  if (lastRealMonthIndex !== -1) {
    const anchorRow = rows[lastRealMonthIndex]
    if (anchorRow.actual_pronostico === undefined) {
      anchorRow.actual_pronostico = anchorRow.actual_real
      if (anchorRow.semanas.actual_real) anchorRow.semanas.actual_pronostico = anchorRow.semanas.actual_real
    }
  }

  if (actual.length > 0) yearsSet.add(ANIO_ACTUAL)
  return { data: rows, years: Array.from(yearsSet).sort() }
}
