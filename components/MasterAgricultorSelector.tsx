'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Users, X } from 'lucide-react'
import type { AgricultorOption } from '@/lib/access'

interface Props {
  agricultores: AgricultorOption[]
  selected: string | null
}

/**
 * Dropdown for master role to pick which agricultor's data to view.
 * Persists selection in `?agricultor=KEY` query param so it's bookmarkable
 * and survives navigation between modules.
 */
export default function MasterAgricultorSelector({ agricultores, selected }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set('agricultor', value)
    else next.delete('agricultor')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <Users size={14} className="text-green-700 dark:text-green-400 shrink-0" />
      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Vista master:</span>
      <select
        value={selected ?? ''}
        onChange={(e) => navigate(e.target.value || null)}
        className="bg-transparent text-sm text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer max-w-[200px] truncate"
      >
        <option value="">— Selecciona agricultor —</option>
        {agricultores.map((a) => (
          <option key={a.key} value={a.key}>{a.nombre}</option>
        ))}
      </select>
      {selected && (
        <button
          onClick={() => navigate(null)}
          aria-label="Limpiar selección"
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
