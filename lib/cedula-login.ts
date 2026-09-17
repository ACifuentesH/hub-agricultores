import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  syntheticEmailForAgricultor,
  normalizeCedula,
  labelDocumento,
  esClaveMaster,
} from '@/lib/cedula-auth'

export type CedulaLoginResult =
  | { ok: true; role: string }
  | { ok: false; error: string; status: number }

async function sesionConEmail(
  email: string,
  agricultorId?: string,
): Promise<CedulaLoginResult> {
  const svc = createServiceClient()
  const { data: link, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkErr || !link?.properties?.hashed_token) {
    return {
      ok: false,
      error: 'Tu cuenta todavía no está activada. Contacta al equipo.',
      status: 404,
    }
  }

  const supabase = await createClient()
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })

  if (verifyErr) {
    return { ok: false, error: 'No se pudo iniciar sesión.', status: 500 }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'No se pudo iniciar sesión.', status: 500 }
  }

  let { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  // Si este agricultor nunca pasó por scripts/crear_usuarios_cedula.py (p.ej.
  // se cargó después de la última corrida), la sesión queda válida pero sin
  // fila en user_profiles: el dashboard la trata como no-auth y redirige a
  // /login, que a su vez redirige de vuelta a /dashboard porque sí hay sesión
  // — loop infinito. Crearla acá evita depender de que alguien haya corrido
  // el script a mano para cada agricultor nuevo.
  if (!profile && agricultorId) {
    await svc
      .from('user_profiles')
      .upsert(
        { user_id: user.id, role: 'farmer', agricultor_id: agricultorId },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
    profile = { role: 'farmer' }
  }

  return { ok: true, role: profile?.role ?? 'farmer' }
}

/** Acceso master con `MASTER_ACCESS_KEY` (mismo campo del documento). */
async function loginMaster(): Promise<CedulaLoginResult> {
  const svc = createServiceClient()
  const { data: masters, error } = await svc
    .from('user_profiles')
    .select('user_id')
    .eq('role', 'master')
    .limit(1)

  if (error || !masters?.[0]?.user_id) {
    return {
      ok: false,
      error: 'No hay una cuenta master activa. Contacta al equipo.',
      status: 404,
    }
  }

  const { data, error: userErr } = await svc.auth.admin.getUserById(masters[0].user_id)
  const email = data.user?.email
  if (userErr || !email) {
    return {
      ok: false,
      error: 'No se pudo resolver la cuenta master. Contacta al equipo.',
      status: 500,
    }
  }

  const result = await sesionConEmail(email)
  if (!result.ok) return result
  return { ok: true, role: 'master' }
}

/**
 * Resuelve cédula/RIF → sesión Supabase Auth, o MASTER_ACCESS_KEY → master.
 */
export async function loginConCedula(rawCedula: string): Promise<CedulaLoginResult> {
  const raw = rawCedula.trim()
  if (!raw) {
    return { ok: false, error: 'Ingresa tu cédula o RIF', status: 400 }
  }

  if (esClaveMaster(raw)) {
    return loginMaster()
  }

  const documento = normalizeCedula(raw)
  if (!documento) {
    return { ok: false, error: 'Ingresa tu cédula o RIF', status: 400 }
  }

  const etiqueta = labelDocumento(raw)
  const svc = createServiceClient()

  const { data: candidatos } = await svc
    .from('agricultores')
    .select('agricultor_id, cedula')
    .not('cedula', 'is', null)

  const agricultor = (candidatos ?? []).find(
    c => normalizeCedula(String(c.cedula)) === documento,
  )

  if (!agricultor) {
    return { ok: false, error: `${etiqueta} no registrada.`, status: 404 }
  }

  const agricultorId = agricultor.agricultor_id as string
  return sesionConEmail(syntheticEmailForAgricultor(agricultorId), agricultorId)
}

export async function readCedulaFromRequest(
  req: Request,
): Promise<{ cedula: string; wantsHtml: boolean }> {
  const contentType = req.headers.get('content-type') ?? ''
  const accept = req.headers.get('accept') ?? ''
  const wantsHtml = accept.includes('text/html') || contentType.includes('form')

  if (contentType.includes('application/json')) {
    try {
      const body = (await req.json()) as { cedula?: string; documento?: string }
      return { cedula: body.documento ?? body.cedula ?? '', wantsHtml: false }
    } catch {
      return { cedula: '', wantsHtml: false }
    }
  }

  try {
    const form = await req.formData()
    return {
      cedula: String(form.get('documento') ?? form.get('cedula') ?? ''),
      wantsHtml,
    }
  } catch {
    return { cedula: '', wantsHtml }
  }
}
