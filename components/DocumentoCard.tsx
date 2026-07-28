'use client'

import { useState } from 'react'
import { FileText, FileImage } from 'lucide-react'
import DocumentoAcciones from './DocumentoAcciones'
import DocumentoPreviewModal from './DocumentoPreviewModal'

interface Props {
  pdfId: string
  storagePath: string
  filename: string
  isMaster: boolean
  loteLabel: string | null
  fecha: string
  tamano: string
}

const EXT_IMAGEN = /\.(png|jpe?g|webp)$/i

/**
 * Tarjeta de un documento dentro de la grilla de `DocumentosSection`. Vive en
 * su propio componente cliente (a diferencia de `DocumentosSection`, que es
 * un server component que hace fetch) para poder abrir el modal de preview
 * al hacer clic en cualquier parte de la tarjeta, no solo en "Ver".
 */
export default function DocumentoCard({
  pdfId,
  storagePath,
  filename,
  isMaster,
  loteLabel,
  fecha,
  tamano,
}: Props) {
  const [preview, setPreview] = useState(false)
  const esImagen = EXT_IMAGEN.test(filename)

  return (
    <>
      <div
        onClick={() => setPreview(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreview(true) }}
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 cursor-pointer transition-colors hover:border-green-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-green-800"
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
            {esImagen
              ? <FileImage size={16} className="text-blue-500" />
              : <FileText size={16} className="text-red-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100" title={filename}>
              {filename}
            </p>
            {loteLabel ? (
              <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
                {loteLabel}
              </span>
            ) : (
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                Toda la finca
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{fecha}</span>
          <span>{tamano}</span>
        </div>

        <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
          <DocumentoAcciones
            pdfId={pdfId}
            storagePath={storagePath}
            filename={filename}
            isMaster={isMaster}
            size="sm"
            onVer={() => setPreview(true)}
          />
        </div>
      </div>

      {preview && (
        <DocumentoPreviewModal
          storagePath={storagePath}
          filename={filename}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  )
}
