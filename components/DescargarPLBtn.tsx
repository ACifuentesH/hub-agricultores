'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react'

/**
 * Descarga el estado de resultados (P&L) del agricultor en Excel.
 *
 * Se descarga vía fetch en vez de un <a href> directo para poder mostrar el
 * motivo cuando no hay datos: con un enlace normal el navegador abriría una
 * pestaña con un JSON de error, que al agricultor no le dice nada.
 */
export default function DescargarPLBtn({ agricultorKey }: { agricultorKey?: string | null }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  async function descargar() {
    setCargando(true)
    setError(null)
    try {
      const key = agricultorKey ?? searchParams.get('agricultor')
      const url = key ? `/api/reports/pl?agricultor=${encodeURIComponent(key)}` : '/api/reports/pl'
      const res = await fetch(url)

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error ?? 'No se pudo generar el estado de resultados.')
        return
      }

      const blob = await res.blob()
      const nombre = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ?? 'P&L.xlsx'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      setError('No se pudo descargar. Revisa tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={descargar}
        disabled={cargando}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-green-500 hover:text-green-700 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-green-400"
      >
        {cargando
          ? <Loader2 size={16} className="animate-spin text-green-600" />
          : <FileSpreadsheet size={16} className="text-green-600" />}
        {cargando ? 'Generando…' : 'Descargar estado de resultados'}
      </button>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
