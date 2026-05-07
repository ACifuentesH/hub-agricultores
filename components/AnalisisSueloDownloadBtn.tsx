'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  storagePath: string
  filename: string
  size?: 'sm' | 'md'
}

/**
 * Botón "Descargar" que pide al cliente una signed URL de Supabase Storage
 * (válida 60 s) y dispara la descarga. Sin prefetch para no quemar URLs.
 */
export default function AnalisisSueloDownloadBtn({ storagePath, filename, size = 'md' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data, error } = await supabase.storage
        .from('analisis-suelo')
        .createSignedUrl(storagePath, 60)

      if (error || !data?.signedUrl) {
        alert(`No se pudo generar el enlace: ${error?.message ?? 'sin URL'}`)
        return
      }

      // Triggers browser download
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setLoading(false)
    }
  }

  const compact = size === 'sm'
  const padding = compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const iconSize = compact ? 12 : 14

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 ${padding} ${fontSize} font-medium rounded-md bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
      aria-label={`Descargar ${filename}`}
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin" />
        : <Download size={iconSize} />}
      Descargar
    </button>
  )
}
