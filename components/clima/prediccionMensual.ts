/**
 * Lógica pura de agregación real (sin proyección) para la gráfica mensual de
 * lluvia por agricultor.
 *
 * Hasta el 16-sep-2026 el mes en curso se graficaba con el pronóstico
 * (histórico × factor) en vez del dato real, y los meses futuros se
 * proyectaban con línea punteada. Reportado por el usuario: para algunos
 * agricultores el pronóstico calculaba 0 mm mientras la lluvia real
 * acumulada del mes ya iba en 131 mm — el gráfico mentía por confiar en un
 * cálculo que podía fallar en vez de en el dato medido que sí existía. Se
 * elimina la proyección por completo: el mes en curso grafica lo acumulado
 * real hasta hoy (recalculado del dato diario de las estaciones, igual que
 * ya se hacía para el "Real hasta hoy" del tooltip), y los meses futuros ya
 * no se grafican.
 */

import type { PrediccionLluviaLoteRow } from '@/lib/seguimiento-lluvia'

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const ANIO_ACTUAL = String(new Date().getFullYear())

// Número de mes (1-12) de "hoy" — más allá de este mes ya no se grafica nada
// (se quitó la proyección a meses futuros).
const MES_ACTUAL_NUMERO = new Date().getMonth() + 1

// Mínimo de días con lectura para considerar "completo" el dato real de un
// mes. Por debajo de esto se grafica igual el valor real (nunca se oculta)
// pero se marca como excluido por calidad.
const UMBRAL_DIAS_MINIMO = 15

export interface PrediccionMes {
  mes: number
  valor: number | null
  esExcluidoPorCalidad: boolean
  metodoUsado: string | null
  factorUsado: number | null
}

/**
 * Clasifica un mes usando siempre la realidad medida. Meses futuros (más
 * allá del mes en curso) no se grafican — ya no hay proyección.
 *
 * El mes EN CURSO nunca se marca como "hueco de calidad": todavía no
 * transcurrieron sus 30 días, así que por definición tiene menos días con
 * dato que `UMBRAL_DIAS_MINIMO` — no es una falla de la estación, es que el
 * mes no ha terminado. Marcarlo disparaba la alerta roja en el punto actual
 * de la gráfica todos los meses, sin que hubiera ningún problema real.
 */
function clasificarMes(
  mes: number,
  valorReal: number | null,
  diasConDato: number | null,
): { valor: number | null; esExcluidoPorCalidad: boolean } {
  if (mes > MES_ACTUAL_NUMERO) {
    return { valor: null, esExcluidoPorCalidad: false }
  }
  if (valorReal !== null) {
    const esMesEnCurso = mes === MES_ACTUAL_NUMERO
    return {
      valor: valorReal,
      esExcluidoPorCalidad: !esMesEnCurso && diasConDato !== null && diasConDato < UMBRAL_DIAS_MINIMO,
    }
  }
  // Mes ya pasado (o en curso) sin ningún dato real: no hay nada que graficar.
  return { valor: null, esExcluidoPorCalidad: false }
}

/**
 * Varios lotes de un mismo agricultor se promedian mes a mes (cada lote se
 * clasifica primero con su propia realidad); si CUALQUIERA de sus lotes
 * quedó con hueco de calidad ese mes, el agregado se marca igual — más
 * seguro mostrar de más el aviso que de menos.
 *
 * Excepción: el PRIMER mes con algún dato real de cada lote nunca se marca
 * como "hueco de calidad", así tenga pocos días — es el mes de instalación
 * de la estación a medias, no una falla.
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
      const clasificado = clasificarMes(mes, valorReal, diasConDato)
      const esPrimerMesDelLote = primerMesConDatoPorLote.get(g.lote_id) === mes
      return esPrimerMesDelLote ? { ...clasificado, esExcluidoPorCalidad: false } : clasificado
    })
    const valores = clasificados.map(c => c.valor).filter((v): v is number => v !== null)
    out.push({
      mes,
      valor: valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
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
  const mesesReales = actual.filter(r => r.valor !== null).length
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
  /** Desglose semanal por serie (clave = 'actual_real' | año) — solo para el tooltip. */
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
 * ubicar el punto). Para el mes en curso, los días futuros dentro del mes
 * simplemente no aportan (quedan en el último acumulado real). `null` si no
 * hay ningún dato diario ese mes.
 */
function acumuladoSemanalCrudo(
  dailyByDate: Map<string, number>,
  anio: number,
  monthIndex: number,
  hastaDia: number,
): [number, number, number, number] | null {
  const ultimoDia = Math.min(ultimoDiaDelMes(anio, monthIndex), hastaDia)
  const cortes = [7, 14, 21, ultimoDiaDelMes(anio, monthIndex)]
  const marcas: number[] = []
  let acumulado = 0
  let huboDato = false
  let corteIdx = 0
  for (let dia = 1; dia <= ultimoDiaDelMes(anio, monthIndex); dia++) {
    if (dia <= ultimoDia) {
      const v = dailyByDate.get(fechaISO(anio, monthIndex, dia))
      if (v !== undefined) {
        acumulado += v
        huboDato = true
      }
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
 * desglose.
 */
function desgloseSemanal(
  dailyByDate: Map<string, number>,
  anio: number,
  monthIndex: number,
  total: number | null,
  hastaDia: number,
): DesgloseSemanal {
  if (total === null) return [null, null, null, null]
  const crudo = acumuladoSemanalCrudo(dailyByDate, anio, monthIndex, hastaDia)
  if (!crudo || crudo[3] <= 0) return [null, null, null, total]
  const factor = total / crudo[3]
  return [crudo[0] * factor, crudo[1] * factor, crudo[2] * factor, total]
}

/**
 * Convierte lluvia mensual histórica ({mes: "YYYY-MM-01", value}, años
 * anteriores al actual) + lo real del año en curso (agregarPrediccionLotesPorMes)
 * en filas por mes con una columna por año. El mes en curso usa el
 * acumulado real recalculado del dato diario de las estaciones (`diaria`,
 * `vista_lluvia_diaria_estacion`) hasta hoy — más confiable que esperar a
 * que la vista mensual lo cierre, y evita el bug de mostrar 0 cuando sí hay
 * lluvia real cargada. Meses futuros no se grafican.
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

  const diaHoy = new Date().getDate()

  // Mes en curso: recalcular lo acumulado real hasta hoy directo del dato
  // diario — no depender de que la vista mensual ya lo haya cerrado.
  let realAcumuladoMesActual: number | null = null
  {
    let acumulado = 0
    let huboDato = false
    for (let dia = 1; dia <= diaHoy; dia++) {
      const v = dailyByDate.get(fechaISO(Number(ANIO_ACTUAL), MES_ACTUAL_NUMERO - 1, dia))
      if (v !== undefined) {
        acumulado += v
        huboDato = true
      }
    }
    if (huboDato) realAcumuladoMesActual = acumulado
  }

  for (const p of historicalPoints) {
    const parsed = parseYearMonth(p.mes)
    if (!parsed || parsed.year === ANIO_ACTUAL) continue
    yearsSet.add(parsed.year)
    const row = rows[parsed.monthIndex]
    row[parsed.year] = p.value
    row.semanas[parsed.year] = desgloseSemanal(
      dailyByDate, Number(parsed.year), parsed.monthIndex, p.value, 31,
    )
  }

  const anioActualNum = Number(ANIO_ACTUAL)
  for (const r of actual) {
    const monthIndex = r.mes - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    if (r.valor === null) continue
    const row = rows[monthIndex]
    const esMesEnCurso = r.mes === MES_ACTUAL_NUMERO
    // El mes en curso usa el acumulado real recalculado (si hay dato diario);
    // si no hay dato diario todavía, se cae al valor que ya trae la vista.
    const valorFinal = esMesEnCurso && realAcumuladoMesActual !== null
      ? realAcumuladoMesActual
      : r.valor
    row.actual_real = valorFinal
    row.actual_es_excluido = r.esExcluidoPorCalidad
    row.semanas.actual_real = desgloseSemanal(
      dailyByDate, anioActualNum, monthIndex, valorFinal, esMesEnCurso ? diaHoy : 31,
    )
  }

  if (actual.some(r => r.valor !== null)) yearsSet.add(ANIO_ACTUAL)
  return { data: rows, years: Array.from(yearsSet).sort() }
}
