'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react'

/**
 * Descarga el estado de resultados (P&L) de las fincas del agricultor.
 *
 * El agricultor solo baja el PDF; el Excel queda para el master, que es quien
 * analiza. Ese límite lo impone además el endpoint: aquí solo se oculta el
 * botón, no es la barrera.
 *
 * Se descarga vía fetch en vez de un <a href> directo para poder mostrar el
 * motivo cuando no hay datos: con un enlace normal el navegador abriría una
 * pestaña con un JSON de error, que al agricultor no le dice nada.
 */
export default function DescargarPLBtn({
  agricultorKey,
  isMaster = false,
}: {
  agricultorKey?: string | null
  isMaster?: boolean
}) {
  const [cargando, setCargando] = useState<'pdf' | 'xlsx' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  async function descargar(formato: 'pdf' | 'xlsx') {
    setCargando(formato)
    setError(null)
    try {
      const key = agricultorKey ?? searchParams.get('agricultor')
      const qs = new URLSearchParams({ formato })
      if (key) qs.set('agricultor', key)
      const res = await fetch(`/api/reports/pl?${qs}`)

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error ?? 'No se pudo generar el estado de resultados.')
        return
      }

      const blob = await res.blob()
      const nombre =
        res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
        `Estado_de_resultados.${formato}`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      setError('No se pudo descargar. Revisa tu conexión.')
    } finally {
      setCargando(null)
    }
  }

  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-green-500 hover:text-green-700 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-green-400'

  return (
    <div className="w-full space-y-2 sm:w-auto">
      {/* En el teléfono los botones ocupan el ancho y se apilan: uno al lado del
          otro quedaban con el texto partido en tres líneas. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => descargar('pdf')}
          disabled={cargando !== null}
          className={`${base} w-full sm:w-auto`}
        >
          {cargando === 'pdf'
            ? <Loader2 size={16} className="animate-spin text-green-600" />
            : <FileText size={16} className="text-green-600" />}
          {cargando === 'pdf' ? 'Generando…' : 'Descargar en PDF'}
        </button>

        {isMaster && (
          <button
            type="button"
            onClick={() => descargar('xlsx')}
            disabled={cargando !== null}
            className={`${base} w-full sm:w-auto`}
            title="Solo master: hoja de cálculo para análisis"
          >
            {cargando === 'xlsx'
              ? <Loader2 size={16} className="animate-spin text-green-600" />
              : <FileSpreadsheet size={16} className="text-green-600" />}
            {cargando === 'xlsx' ? 'Generando…' : 'Excel'}
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
