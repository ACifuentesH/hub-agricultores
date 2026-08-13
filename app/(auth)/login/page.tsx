'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sprout, ArrowRight, Eye, EyeOff } from 'lucide-react'
import DemoLoginGate from '@/components/DemoLoginGate'

export default function LoginPage() {
  // Modo demo: pantalla de clave en vez del login real (Supabase Auth está
  // suspendido, ver AGENTS.md). Con DEMO_MODE apagado esto nunca se evalúa.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return <DemoLoginGate />
  }
  return <RealLoginForm />
}

function RealLoginForm() {
  const router = useRouter()
  const [modo, setModo] = useState<'cedula' | 'password'>('cedula')
  const [cedula, setCedula] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [anim, setAnim] = useState(true)

  async function handleCedulaLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/session/cedula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula }),
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const body = await res.json().catch(() => ({
      ok: false,
      error:
        res.status === 403
          ? 'La red bloqueó el ingreso (403). Prueba otra red o pide a TI que permita este sitio.'
          : `Error inesperado (${res.status}).`,
    }))

    if (!body.ok) {
      setError(body.error ?? 'No se pudo iniciar sesión.')
      setLoading(false)
      return
    }

    router.push(body.role === 'master' ? '/master' : '/dashboard')
  }

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
    <div
      data-anim={anim ? 'on' : 'off'}
      className="min-h-screen grid lg:grid-cols-5 bg-white dark:bg-gray-950"
    >
      {/* Brand panel — left 60% on desktop */}
      <div className="relative lg:col-span-3 hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden isolate bg-green-950">
        {/* Capa 1 — foto con Ken Burns */}
        <div
          className="absolute -inset-[6%] z-0 bg-cover bg-center login-kenburns"
          style={{ backgroundImage: "url('/login-bg.jpg')" }}
        />

        {/* Capa 2 — degradado de marca (mismas opacidades que hoy) */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-green-950/80 via-green-900/50 to-emerald-950/85" />

        {/* Capa 3 — barrido de luz verde-lima */}
        <div
          className="absolute -inset-[30%] z-[2] blur-2xl mix-blend-screen login-sweep"
          style={{
            background:
              'radial-gradient(45% 40% at 30% 35%, rgba(163,230,53,.30) 0%, rgba(34,197,94,.12) 40%, transparent 72%)',
          }}
        />

        {/* Capa 4 — neblina ámbar */}
        <div
          className="absolute -inset-[20%] z-[2] blur-3xl mix-blend-screen login-haze"
          style={{
            background:
              'radial-gradient(50% 45% at 72% 78%, rgba(234,179,8,.22) 0%, transparent 68%)',
          }}
        />

        {/* Capa 5 — base del campo con vaivén */}
        <div className="absolute inset-x-0 bottom-0 h-[34%] z-[2] bg-gradient-to-t from-green-950/70 to-transparent login-field" />

        {/* Capa 6 — partículas de polen */}
        <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
          {[
            { left: '12%', size: 5, dur: 19, delay: 0, color: 'rgba(214,255,180,.9)', glow: true },
            { left: '28%', size: 3, dur: 26, delay: -6, color: 'rgba(255,244,200,.85)', glow: false },
            { left: '44%', size: 6, dur: 23, delay: -13, color: 'rgba(190,250,160,.7)', glow: true },
            { left: '61%', size: 4, dur: 30, delay: -3, color: 'rgba(255,255,255,.75)', glow: false },
            { left: '78%', size: 3, dur: 21, delay: -17, color: 'rgba(253,230,138,.9)', glow: false },
            { left: '88%', size: 5, dur: 27, delay: -9, color: 'rgba(214,255,180,.6)', glow: true },
          ].map((m, i) => (
            <span
              key={i}
              className="absolute rounded-full login-mote"
              style={{
                left: m.left,
                bottom: '-4%',
                width: m.size,
                height: m.size,
                background: m.color,
                boxShadow: m.glow ? '0 0 15px rgba(132,204,22,.45)' : undefined,
                animationDuration: `${m.dur}s`,
                animationDelay: `${m.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Capa 7 — viñeta */}
        <div
          className="absolute inset-0 z-[4] pointer-events-none"
          style={{ boxShadow: 'inset 0 0 160px 40px rgba(2,26,12,.55)' }}
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
            <Sprout size={18} />
          </div>
          <span className="font-semibold tracking-tight">Programa Saturno</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-green-300">
            Programa Saturno
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
          © {new Date().getFullYear()} Programa Saturno
        </div>

        <button
          type="button"
          onClick={() => setAnim((v) => !v)}
          aria-pressed={anim}
          className="absolute bottom-11 right-12 z-20 inline-flex items-center gap-[7px] rounded px-[9px] py-[5px] text-[10px] font-medium tracking-wide text-white/85 border border-white/20 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20 hover:border-white/40"
        >
          <span
            className="relative w-[22px] h-3 rounded-[3px] border border-white/30 shrink-0 transition-colors"
            style={{ background: anim ? 'rgba(163,230,53,.25)' : 'rgba(255,255,255,.12)' }}
          >
            <span
              className="absolute top-px w-2 h-2 rounded-[2px] transition-all"
              style={{
                left: anim ? 11 : 1,
                background: anim ? '#a3e635' : 'rgba(255,255,255,.5)',
              }}
            />
          </span>
          {anim ? 'Animación activada' : 'Animación desactivada'}
        </button>
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
              <p className="font-semibold text-gray-900 dark:text-gray-100 leading-none">Programa Saturno</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Agricultura por contrato</p>
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

          {modo === 'cedula' ? (
            <form onSubmit={handleCedulaLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="cedula"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Cédula
                </label>
                <input
                  id="cedula"
                  type="text"
                  inputMode="numeric"
                  placeholder="27673399 (sin la V ni ceros)"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 transition-shadow"
                />
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

              <button
                type="button"
                onClick={() => { setModo('password'); setError('') }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ¿Sos del equipo master? Ingresar con correo y contraseña
              </button>
            </form>
          ) : (
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

              <button
                type="button"
                onClick={() => { setModo('cedula'); setError('') }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ← Ingresar con cédula
              </button>
            </form>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-10">
            Acceso restringido · Programa Saturno
          </p>
        </div>
      </div>
    </div>
  )
}
