import { createClient } from './supabase/server'

export interface AgricultorScope {
  /**
   * null only when role=master and no selection has been made yet.
   * Holds `agricultores.agricultor_id` (uuid) — el nombre del campo se
   * conserva por compatibilidad con las pantallas que todavía no se
   * migraron (documentación, clima, master), que lo leen como
   * `scope.agricultorKey`.
   */
  agricultorKey: string | null
  isMaster: boolean
  /** Display name when known (master+selected, or any farmer) */
  agropecuariaName: string | null
}

export interface AgricultorOption {
  key: string
  nombre: string
}

/**
 * Resolves which agricultor's data the current request should see.
 * - farmer: their own agricultor_id, ignores ?agricultor query param
 * - master: ?agricultor query param, or null if not selected yet
 */
export async function resolveAgricultorScope(
  profile: { role: string | null; agricultor_id: string | null },
  searchParams?: { agricultor?: string }
): Promise<AgricultorScope> {
  if (profile.role === 'master') {
    const selected = searchParams?.agricultor?.trim() || null
    if (!selected) {
      return { agricultorKey: null, isMaster: true, agropecuariaName: null }
    }
    const supabase = await createClient()
    const { data } = await supabase
      .from('agricultores')
      .select('nombre')
      .eq('agricultor_id', selected)
      .maybeSingle()
    return {
      agricultorKey: selected,
      isMaster: true,
      agropecuariaName: data?.nombre ?? selected,
    }
  }

  // farmer (or any non-master): bound to their own id
  return {
    agricultorKey: profile.agricultor_id,
    isMaster: false,
    agropecuariaName: null,
  }
}

/** Full list of agricultores for the master selector. */
export async function listAgricultores(): Promise<AgricultorOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('agricultores')
    .select('agricultor_id, nombre')
    .order('nombre', { ascending: true })
  return (data ?? []).map((a) => ({
    key: a.agricultor_id as string,
    nombre: (a.nombre as string | null) ?? (a.agricultor_id as string),
  }))
}
