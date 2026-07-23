import { Users } from 'lucide-react'
import MasterAgricultorSelector from './MasterAgricultorSelector'
import type { AgricultorOption } from '@/lib/access'

interface Props {
  title: string
  subtitle?: string
  agricultores: AgricultorOption[]
  selected: string | null
}

/**
 * Shared empty state for master users who haven't selected an agricultor yet.
 * Renders the page title + a selector + a centered prompt card.
 */
export default function MasterEmptyState({ title, subtitle, agricultores, selected }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* El título del módulo lo muestra la cabecera fija del layout */}
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {subtitle ?? 'Vista master — selecciona un agricultor para ver los datos.'}
          </p>
        </div>
        <MasterAgricultorSelector agricultores={agricultores} selected={selected} />
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
        <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          Selecciona un agricultor en el menú superior
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {agricultores.length} agricultores disponibles
        </p>
      </div>
    </div>
  )
}
