import { NextResponse } from 'next/server'
import { loginConCedula, readCedulaFromRequest } from '@/lib/cedula-login'

export const dynamic = 'force-dynamic'

/** Alias de /ingreso/cedula — preferir esa ruta fuera de /api en redes filtradas. */
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
    url.pathname = result.role === 'master' ? '/master' : '/cultivo'
    url.search = ''
    return NextResponse.redirect(url, 303)
  }

  return NextResponse.json({ ok: true, role: result.role })
}
