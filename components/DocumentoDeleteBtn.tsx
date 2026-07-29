'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  pdfId: string
  filename: string
  size?: 'sm' | 'md'
}

/**
 * Botón "Eliminar" (solo visible para master).
 *
 * El borrado (Storage + registro) vive en `DELETE /api/documentos/[id]` con
 * service_role: la tabla y el bucket ahora son solo-lectura en RLS para
 * master, así que este botón ya no toca Storage/tabla directo desde el
 * browser. El servidor resuelve el storage_path por id — no hace falta
 * mandarlo desde acá.
 */
export default function DocumentoDeleteBtn({ pdfId, filename, size = 'sm' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (loading) return
    const ok = window.confirm(
      `¿Eliminar el archivo "${filename}"?\n\n` +
      `Esta acción no se puede deshacer. El archivo desaparecerá del bucket de Storage y del histórico.`
    )
    if (!ok) return

    setLoading(true)
    try {
      const res = await fetch(`/api/documentos/${pdfId}`, { method: 'DELETE' })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        alert(`No se pudo eliminar: ${json.error ?? `Error ${res.status}`}`)
        return
      }
      router.refresh()
    } catch (e) {
      alert(`No se pudo eliminar: ${e instanceof Error ? e.message : 'Error de red'}`)
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
      title="Eliminar documento"
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin" />
        : <Trash2 size={iconSize} />}
    </button>
  )
}
