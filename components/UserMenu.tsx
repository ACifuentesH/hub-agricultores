'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

interface Props {
  email: string
  displayName: string
  role: 'master' | 'farmer'
}

/**
 * Menú de usuario en el header. Dropdown con cerrar sesión.
 */
export default function UserMenu({ email, displayName, role }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-gray-100 sm:px-2.5 dark:hover:bg-gray-800"
          aria-label="Menú de usuario"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-semibold text-white">
            {(displayName || email).slice(0, 2).toUpperCase()}
          </div>
          {/* En el teléfono solo queda la inicial: el nombre de la agropecuaria
              empujaba el título del módulo fuera de la cabecera. */}
          <span className="hidden max-w-[180px] truncate text-sm font-medium text-green-800 sm:inline dark:text-green-300">
            {displayName}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl py-1 z-30">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
              <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full ${
                role === 'master'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              }`}>
                {role === 'master' ? 'Master corporativo' : 'Agricultor'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </>
  )
}
