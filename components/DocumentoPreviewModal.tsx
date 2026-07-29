'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { X, Loader2, AlertCircle, FileText } from 'lucide-react'

interface Props {
  storagePath: string
  filename: string
  onClose: () => void
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const EXT_IMAGEN = /\.(png|jpe?g|webp)$/i
const EXT_PDF = /\.pdf$/i

/**
 * Modal de previsualización en la app: pide una signed URL fresca al abrir
 * (120 s, nunca se cachea ni se reutiliza entre aperturas — misma filosofía
 * que el comentario de `DocumentoDownloadBtn`) y embebe el PDF/imagen en vez
 * de forzar una descarga.
 */
export default function DocumentoPreviewModal({ storagePath, filename, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sin reset síncrono de estado acá: el modal siempre monta fresco (el
    // padre lo renderiza condicionalmente), así que loading:true/error:null/
    // url:null ya son los valores iniciales de cada useState de arriba.
    let cancelled = false

    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
    supabase.storage
      .from('analisis-suelo')
      .createSignedUrl(storagePath, 120)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err || !data?.signedUrl) {
          setError(err?.message ?? 'No se pudo generar el enlace')
          return
        }
        setUrl(data.signedUrl)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [storagePath])

  // Escape para cerrar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const esImagen = EXT_IMAGEN.test(filename)
  const esPdf = EXT_PDF.test(filename)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-green-700 dark:text-green-400 shrink-0" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{filename}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-auto">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Generando vista previa…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-2 text-red-600 dark:text-red-400 px-6 text-center">
              <AlertCircle size={28} />
              <p className="text-sm font-medium">No se pudo cargar la vista previa</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{error}</p>
            </div>
          )}

          {!loading && !error && url && esPdf && (
            <iframe
              src={url}
              title={filename}
              className="w-full h-full border-0"
            />
          )}

          {!loading && !error && url && esImagen && (
            <img
              src={url}
              alt={filename}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {!loading && !error && url && !esPdf && !esImagen && (
            <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 px-6 text-center">
              <FileText size={28} />
              <p className="text-sm">No hay vista previa disponible para este tipo de archivo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
