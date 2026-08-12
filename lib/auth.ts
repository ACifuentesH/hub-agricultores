import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'master' | 'farmer'

export interface UserProfile {
  user_id: string
  agricultor_id: string | null
  role: UserRole
}

export async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data as UserProfile | null
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireRole(role: UserRole) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')
  if (profile.role !== role) redirect('/dashboard')
  return profile
}
