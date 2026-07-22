'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CICLOS, resolveCiclo } from '@/lib/ciclo'

/**
 * Selector de ciclo agrícola para la barra lateral. Escribe ?ciclo= en la URL
 * conservando el resto de params (p. ej. ?agricultor= del rol master), de modo
 * que los Server Components lo lean y filtren lotes y análisis de suelo.
 */
export default function CicloSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const actual = resolveCiclo(searchParams.get('ciclo'))

  function seleccionar(c: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('ciclo', c)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="px-4 pb-3">
      <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Ciclo
      </p>
      <div
        role="group"
        aria-label="Ciclo agrícola"
        className="flex rounded-lg bg-black/15 p-0.5 ring-1 ring-white/10"
      >
        {CICLOS.map(c => {
          const activo = c === actual
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
      </div>
    </div>
  )
}
