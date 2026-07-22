import { createClient } from './supabase/server'

export interface AgricultorScope {
  /** null only when role=master and no selection has been made yet */
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
 * - farmer: their own agricultor_key, ignores ?agricultor query param
 * - master: ?agricultor query param, or null if not selected yet
 */
export async function resolveAgricultorScope(
  profile: { role: string | null; agricultor_key: string | null },
  searchParams?: { agricultor?: string }
): Promise<AgricultorScope> {
  if (profile.role === 'master') {
    const selected = searchParams?.agricultor?.trim() || null
    if (!selected) {
      return { agricultorKey: null, isMaster: true, agropecuariaName: null }
    }
    const supabase = await createClient()
    const { data } = await supabase
      .from('agropecuaria')
      .select('nombre_agropecuaria')
      .eq('AgricultorKey', selected)
      .maybeSingle()
    return {
      agricultorKey: selected,
      isMaster: true,
      agropecuariaName: data?.nombre_agropecuaria ?? selected,
    }
  }

  // farmer (or any non-master): bound to their own key
  return {
    agricultorKey: profile.agricultor_key,
    isMaster: false,
    agropecuariaName: null,
  }
}

/** Full list of agricultores for the master selector. */
export async function listAgricultores(): Promise<AgricultorOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('agropecuaria')
    .select('AgricultorKey, nombre_agropecuaria, ciclo')
    .order('nombre_agropecuaria', { ascending: true })
  return (data ?? []).map((a) => {
    const base = (a.nombre_agropecuaria as string | null) ?? (a.AgricultorKey as string)
    // El mismo productor existe como DOS perfiles (2025 y 2026) con keys
    // distintas; sin el ciclo en la etiqueta el master elegía el perfil
    // equivocado y "no le salían" los PDFs/lotes cargados en el otro.
    const ciclo = a.ciclo as string | null
    return {
      key: a.AgricultorKey as string,
      nombre: ciclo ? `${base} · ${ciclo}` : base,
    }
  })
}
