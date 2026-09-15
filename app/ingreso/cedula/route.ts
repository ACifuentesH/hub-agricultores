import { NextResponse } from 'next/server'
import { loginConCedula, readCedulaFromRequest } from '@/lib/cedula-login'

export const dynamic = 'force-dynamic'

/**
 * Login por cédula/RIF (sin password), o clave master (`MASTER_ACCESS_KEY`).
 *
 * Vive fuera de `/api/*` a propósito: en redes empresariales el firewall a
 * veces deja pasar el sitio de Vercel y Supabase, pero bloquea POST a
 * `/api/...` (o a paths con `auth`) con 403.
 *
 * El formulario de /login hace POST HTML clásico (no fetch/XHR).
 */
export async function POST(req: Request) {
  const { cedula, wantsHtml } = await readCedulaFromRequest(req)
  const result = await loginConCedula(cedula)
  const url = new URL(req.url)

  if (!result.ok) {
    if (wantsHtml) {
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('error', result.error)
      return NextResponse.redirect(url, 303)
    }
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    )
  }

  if (wantsHtml) {
    url.pathname = result.role === 'master' ? '/master' : '/dashboard'
    url.search = ''
    return NextResponse.redirect(url, 303)
  }

  return NextResponse.json({ ok: true, role: result.role })
}
