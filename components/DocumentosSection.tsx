import { createClient } from '@/lib/supabase/server'
import AnalisisSueloDownloadBtn from './AnalisisSueloDownloadBtn'
import AnalisisSueloDeleteBtn from './AnalisisSueloDeleteBtn'
import { FileText, AlertCircle } from 'lucide-react'
import type { CategoriaId } from '@/lib/documentos'

interface Props {
  agricultorKey: string
  isMaster: boolean
  /** Ciclo activo del selector lateral. */
  ciclo: string
  categoria: CategoriaId
  titulo: string
  descripcion: string
  icono: React.ReactNode
}

/**
 * Una sección del módulo Documentación (análisis de suelo, mapas, caso de
 * negocio o convenios). Lista los archivos de esa categoría para el agricultor
 * y ciclo en contexto. La carga de archivos vive en el uploader único de la
 * página, no aquí.
 */
export default async function DocumentosSection({
  agricultorKey,
  isMaster,
  ciclo,
  categoria,
  titulo,
  descripcion,
  icono,
}: Props) {
  const supabase = await createClient()

  const [{ data: docs }, { data: lotesRef }] = await Promise.all([
    supabase
      .from('lote_analisis_suelo')
      .select('id, ciclo, lote_id, storage_path, nombre_archivo, tamano_bytes, uploaded_at')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo)
      .eq('categoria', categoria)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('lote')
      .select('lote_id, nombre_lote')
      .eq('AgricultorKey', agricultorKey)
      .eq('ciclo', ciclo),
  ])

  const nombreLote = new Map(
    (lotesRef ?? []).map(l => [l.lote_id as string, (l.nombre_lote as string | null) ?? (l.lote_id as string)])
  )

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 shrink-0 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">{icono}</div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{titulo}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{descripcion}</p>
          </div>
        </div>
        {docs && docs.length > 0 && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {docs.length}
          </span>
        )}
      </div>

      {docs && docs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Archivo</th>
                <th className="px-4 py-3 text-left">Lote</th>
                <th className="px-4 py-3 text-left">Subido</th>
                <th className="px-4 py-3 text-right">Tamaño</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {docs.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="shrink-0 text-red-500" />
                      <span className="max-w-[280px] truncate font-medium text-gray-800 dark:text-gray-100">
                        {d.nombre_archivo}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {d.lote_id ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        {nombreLote.get(d.lote_id) ?? d.lote_id}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Toda la finca</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(d.uploaded_at).toLocaleString('es-VE', {
                      day: 'numeric', month: 'short', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                    {d.tamano_bytes ? `${(d.tamano_bytes / 1024).toFixed(0)} KB` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <AnalisisSueloDownloadBtn
                        storagePath={d.storage_path}
                        filename={d.nombre_archivo}
                        size="sm"
                      />
                      {isMaster && (
                        <AnalisisSueloDeleteBtn
                          pdfId={d.id}
                          storagePath={d.storage_path}
                          filename={d.nombre_archivo}
                          size="sm"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
