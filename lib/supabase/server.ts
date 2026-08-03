import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createDemoServerClient } from '@/lib/demo/mock-client-server'

const DEMO_MODE = process.env.DEMO_MODE === 'true'

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  // Modo demo (ver AGENTS.md / README de /demo-data): la cuenta de Supabase
  // está suspendida por facturación, así que acá se sirve todo desde los CSVs
  // de /demo-data en vez de hablar con el proyecto real. El resto del código
  // no se entera — mismo shape `.from/.rpc/.auth/.storage`. El cast es solo
  // para que TypeScript no intente unificar la firma real (generada de
  // Database) con la del mock: en runtime nunca se llama al cliente real acá.
  if (DEMO_MODE) {
    return createDemoServerClient(cookieStore.get('demo_session')?.value === '1') as unknown as SupabaseClient
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/** Service role client — solo usar en Server Actions / API Routes, nunca en el browser */
export function createServiceClient(): SupabaseClient {
  if (DEMO_MODE) {
    // No hay RLS que bypassear en modo demo: el cliente mock ya tiene acceso
    // completo a todas las tablas. Se asume sesión activa (las rutas que usan
    // service_role ya verificaron el rol antes de llegar acá).
    return createDemoServerClient(true) as unknown as SupabaseClient
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
