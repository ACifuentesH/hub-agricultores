'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FileText, ChevronDown, Download } from 'lucide-react'
import { labelCategoria } from '@/lib/documentos'
import { formatDateShort } from '@/lib/freshness'

export interface DocReciente {
  id: string
  nombre_archivo: string
  categoria: string
  uploaded_at: string
  storage_path: string
}

/**
 * Últimos documentos cargados para el agricultor.
 *
 * Va al final del dashboard, así que es fácil que nadie sepa que existe. Por eso
 * lleva un indicador de desplazamiento: aparece flotando cuando la sección aún
 * está fuera de pantalla y hay documentos que ver, y desaparece en cuanto el
 * usuario llega. Solo insiste si hay algo nuevo que mostrar; si no hay
 * documentos, no molesta.
 */
export default function MisComunicaciones({ docs }: { docs: DocReciente[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!docs.length || !ref.current) return
    const io = new IntersectionObserver(
      ([e]) => setVisible(!e.isIntersecting),
      { threshold: 0.25 },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [docs.length])

  function irASeccion() {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div ref={ref} className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
            <FileText size={18} className="text-violet-600" />
            Mis comunicaciones
          </h2>
          <Link
            href="/documentacion"
            className="text-xs font-medium text-green-700 hover:underline dark:text-green-400"
          >
            Ver todos los documentos
          </Link>
        </div>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            Todavía no hay documentos cargados para ti. Cuando el equipo suba un
            análisis de suelo, un mapa o un convenio, aparecerá aquí.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {docs.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <FileText size={15} className="shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                    {d.nombre_archivo}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {labelCategoria(d.categoria)} · {formatDateShort(d.uploaded_at)}
                  </p>
                </div>
                <Link
                  href="/documentacion"
                  aria-label={`Abrir ${d.nombre_archivo} en Documentación`}
                  className="shrink-0 rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-green-700 dark:hover:bg-gray-800 dark:hover:text-green-400"
                >
                  <Download size={15} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Aviso flotante: solo mientras la sección no se ve y hay algo que mostrar */}
      {docs.length > 0 && visible && (
        <button
          type="button"
          onClick={irASeccion}
          className="mc-aviso fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:border-green-500 hover:text-green-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-green-400"
        >
          <FileText size={15} className="text-violet-600" />
          {docs.length} documento{docs.length === 1 ? '' : 's'} para ti
          <ChevronDown size={15} className="mc-flecha" />
        </button>
      )}

      <style>{`
        .mc-aviso { animation: mcEntrar 400ms ease-out both; }
        .mc-flecha { animation: mcRebote 1.8s ease-in-out infinite; }
        @keyframes mcEntrar { from { opacity: 0; transform: translate(-50%, 12px); } }
        @keyframes mcRebote { 0%,100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
        @media (prefers-reduced-motion: reduce) {
          .mc-aviso, .mc-flecha { animation: none; }
        }
      `}</style>
    </>
  )
}
