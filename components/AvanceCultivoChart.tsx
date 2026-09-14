import { TrendingUp } from 'lucide-react'

export interface LoteAvance {
  nombre: string
  avance_pct: number | null
  fase: string | null
  estado_lote: string | null
  sembrado: boolean
}

/**
 * Avance del ciclo de cultivo, promediado sobre los lotes YA SEMBRADOS.
 *
 * Por qué el ciclo y no la cosecha: en el ciclo activo todavía no hay lotes
 * cosechados (están en fase vegetativa/reproductiva temprana), así que un
 * gráfico de cosecha saldría plano en cero. Este mide el recorrido de siembra a
 * cosecha estimada, que responde a la misma pregunta —"¿cómo va mi cultivo?"— y
 * reflejará la cosecha en cuanto empiece.
 *
 * Los lotes sin sembrar quedan fuera del promedio (no arrastran hacia abajo),
 * pero se declaran aparte para que el número no engañe.
 */

const HITOS = [
  { pct: 0, etiqueta: 'Siembra' },
  { pct: 25, etiqueta: 'Vegetativo' },
  { pct: 50, etiqueta: 'Floración' },
  { pct: 75, etiqueta: 'Llenado' },
  { pct: 100, etiqueta: 'Cosecha' },
]

export default function AvanceCultivoChart({
  lotes,
  avancePromedio,
}: {
  lotes: LoteAvance[]
  avancePromedio: number | null
}) {
  const conAvance = lotes.filter(l => l.avance_pct != null)
  // "Sin iniciar" antes confundía dos cosas distintas: lotes que de verdad no
  // se sembraron, y lotes sembrados que nunca tuvieron una visita ni
  // actividad que diera un % — ahora se distinguen porque avance_pct puede
  // ser null en un lote sembrado (no se inventa un número, ver AGENTS.md).
  const sinSembrar = lotes.filter(l => !l.sembrado).length
  const sembradosSinDato = lotes.filter(l => l.sembrado && l.avance_pct == null).length

  if (conAvance.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Avance del cultivo
        </p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {sinSembrar === lotes.length
            ? 'Ninguno de tus lotes tiene fecha de siembra confirmada, así que todavía no se puede calcular el avance.'
            : 'Tus lotes están sembrados, pero todavía no hay ninguna visita ni actividad registrada para calcular el avance.'}
        </p>
      </div>
    )
  }

  const promedio = avancePromedio ?? Math.round(
    conAvance.reduce((s, l) => s + (l.avance_pct ?? 0), 0) / conAvance.length,
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-green-600" />
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Avance del cultivo
          </p>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Promedio de {conAvance.length} lote{conAvance.length === 1 ? '' : 's'} con dato
          {sinSembrar > 0 && ` · ${sinSembrar} sin sembrar (excluido${sinSembrar === 1 ? '' : 's'})`}
          {sembradosSinDato > 0 && ` · ${sembradosSinDato} sembrado${sembradosSinDato === 1 ? '' : 's'} sin visita ni actividad aún`}
        </p>
      </div>

      {/* Barra principal: degradado de verde (siembra) a dorado (grano maduro) */}
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {promedio}%
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">del ciclo recorrido</span>
      </div>

      <div className="relative mt-4">
        <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="avance-barra h-full rounded-full"
            style={{
              width: `${promedio}%`,
              backgroundImage: 'linear-gradient(90deg,#15803d 0%,#65a30d 45%,#ca8a04 80%,#eab308 100%)',
            }}
          />
        </div>

        {/* Hitos del ciclo.
            El punto siempre va centrado en su porcentaje, pero la etiqueta no:
            centrarla en 0% y 100% sacaba "Siembra" y "Cosecha" fuera de la
            tarjeta. Los extremos se anclan hacia dentro (el primero alinea su
            borde izquierdo con el punto, el último el derecho) y solo los
            intermedios van centrados. */}
        <div className="relative mt-1.5 h-8">
          {HITOS.map((h, i) => {
            const esPrimero = i === 0
            const esUltimo = i === HITOS.length - 1
            const alcanzado = promedio >= h.pct
            return (
              <div key={h.pct} className="absolute top-0" style={{ left: `${h.pct}%` }}>
                <div
                  className={`h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    alcanzado ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span
                  className={`absolute top-2.5 block whitespace-nowrap text-[10px] ${
                    alcanzado
                      ? 'font-medium text-gray-700 dark:text-gray-200'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                  style={{
                    transform: esPrimero
                      ? 'translateX(0)'
                      : esUltimo
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  }}
                >
                  {h.etiqueta}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .avance-barra { animation: avanceCrecer 900ms cubic-bezier(.22,1,.36,1) both; }
        @keyframes avanceCrecer { from { width: 0 !important; } }
        @media (prefers-reduced-motion: reduce) { .avance-barra { animation: none; } }
      `}</style>
    </div>
  )
}
