import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { syntheticEmailForAgricultor, normalizeCedula } from '@/lib/cedula-auth'

export const dynamic = 'force-dynamic'

/**
 * Login sin contraseña: recibe una cédula, la resuelve a un agricultor y
 * arma una sesión real de Supabase Auth para su usuario ya aprovisionado
 * (ver scripts/crear_usuarios_cedula.py). No crea usuarios nuevos acá — si
 * la cédula no tiene cuenta aprovisionada, devuelve error.
 *
 * Ruta bajo /api/session (no /api/auth): en varias redes empresariales el
 * proxy/firewall bloquea paths que contienen "/auth" con 403, aunque el resto
 * del sitio de Vercel pase bien.
 */
export async function POST(req: Request) {
  let body: { cedula?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }

  const cedula = body.cedula?.trim() ? normalizeCedula(body.cedula) : ''
  if (!cedula) {
    return NextResponse.json({ ok: false, error: 'Ingresa tu cédula' }, { status: 400 })
  }

  const svc = createServiceClient()

  // `agricultores.cedula` guarda el valor tal como viene de Saturno (con
  // prefijo V/E/J y ceros a la izquierda: "V027673399"), pero el agricultor
  // tipea solo el número ("27673399") — se compara normalizado en vez de
  // filtrar en la base, para no reescribir el dato de origen.
  const { data: candidatos } = await svc
    .from('agricultores')
    .select('agricultor_id, cedula')
    .not('cedula', 'is', null)

  const agricultor = (candidatos ?? []).find(
    c => normalizeCedula(String(c.cedula)) === cedula,
  )

  if (!agricultor) {
    return NextResponse.json({ ok: false, error: 'Cédula no registrada.' }, { status: 404 })
  }

  const email = syntheticEmailForAgricultor(agricultor.agricultor_id as string)

  const { data: link, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkErr || !link?.properties?.hashed_token) {
    return NextResponse.json(
      { ok: false, error: 'Tu cuenta todavía no está activada. Contacta al equipo.' },
      { status: 404 },
    )
  }

  // Intercambia el token por una sesión real — el cliente ssr persiste las
  // cookies automáticamente (misma mecánica que signInWithPassword).
  const supabase = await createClient()
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })

  if (verifyErr) {
    return NextResponse.json({ ok: false, error: 'No se pudo iniciar sesión.' }, { status: 500 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user?.id ?? '')
    .maybeSingle()

  return NextResponse.json({ ok: true, role: profile?.role ?? 'farmer' })
}
