'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, CloudSun, Sprout, Wheat, FlaskConical,
  BarChart3, Users, LogOut
} from 'lucide-react'

const farmerLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clima', label: 'Clima', icon: CloudSun },
  { href: '/siembra', label: 'Siembra', icon: Sprout },
  { href: '/cosecha', label: 'Cosecha', icon: Wheat },
  { href: '/suelo', label: 'Suelo', icon: FlaskConical },
  { href: '/finanzas', label: 'Finanzas', icon: BarChart3 },
]

const masterLinks = [
  { href: '/master', label: 'Agricultores', icon: Users },
  ...farmerLinks,
]

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const links = role === 'master' ? masterLinks : farmerLinks

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 bg-green-900 min-h-screen flex flex-col">
      <div className="px-5 py-6">
        <h2 className="text-white font-bold text-lg leading-tight">Agri Platform</h2>
        <p className="text-green-300 text-xs mt-0.5">Polar en el Campo</p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-green-700 text-white font-medium'
                  : 'text-green-200 hover:bg-green-800 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 pb-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-green-300 hover:bg-green-800 hover:text-white w-full transition-colors"
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
