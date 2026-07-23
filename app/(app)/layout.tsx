import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import AsistenteWidget from '@/components/AsistenteWidget'
import SoporteWhatsAppWidget from '@/components/SoporteWhatsAppWidget'
import UserMenu from '@/components/UserMenu'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, agricultor_key')
    .eq('user_id', user.id)
    .single()

  const { data: agro } = profile?.agricultor_key
    ? await supabase
        .from('agropecuaria')
        .select('nombre_agropecuaria')
        .eq('AgricultorKey', profile.agricultor_key)
        .single()
    : { data: null }

  const displayName = agro?.nombre_agropecuaria ?? user.email ?? 'Usuario'

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar role={profile?.role ?? 'farmer'} />
      <div className="flex-1 flex flex-col">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Polar en el Campo</span>
          <UserMenu
            email={user.email ?? '—'}
            displayName={displayName}
            role={(profile?.role ?? 'farmer') as 'master' | 'farmer'}
          />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <AsistenteWidget
        defaultAgricultorKey={profile?.agricultor_key ?? null}
        isMaster={(profile?.role ?? 'farmer') === 'master'}
      />
      <SoporteWhatsAppWidget
        agricultorNombre={displayName}
        agricultorKey={profile?.agricultor_key ?? 'sin_key'}
        role={(profile?.role ?? 'farmer') as 'master' | 'farmer'}
      />
    </div>
  )
}
