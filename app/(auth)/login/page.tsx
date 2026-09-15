'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sprout, ArrowRight } from 'lucide-react'
import DemoLoginGate from '@/components/DemoLoginGate'

export default function LoginPage() {
  // Modo demo: pantalla de clave en vez del login real (Supabase Auth está
  // suspendido, ver AGENTS.md). Con DEMO_MODE apagado esto nunca se evalúa.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return <DemoLoginGate />
  }
  return (
    <Suspense fallback={null}>
      <RealLoginForm />
    </Suspense>
  )
}

function RealLoginForm() {
  const searchParams = useSearchParams()
  const [documento, setDocumento] = useState('')
  const [error] = useState(searchParams.get('error') ?? '')
  const [anim, setAnim] = useState(true)

  // POST HTML clásico a /ingreso/cedula (sin fetch/XHR): en redes
  // empresariales a menudo bloquean POST a /api/* o requests JSON.

  return (
    <div
      data-anim={anim ? 'on' : 'off'}
      className="min-h-screen grid lg:grid-cols-5 bg-white dark:bg-gray-950"
    >
      {/* Brand panel — left 60% on desktop */}
      <div className="relative lg:col-span-3 hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden isolate bg-green-950">
        <div
          className="absolute -inset-[6%] z-0 bg-cover bg-center login-kenburns"
          style={{ backgroundImage: "url('/login-bg.jpg')" }}
        />
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-green-950/80 via-green-900/50 to-emerald-950/85" />
        <div
          className="absolute -inset-[30%] z-[2] blur-2xl mix-blend-screen login-sweep"
          style={{
            background:
              'radial-gradient(45% 40% at 30% 35%, rgba(163,230,53,.30) 0%, rgba(34,197,94,.12) 40%, transparent 72%)',
          }}
        />
        <div
          className="absolute -inset-[20%] z-[2] blur-3xl mix-blend-screen login-haze"
          style={{
            background:
              'radial-gradient(50% 45% at 72% 78%, rgba(234,179,8,.22) 0%, transparent 68%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[34%] z-[2] bg-gradient-to-t from-green-950/70 to-transparent login-field" />
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

      {/* Form panel */}
      <div className="lg:col-span-2 flex flex-col justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-lg bg-green-800 flex items-center justify-center text-white">
              <Sprout size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 leading-none">Programa Saturno</p>
            </div>
          </div>

          <div className="space-y-1.5 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Bienvenido de vuelta
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Personas naturales: cédula. Personas jurídicas: RIF.
            </p>
          </div>

          <form action="/ingreso/cedula" method="post" className="space-y-5">
            <div>
              <label
                htmlFor="documento"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Cédula o RIF
              </label>
              <input
                id="documento"
                name="documento"
                type="text"
                placeholder="Cédula o RIF"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                required
                autoComplete="off"
                autoFocus
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
              className="group w-full inline-flex items-center justify-center gap-2 bg-green-800 hover:bg-green-900 text-white font-medium py-2.5 rounded-lg transition-all shadow-sm hover:shadow"
            >
              Ingresar
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
