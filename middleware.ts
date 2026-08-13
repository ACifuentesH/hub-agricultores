import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// /api/session/cedula crea la sesión — tiene que ser alcanzable sin una
// sesión previa, igual que /login. (Evitar /api/auth/*: muchos proxies
// empresariales lo bloquean con 403.)
const PUBLIC_ROUTES = ['/login', '/api/session/cedula']

export async function middleware(request: NextRequest) {
  // Modo demo: la cuenta de Supabase está suspendida, así que ni siquiera se
  // intenta hablar con Supabase Auth acá — se valida solo la cookie que pone
  // la pantalla de clave (ver components/DemoLoginGate.tsx). El usuario demo
  // es master, así que también pasa el check de /master de más abajo.
  if (process.env.DEMO_MODE === 'true') {
    const { pathname } = request.nextUrl
    const hasDemoSession = request.cookies.get('demo_session')?.value === '1'

    if (!hasDemoSession && !PUBLIC_ROUTES.includes(pathname)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, error: 'Sesión demo expirada. Vuelve a ingresar la clave.' },
          { status: 401 },
        )
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (hasDemoSession && pathname === '/login') {
      return NextResponse.redirect(new URL('/master', request.url))
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && !PUBLIC_ROUTES.includes(pathname)) {
    // Las rutas de API responden JSON, no una redirección a HTML: si la sesión
    // caduca mientras el usuario tiene la app abierta, el fetch del cliente
    // recibiría la página de login y fallaría al interpretarla, dando un error
    // incomprensible. Con un 401 el widget puede avisar que hay que reingresar.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
        { status: 401 },
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from /login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect /master route — check role
  if (user && pathname.startsWith('/master')) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'master') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  /**
   * Qué NO debe pasar por el middleware.
   *
   * Crítico: `sw.js` y `manifest.json` tienen que quedar fuera. Si el
   * middleware los intercepta, el navegador recibe una redirección a /login en
   * vez del archivo; entonces el service worker no puede actualizarse y los
   * usuarios que ya tenían la PWA instalada se quedan servidos por un worker
   * viejo de forma permanente, viendo una versión anterior de la app.
   *
   * Se excluyen también las extensiones de archivos estáticos: además de
   * evitar el mismo problema, ahorra una verificación de sesión por asset.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|swe-worker-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|js|map)$).*)',
  ],
}
