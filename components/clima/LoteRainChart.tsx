'use client'

/**
 * Chart de lluvia acumulada de UN lote durante su periodo crítico, portado
 * de `LoteBreakdownCard` en `seguimiento-lluvia-saturno/src/routes/index.tsx`
 * (líneas ~1640-1722). El eje X usa la fecha calendario real de cada lectura
 * (no "día 0, día 1…") para que se pueda ubicar cada punto en el tiempo; el
 * subtítulo sigue mostrando el avance en días del periodo (0 a `dur`) para
 * comparar entre lotes sin importar la fecha real de siembra.
 */

import { ComposedChart, Line, ReferenceLine, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { LoteSeguimientoRow, LluviaDiariaLoteRow } from '@/lib/seguimiento-lluvia'
import { fmtNum, effectiveRainPct } from '@/lib/seguimiento-lluvia-calc'
import { RAIN_LINE_COLOR, META_LINE_COLOR } from './chartTheme'

interface Props {
  lote: LoteSeguimientoRow
  dailyRows: LluviaDiariaLoteRow[]
}

/** "3 ago" — sin año: el periodo de un lote nunca cruza fin de año. */
function formatDiaCorto(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

export default function LoteRainChart({ lote, dailyRows }: Props) {
  const dur = lote.duracion_dias ?? 30
  const meta =
    lote.meta_lluvia_mm === null || lote.meta_lluvia_mm === undefined ? null : Number(lote.meta_lluvia_mm)
  const pct = effectiveRainPct(lote)

  const data = dailyRows.map(r => ({
    fecha: r.dia,
    lluvia_acumulada_mm:
      r.lluvia_acumulada_mm === null || r.lluvia_acumulada_mm === undefined ? null : Number(r.lluvia_acumulada_mm),
  }))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
            {lote.lote ?? 'Sin lote'}
          </h3>
          <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
            Día {lote.dias_transcurridos ?? '—'} de {dur} días de llenado
          </p>
        </div>
        {pct !== null && (
          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
            {fmtNum(pct, 0)}%
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-4 text-center text-xs text-gray-400 dark:text-gray-500">
          {lote.dias_transcurridos === null || lote.dias_transcurridos === undefined || lote.dias_transcurridos <= 0
            ? 'Este lote aún no entra en la etapa de llenado.'
            : 'Sin datos diarios todavía.'}
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 10 }}
                  tickFormatter={formatDiaCorto}
                  label={{ value: 'Fecha', position: 'insideBottom', offset: -4, fontSize: 9 }}
                />
                <YAxis tick={{ fontSize: 10 }} width={34} />
                <Tooltip content={<LoteDiariaTooltip />} />
                <Line
                  type="monotone"
                  dataKey="lluvia_acumulada_mm"
                  name="Lluvia acumulada"
                  stroke={RAIN_LINE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 1.5 }}
                  isAnimationActive={false}
                />
                {meta !== null && meta > 0 && (
                  <ReferenceLine
                    y={meta}
                    stroke={META_LINE_COLOR}
                    strokeDasharray="4 4"
                    label={{
                      value: `Meta ${fmtNum(meta, 0)} mm`,
                      position: 'insideTopRight',
                      fontSize: 9,
                      fill: META_LINE_COLOR,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
            Línea: lluvia acumulada · Línea punteada: meta
          </p>
        </>
      )}
    </div>
  )
}

function LoteDiariaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string | null; color?: string; dataKey?: string | number }>
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  const items = payload.filter(p => p.value !== null && p.value !== undefined)
  if (items.length === 0) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 font-semibold text-gray-800 dark:text-gray-100">
        {typeof label === 'string' ? formatDiaCorto(label) : label}
      </div>
      <div className="space-y-1">
        {items.map(p => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-500 dark:text-gray-400">{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-gray-800 dark:text-gray-100">
              {fmtNum(Number(p.value), 1)} mm
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
