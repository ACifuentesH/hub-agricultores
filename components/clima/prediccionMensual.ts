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

export type PrediccionOverlayRow = { monthIndex: number; weekIndex: number; label: string } & Record<string, unknown>

const SEMANA_LABEL = ['S1', 'S2', 'S3', 'S4']

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
 * 4 puntos semanales que SIEMPRE cierran en `total` (el mismo valor mensual
 * ya calculado — nunca se recalcula desde el dato diario, solo se usa para
 * repartir la forma de la acumulación dentro del mes). Sin dato diario ese
 * mes, los primeros 3 puntos quedan `null` y `connectNulls` dibuja la misma
 * línea recta mes a mes que el gráfico ya tenía.
 */
function puntosSemanales(
  dailyByDate: Map<string, number>,
  anio: number,
  monthIndex: number,
  total: number | null,
): [number | null, number | null, number | null, number | null] {
  if (total === null) return [null, null, null, null]
  const crudo = acumuladoSemanalCrudo(dailyByDate, anio, monthIndex)
  if (!crudo || crudo[3] <= 0) return [null, null, null, total]
  const factor = total / crudo[3]
  return [crudo[0] * factor, crudo[1] * factor, crudo[2] * factor, total]
}

/**
 * Igual que antes (lluvia mensual histórica + pronóstico del año actual, año
 * actual partido en actual_real/actual_pronostico), pero cada mes se reparte
 * en 4 puntos semanales en vez de uno solo — mismo total mensual en la 4ta
 * semana, para que el gráfico se vea igual, con la acumulación dentro del mes
 * visible en los 3 puntos intermedios cuando hay dato diario (`diaria`,
 * `vista_lluvia_diaria_estacion` de las estaciones del agricultor).
 */
export function buildPrediccionOverlaySemanal(
  historicalPoints: Array<{ mes: string; value: number }>,
  actual: PrediccionMes[],
  diaria: Array<{ dia: string | null; lluvia_mm: number | null }>,
): { data: PrediccionOverlayRow[]; years: string[] } {
  const rows: PrediccionOverlayRow[] = []
  for (let mi = 0; mi < 12; mi++) {
    for (let wi = 0; wi < 4; wi++) {
      rows.push({ monthIndex: mi, weekIndex: wi, label: `${MESES_ES[mi].slice(0, 3)} ${SEMANA_LABEL[wi]}` })
    }
  }
  const rowIndex = (monthIndex: number, weekIndex: number) => monthIndex * 4 + weekIndex

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

  const yearsSet = new Set<string>()

  // Años históricos.
  const totalHistPorAnioMes = new Map<string, number>() // "YYYY-MI" -> total del mes
  for (const p of historicalPoints) {
    const parsed = parseYearMonth(p.mes)
    if (!parsed || parsed.year === ANIO_ACTUAL) continue
    yearsSet.add(parsed.year)
    totalHistPorAnioMes.set(`${parsed.year}-${parsed.monthIndex}`, p.value)
  }
  for (const [key, total] of totalHistPorAnioMes) {
    const [yearStr, miStr] = key.split('-')
    const anio = Number(yearStr)
    const mi = Number(miStr)
    const semanas = puntosSemanales(dailyByDate, anio, mi, total)
    for (let wi = 0; wi < 4; wi++) rows[rowIndex(mi, wi)][yearStr] = semanas[wi]
  }

  // Año actual: real (sólido) / pronóstico (punteado) — misma clasificación de antes.
  let lastRealMonthIndex = -1
  for (const r of actual) {
    if (!r.esPronostico && r.valor !== null) lastRealMonthIndex = Math.max(lastRealMonthIndex, r.mes - 1)
  }

  const anioActualNum = Number(ANIO_ACTUAL)
  for (const r of actual) {
    const mi = r.mes - 1
    if (mi < 0 || mi > 11) continue
    const semanas = puntosSemanales(dailyByDate, anioActualNum, mi, r.valor)
    const campo = r.esPronostico ? 'actual_pronostico' : 'actual_real'
    for (let wi = 0; wi < 4; wi++) {
      rows[rowIndex(mi, wi)][campo] = semanas[wi]
      rows[rowIndex(mi, wi)].actual_es_excluido = r.esExcluidoPorCalidad
    }
  }

  // Ancla: el último punto real repite su valor en pronóstico, para que el
  // tramo punteado arranque pegado al sólido, sin hueco.
  if (lastRealMonthIndex !== -1) {
    const anchorRow = rows[rowIndex(lastRealMonthIndex, 3)]
    if (anchorRow.actual_pronostico === undefined) {
      anchorRow.actual_pronostico = anchorRow.actual_real
    }
  }

  if (actual.length > 0) yearsSet.add(ANIO_ACTUAL)
  return { data: rows, years: Array.from(yearsSet).sort() }
}
