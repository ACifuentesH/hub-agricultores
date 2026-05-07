'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Upload, Loader2, Check, X, FileText, AlertCircle } from 'lucide-react'

interface Agricultor {
  AgricultorKey: string
  nombre_agropecuaria: string
  ciclo: string | null
}

interface PendingFile {
  id: string
  file: File
  suggestedKey: string | null
  suggestedName: string | null
  similitud: number | null
  finalKey: string  // selected by user
  ciclo: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMsg?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Drag & drop multi-file uploader para PDFs de análisis de suelo (rol master).
 * Por cada archivo dropeado:
 *   1. Llama RPC `match_archivo_a_agricultor` para sugerir agricultor
 *   2. Permite cambiar manualmente el agricultor + ciclo si la sugerencia es baja
 *   3. Sube en paralelo y crea registro en lote_analisis_suelo
 */
export default function AnalisisSueloUploader({ agricultores }: { agricultores: Agricultor[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<PendingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadingAll, setUploadingAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)

  const onFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (arr.length === 0) return

    // Crear entries con sugerencias en paralelo
    const newPending: PendingFile[] = await Promise.all(
      arr.map(async (file) => {
        const { data } = await supabase.rpc('match_archivo_a_agricultor', { filename: file.name })
        const top = Array.isArray(data) && data.length > 0 ? data[0] : null
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
          file,
          suggestedKey: top?.agricultor_key ?? null,
          suggestedName: top?.nombre_agropecuaria ?? null,
          similitud: top?.similitud ?? null,
          finalKey: top?.agricultor_key ?? '',
          ciclo: top?.ciclo?.includes('2026') ? '2026' : (top?.ciclo ?? '2026'),
          status: 'pending',
        }
      })
    )

    setPending(prev => [...prev, ...newPending])
  }, [supabase])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) onFiles(e.dataTransfer.files)
  }, [onFiles])

  const updateRow = (id: string, patch: Partial<PendingFile>) => {
    setPending(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const removeRow = (id: string) => {
    setPending(prev => prev.filter(p => p.id !== id))
  }

  async function uploadOne(p: PendingFile): Promise<void> {
    if (!p.finalKey) {
      updateRow(p.id, { status: 'error', errorMsg: 'Asigna un agricultor primero' })
      return
    }
    updateRow(p.id, { status: 'uploading' })

    // Path: <AgricultorKey>/<ciclo>/<timestamp>_<safeFilename>.pdf
    const safe = p.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
    const path = `${p.finalKey}/${p.ciclo}/${Date.now()}_${safe}`

    const { error: upErr } = await supabase.storage
      .from('analisis-suelo')
      .upload(path, p.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      })

    if (upErr) {
      updateRow(p.id, { status: 'error', errorMsg: upErr.message })
      return
    }

    // Cada PDF representa un LOTE distinto dentro de la misma finca, no es una
    // versión del análisis. Todos los registros coexisten como vigentes.
    const { error: insErr } = await supabase
      .from('lote_analisis_suelo')
      .insert({
        agricultor_key: p.finalKey,
        ciclo: p.ciclo,
        storage_path: path,
        nombre_archivo: p.file.name,
        tamano_bytes: p.file.size,
        es_vigente: true,
      })

    if (insErr) {
      // rollback: borrar el archivo subido
      await supabase.storage.from('analisis-suelo').remove([path])
      updateRow(p.id, { status: 'error', errorMsg: insErr.message })
      return
    }

    updateRow(p.id, { status: 'done' })
  }

  async function uploadAll() {
    setUploadingAll(true)
    const targets = pending.filter(p => p.status === 'pending' && p.finalKey)
    // De a 4 en paralelo para no saturar
    const concurrency = 4
    for (let i = 0; i < targets.length; i += concurrency) {
      await Promise.all(targets.slice(i, i + concurrency).map(uploadOne))
    }
    setUploadingAll(false)
    router.refresh()
    // Limpiar los completados después de 3 s
    setTimeout(() => {
      setPending(prev => prev.filter(p => p.status !== 'done'))
    }, 3000)
  }

  const pendingCount = pending.filter(p => p.status === 'pending' && p.finalKey).length
  const errorCount = pending.filter(p => p.status === 'error').length
  const doneCount = pending.filter(p => p.status === 'done').length

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-green-500 bg-green-50/50 dark:bg-green-950/30'
            : 'border-gray-300 dark:border-gray-700 hover:border-green-400 hover:bg-gray-50/50 dark:hover:bg-gray-900/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
        <Upload size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Arrastra PDFs aquí o haz clic para seleccionar
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Multi-selección permitida · auto-asigna por nombre del archivo
        </p>
      </div>

      {/* Pending list */}
      {pending.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold text-gray-700 dark:text-gray-200">{pending.length}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">archivo{pending.length === 1 ? '' : 's'} en cola</span>
              {doneCount > 0 && <span className="text-green-600 dark:text-green-400 ml-2">· {doneCount} subido{doneCount === 1 ? '' : 's'}</span>}
              {errorCount > 0 && <span className="text-red-600 dark:text-red-400 ml-2">· {errorCount} error{errorCount === 1 ? '' : 'es'}</span>}
            </div>
            <button
              type="button"
              onClick={uploadAll}
              disabled={uploadingAll || pendingCount === 0}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-700 hover:bg-green-800 text-white disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {uploadingAll
                ? <><Loader2 size={14} className="animate-spin" /> Subiendo…</>
                : <>Subir {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}</>}
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[420px] overflow-y-auto">
            {pending.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {/* Selector de agricultor */}
                    <select
                      value={p.finalKey}
                      onChange={(e) => updateRow(p.id, { finalKey: e.target.value })}
                      disabled={p.status === 'uploading' || p.status === 'done'}
                      className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 max-w-[280px] truncate"
                    >
                      <option value="">— Asignar agricultor —</option>
                      {agricultores.map(a => (
                        <option key={a.AgricultorKey} value={a.AgricultorKey}>
                          {a.nombre_agropecuaria}
                          {a.ciclo && ` (${a.ciclo})`}
                        </option>
                      ))}
                    </select>
                    {/* Ciclo */}
                    <select
                      value={p.ciclo}
                      onChange={(e) => updateRow(p.id, { ciclo: e.target.value })}
                      disabled={p.status === 'uploading' || p.status === 'done'}
                      className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                    {/* Sugerencia */}
                    {p.suggestedName && p.similitud != null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.similitud > 0.5
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        sugerido {Math.round(p.similitud * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                {/* Status icon */}
                <div className="shrink-0 flex items-center gap-2">
                  {p.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => removeRow(p.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Quitar"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {p.status === 'uploading' && <Loader2 size={16} className="animate-spin text-green-600" />}
                  {p.status === 'done' && <Check size={16} className="text-green-600" />}
                  {p.status === 'error' && (
                    <span title={p.errorMsg} className="text-red-600 inline-flex items-center gap-1">
                      <AlertCircle size={16} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
