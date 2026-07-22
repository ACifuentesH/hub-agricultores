import { createClient, createServiceClient } from '@/lib/supabase/server'
import AnalisisSueloUploader from './AnalisisSueloUploader'
import AnalisisSueloDownloadBtn from './AnalisisSueloDownloadBtn'
import AnalisisSueloDeleteBtn from './AnalisisSueloDeleteBtn'
import { FileText, AlertCircle } from 'lucide-react'

interface Props {
  agricultorKey: string
  isMaster: boolean
  /** Ciclo activo del selector lateral: filtra PDFs y lotes mostrados. */
  ciclo: string
}

/**
 * Sección "Análisis de suelo (PDF)" del módulo Suelo.
 *  - Master: ve uploader (drag&drop) + lista de TODOS sus PDFs (filtrada por agricultor seleccionado)
 *  - Farmer: solo ve su lista descargable
 */
export default async function AnalisisSueloSection({ agricultorKey, isMaster, ciclo }: Props) {
  const supabase = await createClient()

  // Lista de PDFs ya subidos para el agricultor en contexto
  const [{ data: pdfs }, { data: lotesRef }] = await Promise.all([
    supabase
      .from('lote_analisis_suelo')
      .select('id, ciclo, lote_id, storage_path, nombre_archivo, tamano_bytes, uploaded_at, es_vigente, observaciones')
      .eq('agricultor_key', agricultorKey)
      .eq('ciclo', ciclo)
      .order('uploaded_at', { ascending: false }),
    // Para resolver lote_id → nombre legible en la columna "Lote"
    supabase
      .from('lote')
      .select('lote_id, nombre_lote')
      .eq('AgricultorKey', agricultorKey)
      .eq('ciclo', ciclo),
  ])
  const nombreLote = new Map(
    (lotesRef ?? []).map(l => [l.lote_id as string, (l.nombre_lote as string | null) ?? (l.lote_id as string)])
  )

  // Para master: lista global de agricultores (para el dropdown del uploader)
  let agricultoresParaMaster: { AgricultorKey: string; nombre_agropecuaria: string; ciclo: string | null }[] = []
  if (isMaster) {
    const svc = createServiceClient()
    const { data } = await svc
      .from('agropecuaria')
      .select('AgricultorKey, nombre_agropecuaria, ciclo')
      .order('nombre_agropecuaria')
    agricultoresParaMaster = data ?? []
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Análisis de suelo (PDF)</h2>
        {pdfs && pdfs.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {pdfs.length} archivo{pdfs.length === 1 ? '' : 's'} en el histórico
          </span>
        )}
      </div>

      {isMaster && (
        <AnalisisSueloUploader agricultores={agricultoresParaMaster} />
      )}

      {pdfs && pdfs.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Archivo</th>
                <th className="px-4 py-3 text-left">Ciclo</th>
                <th className="px-4 py-3 text-left">Lote</th>
                <th className="px-4 py-3 text-left">Subido</th>
                <th className="px-4 py-3 text-right">Tamaño</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pdfs.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-red-500 shrink-0" />
                      <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[280px]">{p.nombre_archivo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{p.ciclo}</td>
                  <td className="px-4 py-2.5">
                    {p.lote_id ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        {nombreLote.get(p.lote_id) ?? p.lote_id}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Toda la finca</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(p.uploaded_at).toLocaleString('es-VE', {
                      day: 'numeric', month: 'short', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                    {p.tamano_bytes ? `${(p.tamano_bytes / 1024).toFixed(0)} KB` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <AnalisisSueloDownloadBtn
                        storagePath={p.storage_path}
                        filename={p.nombre_archivo}
                        size="sm"
                      />
                      {isMaster && (
                        <AnalisisSueloDeleteBtn
                          pdfId={p.id}
                          storagePath={p.storage_path}
                          filename={p.nombre_archivo}
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
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold text-gray-700 dark:text-gray-300">
              {isMaster
                ? `No hay análisis de suelo del ciclo ${ciclo} para este agricultor.`
                : `No hay análisis de suelo del ciclo ${ciclo} todavía.`}
            </p>
            <p className="text-xs mt-1 leading-relaxed">
              {isMaster
                ? 'Arrastra los PDFs en el área de arriba para asignarlos.'
                : 'El equipo agronómico cargará los análisis cuando estén listos.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
