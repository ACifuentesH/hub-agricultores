'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

interface Props {
  /** Nombre del agricultor que se autoidentifica al soporte */
  agricultorNombre: string
  /** Key canónica del agricultor (ayuda al equipo a localizarlo en DB) */
  agricultorKey: string
  /** Rol del usuario logueado (para que el soporte sepa con quién habla) */
  role: 'master' | 'farmer'
}

const PHONE = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE ?? ''

const SUGERENCIAS = [
  { titulo: 'Problema con lotes', texto: 'tengo un problema con mis lotes y necesito ayuda.' },
  { titulo: 'Discrepancia en hectáreas', texto: 'tengo una discrepancia en la información de las hectáreas.' },
  { titulo: 'Página no se actualiza', texto: 'la página no se actualiza correctamente.' },
  { titulo: 'Montos del P&L', texto: 'los montos del P&L cambiaron y no están reflejados.' },
  { titulo: 'Problema con informes', texto: 'tengo un problema con los informes/PDFs.' },
] as const

/**
 * Widget flotante de soporte por WhatsApp.
 *
 * Posición: bottom-left (NO choca con AgriChatWidget que está en bottom-right).
 * Solo aparece si NEXT_PUBLIC_WHATSAPP_SOPORTE está configurado.
 *
 * Cada mensaje pre-carga identificación del agricultor:
 *   "Soy <nombre> (rol: farmer, key: XXX). <mensaje>"
 *
 * Esto evita que el humano de soporte tenga que preguntar quién es y
 * dónde buscarlo en la base de datos.
 */
export default function SoporteWhatsAppWidget({ agricultorNombre, agricultorKey, role }: Props) {
  const [open, setOpen] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Si no hay número configurado, no rendericemos nada (silencioso)
  if (!PHONE) return null

  // Focus al textarea al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  function buildUrl(textoMensaje: string): string {
    const identificacion = `Soy ${agricultorNombre} (${role}, key: ${agricultorKey}).`
    const texto = `${identificacion} ${textoMensaje.trim()}`
    return `https://wa.me/${PHONE}?text=${encodeURIComponent(texto)}`
  }

  function abrirWhatsApp(textoMensaje: string) {
    if (!textoMensaje.trim()) return
    window.open(buildUrl(textoMensaje), '_blank', 'noopener,noreferrer')
    setOpen(false)
    setMensaje('')
  }

  return (
    <>
      {/* Floating action button (bottom-LEFT para no chocar con AgriChat) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir soporte por WhatsApp"
          className="fixed bottom-6 left-6 z-40 p-4 rounded-full text-white shadow-xl transition-all hover:scale-105"
          style={{
            background: '#25D366',
            boxShadow: '0 0 30px rgba(37, 211, 102, 0.45)',
          }}
        >
          {/* WhatsApp SVG icon */}
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
          </svg>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-6 left-6 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-3rem))] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-white"
            style={{ background: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/15">
                <MessageCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Soporte WhatsApp</p>
                <p className="text-[10px] text-green-50 leading-tight">Te respondemos por WhatsApp</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar soporte"
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-gray-50/50 dark:bg-gray-950/50">
            {/* Identificación visible */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">
                Te identificarás como
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">
                {agricultorNombre}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {role === 'master' ? 'Master corporativo' : 'Agricultor'} · {agricultorKey}
              </p>
            </div>

            {/* Sugerencias */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium px-1">
                Mensajes rápidos
              </p>
              {SUGERENCIAS.map((s) => (
                <button
                  key={s.titulo}
                  onClick={() => abrirWhatsApp(s.texto)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors text-gray-700 dark:text-gray-200"
                >
                  <div className="font-medium">{s.titulo}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {s.texto}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mensaje libre */}
          <form
            onSubmit={(e) => { e.preventDefault(); abrirWhatsApp(mensaje) }}
            className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2"
          >
            <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium px-1">
              O escribe tu mensaje
            </p>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Describe tu problema…"
                rows={2}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-green-500 focus:outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 resize-none"
              />
              <button
                type="submit"
                disabled={!mensaje.trim()}
                aria-label="Enviar a WhatsApp"
                className="p-2.5 rounded-lg text-white disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors"
                style={{ background: mensaje.trim() ? '#25D366' : undefined }}
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
