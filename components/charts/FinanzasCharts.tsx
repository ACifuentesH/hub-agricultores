'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface UnidadData {
  costo_total_semillas?: string | null
  costo_total_agroquimicos?: string | null
  costo_total_fertilizantes?: string | null
  costo_total_enmienda?: string | null
  costo_total_mecanizacion?: string | null
  ingreso_venta?: string | null
  costo_total?: string | null
  utilidad_total?: string | null
}

const COLORS = ['#166534', '#15803d', '#16a34a', '#22c55e', '#86efac', '#bbf7d0']

export default function FinanzasCharts({ unidad }: { unidad: UnidadData }) {
  const costos = [
    { name: 'Semillas', value: parseFloat(unidad.costo_total_semillas ?? '0') },
    { name: 'Agroquím.', value: parseFloat(unidad.costo_total_agroquimicos ?? '0') },
    { name: 'Fertiliz.', value: parseFloat(unidad.costo_total_fertilizantes ?? '0') },
    { name: 'Enmienda', value: parseFloat(unidad.costo_total_enmienda ?? '0') },
    { name: 'Mecanic.', value: parseFloat(unidad.costo_total_mecanizacion ?? '0') },
  ].filter(c => c.value > 0)

  const plData = [
    { name: 'Inversión', value: parseFloat(unidad.costo_total ?? '0') },
    { name: 'Ingreso', value: parseFloat(unidad.ingreso_venta ?? '0') },
    { name: 'Utilidad', value: parseFloat(unidad.utilidad_total ?? '0') },
  ]

  return (
    <div className="grid sm:grid-cols-2 gap-5">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Distribución de costos</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={costos} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {costos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">P&L resumen</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={plData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {plData.map((entry, i) => (
                <Cell key={i} fill={entry.value < 0 ? '#ef4444' : COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
