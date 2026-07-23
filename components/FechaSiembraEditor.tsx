'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Loader2, AlertTriangle, Check } from 'lucide-react'

interface Props {
  loteId: string
  loteNombre: string
  fechaActual: string | null
}

/**
 * Carga/corrección manual de la fecha de siembra real de un lote (solo master).
 *
 * Pide confirmación explícita antes de guardar porque la fecha de siembra
 * determina la etapa fenológica de todo el lote: un error corre la línea de
 * tiempo completa y las recomendaciones asociadas.
 */
export default function FechaSiembraEditor({ loteId, loteNombre, fechaActual }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(fechaActual ?? '')
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const hoy = new Date().toISOString().slice(0, 10)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/lote/siembra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote_id: loteId, fecha }),
      })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? 'No se pudo guardar')
        setConfirmando(false)
        return
      }
      setOk(true)
      setConfirmando(false)
      setAbierto(false)
      router.refresh()
      setTimeout(() => setOk(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      setConfirmando(false)
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-green-500 hover:text-green-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:text-green-400"
      >
        {ok ? <Check size={13} className="text-green-600" /> : <CalendarPlus size={13} />}
        {ok ? 'Guardado' : fechaActual ? 'Cambiar fecha' : 'Indicar siembra'}
      </button>
    )
  }

  return (
    <div className="inline-flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Fecha de siembra · {loteNombre}
      </label>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={e => { setFecha(e.target.value); setConfirmando(false); setError(null) }}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        {!confirmando ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={!fecha || fecha === (fechaActual ?? '')}
              className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-800 disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => { setAbierto(false); setFecha(fechaActual ?? ''); setError(null) }}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </>
        ) : null}
      </div>

      {/* Confirmación explícita: la fecha mueve toda la línea de tiempo */}
      {confirmando && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                ¿Seguro que quieres cambiar la fecha de siembra de <b>{loteNombre}</b>
                {fechaActual ? <> de <b>{fechaActual}</b></> : null} a <b>{fecha}</b>?
                <br />
                Esto recalcula la etapa del cultivo y su línea de tiempo.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {guardando && <Loader2 size={12} className="animate-spin" />}
                  Sí, cambiar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={guardando}
                  className="rounded-md px-2 py-1 text-xs text-amber-800 transition-colors hover:underline dark:text-amber-300"
                >
                  No, volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
