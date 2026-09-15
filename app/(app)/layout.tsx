import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import UserMenu from '@/components/UserMenu'
import ModuloTitulo from '@/components/ModuloTitulo'
import ThemeToggle from '@/components/ThemeToggle'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, agricultor_id')
    .eq('user_id', user.id)
    .single()

  const { data: agricultor } = profile?.agricultor_id
    ? await supabase
        .from('agricultores')
        .select('nombre')
        .eq('agricultor_id', profile.agricultor_id)
        .single()
    : { data: null }

  const displayName = agricultor?.nombre ?? user.email ?? 'Usuario'

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar role={profile?.role ?? 'farmer'} />
      {/* min-w-0 evita que una tabla ancha empuje el layout y rompa el sticky */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 sm:gap-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex min-w-0 items-baseline gap-3">
            <ModuloTitulo />
            <span className="hidden truncate text-sm text-gray-500 lg:inline dark:text-gray-400">
              Programa Saturno
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu
              email={user.email ?? '—'}
              displayName={displayName}
              role={(profile?.role ?? 'farmer') as 'master' | 'farmer'}
            />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
