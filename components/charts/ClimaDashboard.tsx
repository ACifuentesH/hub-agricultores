'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Lectura {
  fecha_hora: string
  temp_c: number
  temp_max_c: number
  temp_min_c: number
  hum_pct: number
  lluvia_mm: number
}

interface Forecast {
  fecha: string
  temp_max_c: number
  temp_min_c: number
  lluvia_mm: number
  prob_lluvia_pct: number
  hum_avg_pct: number
}

// Aggregate hourly readings to daily
function toDailyData(lecturas: Lectura[]) {
  const byDay: Record<string, { temps: number[]; lluvia: number; hum: number[] }> = {}
  for (const l of lecturas) {
    const day = l.fecha_hora?.split('T')[0]
    if (!day) continue
    if (!byDay[day]) byDay[day] = { temps: [], lluvia: 0, hum: [] }
    if (l.temp_c != null) byDay[day].temps.push(l.temp_c)
    if (l.lluvia_mm != null) byDay[day].lluvia += l.lluvia_mm
    if (l.hum_pct != null) byDay[day].hum.push(l.hum_pct)
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({
      fecha: fecha.slice(5),
      temp_avg: v.temps.length ? +(v.temps.reduce((s, x) => s + x, 0) / v.temps.length).toFixed(1) : null,
      lluvia: +v.lluvia.toFixed(1),
      hum_avg: v.hum.length ? +(v.hum.reduce((s, x) => s + x, 0) / v.hum.length).toFixed(0) : null,
    }))
    .slice(-30)
}

export default function ClimaDashboard({ lecturas, forecast }: { lecturas: Lectura[]; forecast: Forecast[] }) {
  const daily = toDailyData(lecturas)
  const forecastData = forecast.map(f => ({
    fecha: f.fecha?.slice(5),
    temp_max: f.temp_max_c,
    temp_min: f.temp_min_c,
    lluvia: f.lluvia_mm,
    prob_lluvia: f.prob_lluvia_pct,
  }))

  // Latest reading stats
  const latest = lecturas[0]

  return (
    <div className="space-y-5">
      {/* Current conditions */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Temperatura', value: `${latest.temp_c}°C` },
            { label: 'Humedad', value: `${latest.hum_pct}%` },
            { label: 'Lluvia hoy', value: `${latest.lluvia_mm} mm` },
            { label: 'Última lectura', value: latest.fecha_hora ? new Date(latest.fecha_hora).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xl font-bold text-green-800 dark:text-green-300 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Temperature history */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Temperatura últimos 30 días (°C)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="temp_avg" stroke="#166534" strokeWidth={2} dot={false} name="Temp (°C)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rainfall history */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Lluvia últimos 30 días (mm)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="lluvia" fill="#3b82f6" name="Lluvia (mm)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 7-day forecast */}
      {forecastData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Pronóstico 7 días</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="temp_max" stroke="#ef4444" strokeWidth={2} dot={false} name="T. máx (°C)" />
              <Line type="monotone" dataKey="temp_min" stroke="#3b82f6" strokeWidth={2} dot={false} name="T. mín (°C)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
