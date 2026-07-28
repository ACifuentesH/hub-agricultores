'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import DocumentoDownloadBtn from './DocumentoDownloadBtn'
import DocumentoDeleteBtn from './DocumentoDeleteBtn'
import DocumentoPreviewModal from './DocumentoPreviewModal'

interface Props {
  pdfId: string
  storagePath: string
  filename: string
  isMaster: boolean
  size?: 'sm' | 'md'
  /**
   * Si el contenedor (p.ej. una tarjeta clicable en `DocumentosSection`) ya
   * tiene su propio estado de preview y quiere que "Ver" comparta ese mismo
   * modal en vez de abrir uno propio, pasa este callback. Si se omite, el
   * componente gestiona su propio modal — sigue siendo usable de forma
   * autónoma.
   */
  onVer?: () => void
}

/**
 * Barra de acciones de un documento: Ver (preview en modal), Descargar y,
 * solo para master, Eliminar. Un único componente para que la tarjeta de
 * `DocumentosSection` no tenga que orquestar Descargar/Eliminar por su cuenta.
 */
export default function DocumentoAcciones({ pdfId, storagePath, filename, isMaster, size = 'sm', onVer }: Props) {
  const [preview, setPreview] = useState(false)
  const abrirPreview = onVer ?? (() => setPreview(true))

  const compact = size === 'sm'
  const padding = compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const iconSize = compact ? 12 : 14

  return (
    <>
      <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={abrirPreview}
          className={`inline-flex items-center gap-1.5 ${padding} ${fontSize} font-medium rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
          aria-label={`Ver ${filename}`}
        >
          <Eye size={iconSize} />
          Ver
        </button>
        <DocumentoDownloadBtn storagePath={storagePath} filename={filename} size={size} />
        {isMaster && (
          <DocumentoDeleteBtn pdfId={pdfId} filename={filename} size={size} />
        )}
      </div>

      {!onVer && preview && (
        <DocumentoPreviewModal
          storagePath={storagePath}
          filename={filename}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  )
}
