'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sprout, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react'

/**
 * Candado simple para el modo demo (Supabase Auth suspendido, sin conexión
 * viva). No es seguridad real — solo evita que cualquiera con la URL vea la
 * data sin filtro. La clave vive acá adentro a propósito (temporal, ver
 * AGENTS.md / instrucciones del modo demo): no hace falta que sea
 * configurable por variable de entorno.
 */
const DEMO_ACCESS_KEY = 'DIENN2026'

export default function DemoLoginGate() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (key !== DEMO_ACCESS_KEY) {
      setError('Clave incorrecta.')
      setLoading(false)
      return
    }

    // No-httpOnly a propósito: la lee el propio mock client del browser para
    // saber si hay "sesión" (ver lib/demo/mock-client-browser.ts).
    document.cookie = 'demo_session=1; path=/; max-age=86400'
    router.push('/master')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-green-800 flex items-center justify-center text-white">
            <Sprout size={22} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Programa Saturno</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
              Modo demo — sin conexión en vivo
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4 shadow-sm"
        >
          <div>
            <label htmlFor="demo-key" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Clave de acceso
            </label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="demo-key"
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoFocus
                required
                className="w-full pl-9 pr-10 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                aria-label={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-green-800 hover:bg-green-900 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            Entrar
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
          Datos reales congelados — no reflejan el estado actual del ciclo.
        </p>
      </div>
    </div>
  )
}
