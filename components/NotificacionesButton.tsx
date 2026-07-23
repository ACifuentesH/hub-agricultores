'use client'

import { useState, useEffect, useMemo } from 'react'
import { Bell, X, CloudRain, FileText, Clock } from 'lucide-react'

export interface Novedad {
  id: string
  tipo: 'clima' | 'documento' | 'dato_viejo'
  titulo: string
  detalle: string
  /** ISO timestamp que define si es "nueva" respecto a la última visita */
  fecha: string
}

/**
 * Centro de novedades del dashboard.
 *
 * Las novedades se calculan en el servidor y llegan como prop; aquí solo se
 * decide cuáles son "no leídas" comparando su fecha contra la última visita,
 * guardada en localStorage por agricultor. Se eligió localStorage en lugar de
 * una tabla porque no requiere cambios de esquema; si más adelante hace falta
 * sincronizar entre dispositivos, se migra a base de datos.
 */
export default function NotificacionesButton({
  novedades,
  agricultorKey,
}: {
  novedades: Novedad[]
  agricultorKey: string
}) {
  const [open, setOpen] = useState(false)
  const [ultimaVisita, setUltimaVisita] = useState<number | null>(null)
  const [montado, setMontado] = useState(false)

  const storageKey = `notif_visto_${agricultorKey}`

  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    setUltimaVisita(raw ? Number(raw) : 0)
    setMontado(true)
  }, [storageKey])

  const noLeidas = useMemo(() => {
    if (ultimaVisita == null) return 0
    return novedades.filter(n => new Date(n.fecha).getTime() > ultimaVisita).length
  }, [novedades, ultimaVisita])

  function abrir() {
    setOpen(true)
    const ahora = Date.now()
    localStorage.setItem(storageKey, String(ahora))
    setUltimaVisita(ahora)
  }

  // Evita parpadeo del contador entre SSR e hidratación
  const mostrarBadge = montado && noLeidas > 0

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-label={`Novedades${mostrarBadge ? ` (${noLeidas} sin leer)` : ''}`}
        className="relative rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Bell size={18} />
        {mostrarBadge && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Novedades</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar novedades"
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[320px] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
            {novedades.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sin novedades por ahora.
              </p>
            )}
            {novedades.map(n => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 shrink-0">
                  {n.tipo === 'clima' && <CloudRain size={15} className="text-blue-500" />}
                  {n.tipo === 'documento' && <FileText size={15} className="text-green-600" />}
                  {n.tipo === 'dato_viejo' && <Clock size={15} className="text-amber-500" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{n.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{n.detalle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
