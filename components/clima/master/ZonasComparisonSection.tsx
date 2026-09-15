'use client'

import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import {
  CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type {
  LluviaMensualZonaRow, PrediccionLluviaZonaRow, LluviaDiariaEstacionRow,
} from '@/lib/seguimiento-lluvia'
import { colorForYear } from '../chartTheme'

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

type Vista = 'mensual' | 'diario' | 'diario_acumulado'

const VISTA_LABELS: Record<Vista, string> = {
  mensual: 'Mensual',
  diario: 'Diario',
  diario_acumulado: 'Diario acumulado',
}

interface ZonaInput {
  zona: string
  mensual: LluviaMensualZonaRow[]
  prediccion: PrediccionLluviaZonaRow[]
  diaria: LluviaDiariaEstacionRow[]
}

type OverlayRow = Record<string, string | number | null | undefined> & { xLabel: string }

/**
 * Pivotea lluvia mensual histórica (una fila por zona/mes/año) más lo real
 * del año en curso en filas por mes con una columna por año.
 *
 * Hasta el 16-sep-2026 el mes en curso graficaba el pronóstico
 * (`es_pronostico`) y los meses futuros se proyectaban con línea punteada —
 * quitado por el mismo motivo que en `prediccionMensual.ts` (el pronóstico
 * podía calcular 0 mm mientras la lluvia real ya iba muy por encima). El mes
 * en curso ahora recalcula lo acumulado real del dato diario de la zona
 * (`diaria`) hasta hoy, igual que hace el gráfico por agricultor; los meses
 * futuros ya no se grafican.
 */
function buildMensualOverlay(
  mensual: LluviaMensualZonaRow[],
  prediccion: PrediccionLluviaZonaRow[],
  diaria: LluviaDiariaEstacionRow[],
) {
  const anioActual = String(new Date().getFullYear())
  const mesActualNumero = new Date().getMonth() + 1
  const diaHoy = new Date().getDate()
  const rows: OverlayRow[] = MESES_ES.map(mes => ({ xLabel: mes }))
  const years = new Set<string>()

  for (const r of mensual) {
    const year = r.mes_label?.slice(0, 4)
    if (!year || year === anioActual) continue
    const mi = new Date(r.mes).getUTCMonth()
    if (Number.isNaN(mi) || mi < 0 || mi > 11) continue
    years.add(year)
    rows[mi][year] = r.lluvia_mm_promedio === null || r.lluvia_mm_promedio === undefined
      ? null
      : Number(r.lluvia_mm_promedio)
  }

  // Acumulado real del mes en curso, recalculado del dato diario — no
  // depende de que la vista mensual ya lo haya cerrado.
  const dailyByDate = new Map<string, number>()
  for (const r of diaria) {
    if (!r.dia || r.lluvia_mm === null || r.lluvia_mm === undefined) continue
    const e = dailyByDate.get(r.dia)
    dailyByDate.set(r.dia, (e ?? 0) + Number(r.lluvia_mm))
  }
  let realAcumuladoMesActual: number | null = null
  {
    let acumulado = 0
    let huboDato = false
    for (let dia = 1; dia <= diaHoy; dia++) {
      const fecha = `${anioActual}-${String(mesActualNumero).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const v = dailyByDate.get(fecha)
      if (v !== undefined) {
        acumulado += v
        huboDato = true
      }
    }
    if (huboDato) realAcumuladoMesActual = acumulado
  }

  let huboAlgunDatoReal = false
  for (const r of prediccion) {
    const mi = r.mes - 1
    if (mi < 0 || mi > 11) continue
    if (mi + 1 > mesActualNumero) continue // meses futuros: ya no se grafican
    const esMesEnCurso = mi + 1 === mesActualNumero
    const valor = esMesEnCurso && realAcumuladoMesActual !== null
      ? realAcumuladoMesActual
      : (r.valor === null || r.valor === undefined ? null : Number(r.valor))
    if (valor === null) continue
    rows[mi].actual_real = valor
    huboAlgunDatoReal = true
  }
  if (huboAlgunDatoReal) years.add(anioActual)

  return { data: rows, years: Array.from(years).sort() }
}

/**
 * Pivotea lluvia diaria por estación (varias estaciones por zona) en una
 * serie por año, promediando entre estaciones que reportan el mismo día —
 * mismo criterio de agregación "por zona" que ya usa
 * `vista_lluvia_mensual_zona` (promedio entre estaciones incluidas).
 *
 * "diario_acumulado" usa `lluvia_acumulada_anual_mm`, ya resuelta por la
 * vista (acumulado desde el 1 de enero de cada año) — a diferencia del
 * "diario acumulado, reinicia cada mes" del proyecto original, que
 * recalculaba la acumulación mensual en el cliente. Se optó por reusar la
 * columna que la vista ya expone en vez de recalcular una acumulación
 * distinta sobre datos potencialmente desordenados; ver nota en el reporte.
 */
function buildDiariaOverlay(diaria: LluviaDiariaEstacionRow[], vista: 'diario' | 'diario_acumulado') {
  const byDay = new Map<string, Map<string, number[]>>()
  for (const r of diaria) {
    if (!r.dia) continue
    const dayKey = r.dia.slice(5, 10) // MM-DD, para alinear años en el mismo eje X
    const anio = String(r.anio)
    const val = vista === 'diario' ? r.lluvia_mm : r.lluvia_acumulada_anual_mm
    if (val === null || val === undefined) continue
    if (!byDay.has(dayKey)) byDay.set(dayKey, new Map())
    const porAnio = byDay.get(dayKey)!
    if (!porAnio.has(anio)) porAnio.set(anio, [])
    porAnio.get(anio)!.push(Number(val))
  }

  const days = Array.from(byDay.keys()).sort()
  const years = new Set<string>()
  const data: OverlayRow[] = days.map(dayKey => {
    const row: OverlayRow = { xLabel: dayKey }
    const porAnio = byDay.get(dayKey)!
    for (const [anio, vals] of porAnio) {
      years.add(anio)
      row[anio] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return row
  })

  return { data, years: Array.from(years).sort() }
}

function ZonaChart({ zona, vista, mensual, prediccion, diaria }: {
  zona: string
  vista: Vista
  mensual: LluviaMensualZonaRow[]
  prediccion: PrediccionLluviaZonaRow[]
  diaria: LluviaDiariaEstacionRow[]
}) {
  const anioActual = String(new Date().getFullYear())

  const overlay = useMemo(() => {
    if (vista === 'mensual') return buildMensualOverlay(mensual, prediccion, diaria)
    return buildDiariaOverlay(diaria, vista)
  }, [vista, mensual, prediccion, diaria])

  const historicalYears = overlay.years.filter(y => y !== anioActual)
  const tieneActual = overlay.years.includes(anioActual)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="shrink-0 text-green-700 dark:text-green-400" />
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{zona}</h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {vista === 'mensual' ? 'Lluvia mensual promedio' : 'Lluvia diaria por estación (promedio de la zona)'}
            </p>
          </div>
        </div>
        {overlay.years.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            {overlay.years.map((year, i) => (
              <span key={year} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForYear(year, i) }} />
                {year}
              </span>
            ))}
          </div>
        )}
      </div>

      {overlay.data.length === 0 || overlay.years.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          Sin datos para {zona}.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={overlay.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="xLabel" tick={{ fontSize: 9 }} interval={vista === 'mensual' ? 0 : 29} />
              <YAxis tick={{ fontSize: 10 }} width={40} label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip />
              {historicalYears.map((year, i) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  name={year}
                  stroke={colorForYear(year, i)}
                  strokeWidth={2}
                  dot={vista === 'mensual'}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              {vista === 'mensual' && tieneActual && (
                <Line
                  type="monotone"
                  dataKey="actual_real"
                  name={anioActual}
                  stroke={colorForYear(anioActual, 0)}
                  strokeWidth={2}
                  dot
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {vista !== 'mensual' && tieneActual && (
                <Line
                  type="monotone"
                  dataKey={anioActual}
                  name={anioActual}
                  stroke={colorForYear(anioActual, 0)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/**
 * Comparación lado a lado de Oriente y Occidente (las dos zonas presentes en
 * los datos — ver `zona="Oriente"`/`zona="Occidente"` en
 * `seguimiento-lluvia-saturno/src/routes/index.tsx` líneas 2595-2655) con un
 * toggle mensual/diario/diario-acumulado. Portado de `VistaGlobalZonaSection`
 * (líneas ~2594-2764), que sí es el wrapper que empareja ambas zonas en el
 * original — se replica esa idea acá, recibiendo los datos de las dos zonas
 * ya resueltos como prop en vez de volver a pedirlos con hooks propios.
 */
export default function ZonasComparisonSection({ zonas }: { zonas: ZonaInput[] }) {
  const [vista, setVista] = useState<Vista>('mensual')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Comparación por zona</h3>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
          {(Object.keys(VISTA_LABELS) as Vista[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setVista(key)}
              aria-pressed={vista === key}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                vista === key
                  ? 'bg-green-700 text-white shadow-sm dark:bg-green-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {VISTA_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {zonas.map(z => (
          <ZonaChart
            key={z.zona}
            zona={z.zona}
            vista={vista}
            mensual={z.mensual}
            prediccion={z.prediccion}
            diaria={z.diaria}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Oriente = estaciones en Guárico/Aragua. Occidente = estaciones en Portuguesa, Cojedes,
        Barinas, Yaracuy y Lara.
      </p>
    </div>
  )
}
