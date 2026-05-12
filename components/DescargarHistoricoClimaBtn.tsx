'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  /** AgricultorKey opcional. Si se pasa (modo master), descarga el de ese agricultor.
   *  Si no, el endpoint usa el agricultor del usuario autenticado (modo farmer). */
  agricultorKey?: string | null
  agricultorNombre?: string | null
  size?: 'sm' | 'md'
}

/**
 * Botón "Descargar histórico de clima" — pide al endpoint /api/clima/historico
 * un Excel con TODAS las lecturas de la estación Davis del agricultor.
 *
 * Visible siempre que el agricultor en contexto tenga estación Davis directa.
 * El endpoint hace doble validación de permisos (master/farmer) por RLS.
 */
export default function DescargarHistoricoClimaBtn({
  agricultorKey,
  agricultorNombre,
  size = 'md',
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    try {
      const url = agricultorKey
        ? `/api/clima/historico?agricultor=${encodeURIComponent(agricultorKey)}`
        : '/api/clima/historico'

      const res = await fetch(url)

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Error desconocido' }))
        alert(`No se pudo descargar: ${j.error}`)
        return
      }

      const blob = await res.blob()
      const filename = res.headers
        .get('Content-Disposition')
        ?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `clima_historico_${(agricultorNombre ?? 'agricultor').replace(/\s+/g, '_')}.xlsx`

      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } finally {
      setLoading(false)
    }
  }

  const compact = size === 'sm'
  const padding = compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const iconSize = compact ? 13 : 15

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 ${padding} ${fontSize} font-medium rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
      aria-label="Descargar histórico de clima en Excel"
      title="Descargar todo el histórico de clima en Excel"
    >
      {loading
        ? <><Loader2 size={iconSize} className="animate-spin" /> Generando…</>
        : <><Download size={iconSize} /> Descargar histórico clima</>}
    </button>
  )
}
