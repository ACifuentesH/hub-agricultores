'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  pdfId: string
  storagePath: string
  filename: string
  size?: 'sm' | 'md'
}

/**
 * Botón "Eliminar" (solo visible para master).
 *
 * Borrado en dos pasos atómicos:
 *   1. Borrar archivo del bucket de Storage
 *   2. Borrar registro de lote_analisis_suelo
 *
 * Si el Storage falla, no se borra el registro (queda inconsistente menos
 * dañino que perder la referencia). Si el INSERT falla después, queda un
 * archivo huérfano que un cron de limpieza podría barrer (no implementado
 * aún — bajo riesgo dado que el master ve los huérfanos como ítems con
 * download que da 404).
 */
export default function AnalisisSueloDeleteBtn({ pdfId, storagePath, filename, size = 'sm' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (loading) return
    const ok = window.confirm(
      `¿Eliminar el PDF "${filename}"?\n\n` +
      `Esta acción no se puede deshacer. El archivo desaparecerá del bucket de Storage y del histórico.`
    )
    if (!ok) return

    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      // Paso 1: borrar del Storage
      const { error: storageErr } = await supabase.storage
        .from('analisis-suelo')
        .remove([storagePath])

      if (storageErr) {
        // Si el archivo ya no existe (404) en storage seguimos al paso 2
        const msg = storageErr.message?.toLowerCase() ?? ''
        const isMissing = msg.includes('not found') || msg.includes('does not exist') || msg.includes('object not found')
        if (!isMissing) {
          alert(`No se pudo borrar del Storage: ${storageErr.message}`)
          setLoading(false)
          return
        }
      }

      // Paso 2: borrar el registro de la tabla
      const { error: rowErr } = await supabase
        .from('lote_analisis_suelo')
        .delete()
        .eq('id', pdfId)

      if (rowErr) {
        alert(`Storage borrado pero el registro falló: ${rowErr.message}`)
        setLoading(false)
        return
      }

      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const compact = size === 'sm'
  const padding = compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
  const iconSize = compact ? 12 : 14

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className={`inline-flex items-center justify-center ${padding} rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
      aria-label={`Eliminar ${filename}`}
      title="Eliminar PDF"
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin" />
        : <Trash2 size={iconSize} />}
    </button>
  )
}
