'use client'

import { useTransition, useOptimistic } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const VISTAS = [
  { value: 'mi-agricultor', label: 'Mi agricultor' },
  { value: 'por-agricultor', label: 'Por agricultor' },
  { value: 'global', label: 'Global' },
  { value: 'zonas', label: 'Zonas' },
] as const

type Vista = (typeof VISTAS)[number]['value']

interface Props {
  vistaActual: string
}

/**
 * Tira de pestañas del módulo Clima (vista master) — escribe `?vista=` en la
 * URL conservando el resto de los params, con el patrón `useTransition` +
 * `useOptimistic`. Se renderiza en el cuerpo de la página `/clima`, así que
 * usa el cromo claro/tarjeta blanca de `MasterAgricultorSelector.tsx` en vez
 * del `bg-black/15`/`ring-white/10` de la barra lateral.
 *
 * (Antes esto se comparaba con `CicloSelector.tsx`, el selector 2025/2026 de
 * la barra lateral. Ese componente ya no existe: el ciclo 2025 está cerrado y
 * la app trabaja siempre sobre `CICLO_ACTIVO`, ver `lib/ciclo.ts`.)
 *
 * La página decide qué hacer con combinaciones no aplicables (p. ej.
 * "Mi agricultor" sin `?agricultor=` seleccionado) — este componente solo
 * pinta las 4 pestañas.
 */
export default function ClimaVistaTabs({ vistaActual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pendiente, startTransition] = useTransition()
  const [optimista, setOptimista] = useOptimistic(vistaActual)

  function seleccionar(v: Vista) {
    if (v === optimista) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('vista', v)
    startTransition(() => {
      setOptimista(v)
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Vista del módulo de clima"
      aria-busy={pendiente}
      className="relative inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      {VISTAS.map(({ value, label }) => {
        const activo = value === optimista
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => seleccionar(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activo
                ? 'bg-green-700 text-white shadow-sm dark:bg-green-600'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            {label}
          </button>
        )
      })}
      {pendiente && (
        <Loader2
          size={13}
          className="ml-1 shrink-0 animate-spin text-green-700 dark:text-green-400"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
