'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FlaskConical, Briefcase, ScrollText, ChartColumn } from 'lucide-react'
import type { CategoriaId } from '@/lib/documentos'

const ICONOS: Record<CategoriaId, React.ComponentType<{ size?: number; className?: string }>> = {
  analisis_suelo: FlaskConical,
  convenios: ScrollText,
  pnl: Briefcase,
  analisis_datos: ChartColumn,
}

interface Props {
  categorias: readonly { id: CategoriaId; label: string }[]
  activa: CategoriaId
}

/**
 * Guía de navegación entre categorías del módulo Documentación. Reemplaza las
 * 4 secciones apiladas por una sola vista a la vez, elegida con esta barra de
 * pestañas — conserva `agricultor`/`ciclo` de la URL, solo cambia `categoria`.
 */
export default function DocumentoCategoriaTabs({ categorias, activa }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function irA(categoria: CategoriaId) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('categoria', categoria)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <nav
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/60 bg-white/70 p-1.5 shadow-sm shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
      aria-label="Categorías de documentos"
    >
      {categorias.map((c) => {
        const Icono = ICONOS[c.id]
        const esActiva = c.id === activa
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => irA(c.id)}
            aria-current={esActiva ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
              esActiva
                ? 'bg-green-700 text-white shadow-md shadow-green-700/25'
                : 'text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            <Icono size={15} className={esActiva ? 'text-white' : 'opacity-70'} />
            {c.label}
          </button>
        )
      })}
    </nav>
  )
}
