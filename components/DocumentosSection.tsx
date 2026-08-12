import { createClient } from '@/lib/supabase/server'
import DocumentoCard from './DocumentoCard'
import { AlertCircle } from 'lucide-react'
import type { CategoriaId } from '@/lib/documentos'

interface Props {
  agricultorKey: string
  isMaster: boolean
  /** Ciclo activo del selector lateral. */
  ciclo: string
  categoria: CategoriaId
  descripcion: string
}

/**
 * Documentos de UNA categoría (la que esté activa en `DocumentoCategoriaTabs`)
 * para el agricultor y ciclo en contexto, como grilla de tarjetas con preview
 * en modal. Ya no muestra icono/título propios: la pestaña activa en la
 * navegación superior ya identifica qué categoría se está viendo — repetirlo
 * acá era la "división apilada" que no gustaba. La carga de archivos vive en
 * el uploader único de la página, no aquí.
 */
export default async function DocumentosSection({
  agricultorKey,
  isMaster,
  ciclo,
  categoria,
  descripcion,
}: Props) {
  const supabase = await createClient()

  const [{ data: docs }, { data: lotesRef }] = await Promise.all([
    supabase
      .from('documentos')
      .select('id, ciclo, lote_id, storage_path, nombre_archivo, tamano_bytes, uploaded_at')
      .eq('agricultor_id', agricultorKey)
      .eq('ciclo', ciclo)
      .eq('categoria', categoria)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('lotes')
      .select('lote_id, nombre_lote')
      .eq('agricultor_id', agricultorKey)
      .eq('ciclo', ciclo),
  ])

  const nombreLote = new Map(
    (lotesRef ?? []).map(l => [l.lote_id as string, (l.nombre_lote as string | null) ?? (l.lote_id as string)])
  )

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">{descripcion}</p>
        {docs && docs.length > 0 && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {docs.length}
          </span>
        )}
      </div>

      {docs && docs.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map(d => (
            <DocumentoCard
              key={d.id}
              pdfId={d.id}
              storagePath={d.storage_path}
              filename={d.nombre_archivo}
              isMaster={isMaster}
              loteLabel={d.lote_id ? (nombreLote.get(d.lote_id) ?? d.lote_id) : null}
              fecha={new Date(d.uploaded_at).toLocaleString('es-VE', {
                day: 'numeric', month: 'short', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
              tamano={d.tamano_bytes ? `${(d.tamano_bytes / 1024).toFixed(0)} KB` : '—'}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sin documentos del ciclo {ciclo} en esta sección.
            {isMaster
              ? ' Cárgalos desde el área de arriba.'
              : ' El equipo los cargará cuando estén listos.'}
          </p>
        </div>
      )}
    </section>
  )
}
