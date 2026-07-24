'use client'

import { useTransition, useOptimistic } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CICLOS, resolveCiclo, type Ciclo } from '@/lib/ciclo'

/**
 * Selector de ciclo agrícola para la barra lateral. Escribe ?ciclo= en la URL
 * conservando el resto de params (p. ej. ?agricultor= del rol master), de modo
 * que los Server Components lo lean y filtren lotes y análisis de suelo.
 *
 * UX: la navegación va dentro de `useTransition` y el estado visible es
 * optimista, así el botón se marca en el mismo frame del clic en vez de
 * esperar la respuesta del servidor. Mientras llega, la barra inferior indica
 * que el cambio está en curso (y los loading.tsx de cada ruta pintan el
 * esqueleto del contenido).
 */
export default function CicloSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const actual = resolveCiclo(searchParams.get('ciclo'))
  const [pendiente, startTransition] = useTransition()
  const [optimista, setOptimista] = useOptimistic(actual)

  function seleccionar(c: Ciclo) {
    if (c === actual) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('ciclo', c)
    startTransition(() => {
      setOptimista(c)
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="px-4 pb-3">
      <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Ciclo
      </p>
      <div
        role="group"
        aria-label="Ciclo agrícola"
        aria-busy={pendiente}
        className="relative flex overflow-hidden rounded-lg bg-black/15 p-0.5 ring-1 ring-white/10"
      >
        {CICLOS.map(c => {
          const activo = c === optimista
          return (
            <button
              key={c}
              type="button"
              onClick={() => seleccionar(c)}
              aria-pressed={activo}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                activo
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-emerald-100/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {c}
            </button>
          )
        })}

        {/* Barra de progreso indeterminada mientras el servidor responde */}
        {pendiente && (
          <span
            aria-hidden="true"
            className="cs-bar pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-emerald-300/80"
          />
        )}
      </div>

      <style>{`
        .cs-bar {
          transform-origin: left;
          animation: csIndeterminado 1.1s ease-in-out infinite;
        }
        @keyframes csIndeterminado {
          0%   { transform: scaleX(0);   opacity: .9 }
          50%  { transform: scaleX(1);   opacity: 1 }
          100% { transform: scaleX(0);   opacity: .9; transform-origin: right }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-bar { animation: none; transform: scaleX(1) }
        }
      `}</style>
    </div>
  )
}
