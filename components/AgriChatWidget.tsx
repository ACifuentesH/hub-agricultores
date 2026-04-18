'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface Props {
  /** agricultor key for the user's own data; master overrides via ?agricultor= */
  defaultAgricultorKey: string | null
  isMaster: boolean
}

const SUGGESTED = [
  '¿Cómo está mi cultivo hoy?',
  '¿Conviene aplicar urea esta semana?',
  '¿Qué riesgo de lluvia hay?',
  '¿Cuándo es la mejor fecha para sembrar?',
]

/**
 * Floating chat widget — appears bottom-right on every authenticated page.
 * Calls the agri-asistente edge function with the current agricultor's
 * platform context (lotes, clima, pronóstico) and Gemini Flash.
 */
export default function AgriChatWidget({ defaultAgricultorKey, isMaster }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  // Master override via ?agricultor=KEY
  const agricultorKey = (isMaster ? searchParams.get('agricultor') : null) ?? defaultAgricultorKey

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const userMsg: Message = { role: 'user', content: trimmed, ts: Date.now() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agri-asistente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: JSON.stringify({ pregunta: trimmed, agricultor_key: agricultorKey }),
      })
      const json = await res.json()
      const reply = json?.ok ? json.respuesta : `Error: ${json?.error ?? 'No se pudo obtener respuesta.'}`
      setMessages((m) => [...m, { role: 'assistant', content: reply, ts: Date.now() }])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error de red'
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${errMsg}`, ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente agrónomo"
          className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-green-700 hover:bg-green-800 text-white shadow-xl transition-all hover:scale-105"
          style={{ boxShadow: '0 0 30px rgba(34, 197, 94, 0.35)' }}
        >
          <MessageCircle size={22} />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-3rem))] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-green-700 to-green-800 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/15">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Asistente agrónomo</p>
                <p className="text-[10px] text-green-100 leading-tight">Powered by Gemini · contexto de tu finca</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50 dark:bg-gray-950/50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Hola 👋 Pregúntame sobre tus lotes, el clima o recomendaciones agronómicas.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">Preguntas sugeridas</p>
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors text-gray-700 dark:text-gray-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.ts} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-green-700 text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-green-600" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Consultando datos…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={agricultorKey ? 'Escribe tu pregunta…' : 'Selecciona un agricultor primero'}
                disabled={loading || !agricultorKey}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-green-500 focus:outline-none disabled:opacity-50 text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !agricultorKey}
                aria-label="Enviar"
                className="p-2 rounded-lg bg-green-700 hover:bg-green-800 text-white disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors"
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
