'use client'

import { useState, useEffect, useCallback } from 'react'
import { LifeBuoy, X, Send, Loader2, Check, CircleDot, CircleCheck } from 'lucide-react'
import { formatDateShort } from '@/lib/freshness'

interface Ticket {
  id: string
  asunto: string
  mensaje: string
  categoria: string
  estado: 'abierto' | 'respondido' | 'cerrado'
  respuesta: string | null
  respondido_at: string | null
  created_at: string
}

const CATEGORIAS = [
  { id: 'general', label: 'General' },
  { id: 'clima', label: 'Clima' },
  { id: 'cultivo', label: 'Cultivo' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'datos_incorrectos', label: 'Un dato está mal' },
]

/**
 * Buzón de preguntas para responder en diferido.
 *
 * Complementa el botón de WhatsApp: aquel sirve para lo urgente pero se pierde
 * en la conversación; esto queda registrado, con estado, y el agricultor puede
 * volver a leer la respuesta cuando quiera.
 */
export default function TicketsWidget() {
  const [abierto, setAbierto] = useState(false)
  const [vista, setVista] = useState<'nuevo' | 'lista'>('nuevo')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [categoria, setCategoria] = useState('general')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/tickets')
      if (r.status === 401) { setError('Tu sesión expiró. Vuelve a iniciar sesión.'); return }
      const j = await r.json()
      if (j.ok) setTickets(j.tickets)
    } catch { /* sin red: la lista queda vacía, el formulario sigue usable */ }
  }, [])

  useEffect(() => { if (abierto) void cargar() }, [abierto, cargar])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asunto, mensaje, categoria }),
      })
      if (r.status === 401) {
        setError('Tu sesión expiró. Vuelve a iniciar sesión y tu pregunta se podrá enviar.')
        return
      }
      const j = await r.json()
      if (!j.ok) { setError(j.error ?? 'No se pudo enviar'); return }
      setAsunto(''); setMensaje(''); setCategoria('general')
      setEnviado(true)
      void cargar()
      setTimeout(() => setEnviado(false), 3500)
      setVista('lista')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setEnviando(false)
    }
  }

  const sinLeer = tickets.filter(t => t.estado === 'respondido').length

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        aria-label="Dejar una pregunta al equipo"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-700 text-white shadow-xl transition-all hover:scale-105 hover:bg-violet-800"
      >
        <LifeBuoy size={22} />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white">
            {sinLeer}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 left-6 z-40 flex h-[min(560px,calc(100vh-3rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-700 to-violet-800 px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-white/15 p-1.5"><LifeBuoy size={16} /></div>
          <div>
            <p className="text-sm font-semibold leading-tight">Preguntas al equipo</p>
            <p className="text-[10px] leading-tight text-violet-100">Te respondemos y queda registrado</p>
          </div>
        </div>
        <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1.5 hover:bg-white/15">
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {(['nuevo', 'lista'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              vista === v
                ? 'border-b-2 border-violet-600 text-violet-700 dark:text-violet-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {v === 'nuevo' ? 'Nueva pregunta' : `Mis preguntas${tickets.length ? ` (${tickets.length})` : ''}`}
          </button>
        ))}
      </div>

      {vista === 'nuevo' ? (
        <form onSubmit={enviar} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {enviado && (
            <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-300">
              <Check size={14} /> Enviada. Te responderemos por aquí.
            </p>
          )}
          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Tema
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>

          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Asunto
            <input
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              maxLength={140}
              placeholder="¿Sobre qué es tu pregunta?"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          <label className="flex flex-1 flex-col text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Tu pregunta
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              maxLength={4000}
              placeholder="Cuéntanos con detalle…"
              className="mt-1 min-h-[120px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={enviando || asunto.trim().length < 3 || mensaje.trim().length < 5}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:bg-gray-300 dark:disabled:bg-gray-700"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar pregunta
          </button>
        </form>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto bg-gray-50/50 p-3 dark:bg-gray-950/40">
          {tickets.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Todavía no has enviado preguntas.
            </p>
          )}
          {tickets.map(t => (
            <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t.asunto}</p>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  t.estado === 'respondido'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {t.estado === 'respondido' ? <CircleCheck size={10} /> : <CircleDot size={10} />}
                  {t.estado === 'respondido' ? 'Respondida' : 'En espera'}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {t.mensaje}
              </p>
              <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                {formatDateShort(t.created_at)}
              </p>
              {t.respuesta && (
                <div className="mt-2.5 rounded-md border-l-2 border-green-500 bg-green-50/60 p-2.5 dark:bg-green-950/25">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-green-800 dark:text-green-300">
                    Respuesta del equipo
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                    {t.respuesta}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
