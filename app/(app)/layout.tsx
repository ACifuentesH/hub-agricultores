import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={profile?.role ?? 'farmer'} />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">Polar en el Campo</span>
          <span className="text-sm font-medium text-green-800">{displayName}</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
