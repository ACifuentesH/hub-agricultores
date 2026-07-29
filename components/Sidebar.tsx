'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, CloudSun, Sprout, FolderOpen,
  Users, LogOut, Leaf,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const farmerLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clima', label: 'Clima', icon: CloudSun },
  { href: '/cultivo', label: 'Cultivo', icon: Sprout },
  { href: '/documentacion', label: 'Documentación', icon: FolderOpen },
]

const masterLinks = [
  { href: '/master', label: 'Agricultores', icon: Users },
  ...farmerLinks,
]

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const links = role === 'master' ? masterLinks : farmerLinks

  // Navegar entre secciones conserva ciclo y agricultor seleccionados; si no,
  // cambiar de pantalla reseteaba el filtro y "reaparecían" datos de otro año.
  const qs = searchParams.toString()
  const withParams = (href: string) => (qs ? `${href}?${qs}` : href)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // sticky + h-screen: la barra queda fija al desplazar y el bloque de
  // "Cerrar sesión" (mt-auto) se ancla al borde inferior de la ventana.
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-black/10 bg-gradient-to-b from-[#15492c] to-[#0e3620] dark:border-black/30 dark:from-[#123c24] dark:to-[#0a2b1a]">
      {/* Marca */}
      <div className="flex items-start justify-between gap-2 px-4 py-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Leaf size={18} className="text-emerald-200" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold leading-tight text-white">
              Programa Saturno
            </h2>
            <p className="truncate text-[11px] text-emerald-200/70">Agricultura por contrato</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 pt-1">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Menú
        </p>
        <div className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={withParams(href)}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-white/15 font-medium text-white shadow-sm ring-1 ring-white/10'
                    : 'text-emerald-50/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  size={18}
                  className={
                    active
                      ? 'text-emerald-200'
                      : 'text-emerald-100/60 group-hover:text-emerald-100'
                  }
                />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Cerrar sesión */}
      <div className="mt-auto border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-emerald-100/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} className="text-emerald-100/60" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
