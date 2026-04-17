'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AnimatedLeaves from '@/components/AnimatedLeaves'

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

    // Check role to redirect
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    if (profile?.role === 'master') {
      router.push('/master')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      className="relative min-h-screen bg-cover bg-center flex items-center justify-center overflow-hidden"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Overlay con gradiente verde para mejor contraste y atmósfera */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/40 via-green-900/30 to-emerald-950/60" />
      <AnimatedLeaves />

      <div className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-sm mx-4">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 text-center mb-6 leading-tight">
          Sustainable Agri-Platform Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 text-gray-700 dark:text-gray-200"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 pr-20 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 text-gray-700 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 hover:text-green-800 font-medium"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-800 hover:bg-green-900 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Login'}
          </button>
        </form>

        <p className="text-center mt-4 text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:underline">
          Forgot Password?
        </p>
      </div>
    </div>
  )
}
