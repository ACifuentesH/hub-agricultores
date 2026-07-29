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
 *
 * fecha/tamano solo se muestran a master: al agricultor esos metadatos no le
 * aportan nada y ensucian la tarjeta (feedback de diseño).
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
  const Icono = esImagen ? FileImage : FileText

  return (
    <>
      <div
        onClick={() => setPreview(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPreview(true) }}
        className="group flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm shadow-black/5 backdrop-blur-xl transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 p-2.5 shadow-[0_0_18px_rgba(22,163,74,0.35)] transition-shadow group-hover:shadow-[0_0_22px_rgba(22,163,74,0.5)]">
            <Icono size={16} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.85)]" />
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

        {isMaster && (
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{fecha}</span>
            <span>{tamano}</span>
          </div>
        )}

        <div className="border-t border-white/60 pt-3 dark:border-white/10">
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
