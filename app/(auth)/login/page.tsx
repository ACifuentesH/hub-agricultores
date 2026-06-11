'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sprout, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Credenciales incorrectas. Intenta de nuevo.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    router.push(profile?.role === 'master' ? '/master' : '/dashboard')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-5 bg-white dark:bg-gray-950">
      {/* Brand panel — left 60% on desktop */}
      <div
        className="relative lg:col-span-3 hidden lg:flex flex-col justify-between p-12 text-white bg-cover bg-center"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/80 via-green-900/50 to-emerald-950/85" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
            <Sprout size={18} />
          </div>
          <span className="font-semibold tracking-tight">Agri Platform</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-green-300">
            Polar en el Campo
          </p>
          <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight">
            Gestión integral del programa agrícola.
          </h1>
          <p className="text-base text-green-100/80 leading-relaxed max-w-md">
            Monitoreo de clima, siembra, cosecha y rentabilidad por lote — toda la operación de tus
            agricultores en un solo lugar.
          </p>

          <div className="flex items-center gap-8 pt-4 border-t border-white/15">
            <div>
              <p className="text-2xl font-semibold">50+</p>
              <p className="text-xs text-green-200/70 mt-0.5">Agricultores</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">10K+</p>
              <p className="text-xs text-green-200/70 mt-0.5">Hectáreas</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">44</p>
              <p className="text-xs text-green-200/70 mt-0.5">Estaciones en vivo</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-green-200/60">
          © {new Date().getFullYear()} Polar en el Campo
        </div>
      </div>

      {/* Form panel — right 40% on desktop, full width on mobile */}
      <div className="lg:col-span-2 flex flex-col justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-lg bg-green-800 flex items-center justify-center text-white">
              <Sprout size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 leading-none">Agri Platform</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Polar en el Campo</p>
            </div>
          </div>

          <div className="space-y-1.5 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Bienvenido de vuelta
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 transition-shadow"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Contraseña
                </label>
                <a
                  href="#"
                  className="text-xs text-green-800 dark:text-green-400 hover:underline"
                >
                  ¿Olvidaste?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
              className="group w-full inline-flex items-center justify-center gap-2 bg-green-800 hover:bg-green-900 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow"
            >
              {loading ? 'Ingresando...' : (
                <>
                  Ingresar
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-10">
            Acceso restringido · Polar en el Campo
          </p>
        </div>
      </div>
    </div>
  )
}
