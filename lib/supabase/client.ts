import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createDemoBrowserClient } from '@/lib/demo/mock-client-browser'

export function createClient(): SupabaseClient {
  // Ver lib/supabase/server.ts — misma bifurcación, versión browser (sin
  // filesystem: las queries van por fetch a /api/demo/query). Cast por el
  // mismo motivo: no es el tipo real, es la forma mínima que el código usa.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return createDemoBrowserClient() as unknown as SupabaseClient
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
