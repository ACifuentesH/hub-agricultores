'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bot, X, Send, Loader2 } from 'lucide-react'
import { PREGUNTAS_SUGERIDAS } from '@/lib/agro-glosario'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface Props {
  /** Key del agricultor del usuario; el master la sobreescribe con ?agricultor= */
  defaultAgricultorKey: string | null
  isMaster: boolean
}

/**
 * Asistente flotante (bottom-right). Sustituye al widget de Gemini: ahora
 * consulta /api/asistente, que responde de forma determinista con los datos
 * reales del productor. Sin API keys y sin riesgo de cifras inventadas.
 */
export default function AsistenteWidget({ defaultAgricultorKey, isMaster }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  const agricultorKey = (isMaster ? searchParams.get('agricultor') : null) ?? defaultAgricultorKey
  const ciclo = searchParams.get('ciclo') ?? undefined

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages(m => [...m, { role: 'user', content: trimmed, ts: Date.now() }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: trimmed, agricultor_key: agricultorKey, ciclo }),
      })
      const json = await res.json()
      const reply = json?.ok
        ? json.respuesta
        : `No pude responder: ${json?.error ?? 'error desconocido'}`
      setMessages(m => [...m, { role: 'assistant', content: reply, ts: Date.now() + 1 }])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error de red'
      setMessages(m => [...m, { role: 'assistant', content: `No pude responder: ${errMsg}`, ts: Date.now() + 1 }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="fixed bottom-6 right-6 z-40 rounded-full bg-green-700 p-4 text-white shadow-xl transition-all hover:scale-105 hover:bg-green-800"
          style={{ boxShadow: '0 0 30px rgba(34, 197, 94, 0.35)' }}
        >
          <Bot size={22} />
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-green-400" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 flex h-[min(560px,calc(100vh-3rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-green-700 to-green-800 px-4 py-3 text-white dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-white/15 p-1.5">
                <Bot size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Asistente</p>
                <p className="text-[10px] leading-tight text-green-100">Responde con los datos de tu finca</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50/50 px-4 py-3 dark:bg-gray-950/50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="py-2 text-center text-sm text-gray-600 dark:text-gray-300">
                  Puedo explicarte tus lotes, su etapa, tus documentos y el clima de tu finca.
                </p>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Preguntas que sé responder
                  </p>
                  {PREGUNTAS_SUGERIDAS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-green-500 hover:bg-green-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-green-950/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.ts} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-green-700 text-white'
                      : 'rounded-bl-sm border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                  <Loader2 size={14} className="animate-spin text-green-600" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Consultando tus datos…</span>
                </div>
              </div>
            )}
          </div>

          {/* Chips siempre visibles: el asistente responde un catálogo acotado,
              así que mostrar sus temas evita que el usuario adivine. */}
          <div className="border-t border-gray-100 bg-white px-3 pt-2.5 dark:border-gray-800 dark:bg-gray-900">
            <p className="px-0.5 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Preguntas que sé responder
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {PREGUNTAS_SUGERIDAS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={loading || !agricultorKey}
                  className="shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-700 transition-colors hover:border-green-500 hover:bg-green-50 hover:text-green-800 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-green-950/40 dark:hover:text-green-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            className="border-t border-gray-100 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={agricultorKey ? 'Escribe tu pregunta…' : 'Selecciona un agricultor primero'}
                disabled={loading || !agricultorKey}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-green-500 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !agricultorKey}
                aria-label="Enviar"
                className="rounded-lg bg-green-700 p-2 text-white transition-colors hover:bg-green-800 disabled:bg-gray-300 dark:disabled:bg-gray-700"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
