'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CloudSun, Sprout, FolderOpen,
  Users, LogOut, Leaf, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const farmerLinks = [
  { href: '/cultivo', label: 'Cultivo', icon: Sprout },
  { href: '/clima', label: 'Clima', icon: CloudSun },
  { href: '/documentacion', label: 'Documentación', icon: FolderOpen },
]

const masterLinks = [
  { href: '/master', label: 'Agricultores', icon: Users },
  ...farmerLinks,
]

const CLAVE = 'saturno:sidebar'
const EVENTO = 'saturno:sidebar-cambio'

/**
 * Estado de la barra. `auto` es el del servidor: todavía no se sabe qué
 * prefiere este usuario, así que el colapso lo decide el breakpoint en CSS.
 */
type Estado = 'auto' | 'si' | 'no'

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  // `storage` para que abrir dos pestañas no las deje con barras distintas
  window.addEventListener('storage', avisar)
  return () => {
    window.removeEventListener(EVENTO, avisar)
    window.removeEventListener('storage', avisar)
  }
}

function leer(): Estado {
  const guardado = localStorage.getItem(CLAVE)
  if (guardado === 'si' || guardado === 'no') return guardado
  // Sin preferencia guardada: colapsada en el teléfono, abierta en escritorio
  return window.innerWidth < 1024 ? 'si' : 'no'
}

const leerEnServidor = (): Estado => 'auto'

function guardar(valor: 'si' | 'no') {
  localStorage.setItem(CLAVE, valor)
  window.dispatchEvent(new Event(EVENTO))
}

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const links = role === 'master' ? masterLinks : farmerLinks

  // En el primer render del cliente vale 'auto', igual que en el servidor, y
  // recién después pasa al valor real: así el HTML que llega ya sale como riel
  // en el teléfono y ancho en escritorio, sin el salto de 224 px a 64 px.
  const estado = useSyncExternalStore(suscribir, leer, leerEnServidor)
  const auto = estado === 'auto'
  const colapsada = estado === 'si'

  const alternar = () => guardar(colapsada ? 'no' : 'si')

  // En el teléfono la barra expandida flota sobre el contenido (ver más abajo);
  // tras navegar hay que devolverla al riel o taparía la pantalla recién abierta.
  function alNavegar() {
    if (window.innerWidth < 1024) guardar('si')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Navegar entre secciones conserva ciclo y agricultor seleccionados; si no,
  // cambiar de pantalla reseteaba el filtro y "reaparecían" datos de otro año.
  const qs = searchParams.toString()
  const withParams = (href: string) => (qs ? `${href}?${qs}` : href)

  // Antes de hidratar no se sabe el estado real, así que el colapso lo decide
  // el breakpoint; después manda `colapsada`. Un único árbol de DOM en ambos
  // casos: colapsar es solo estrechar y esconder los textos.
  const ancho = auto ? 'w-16 lg:w-56' : colapsada ? 'w-16' : 'w-56'
  const soloAncha = auto ? 'hidden lg:block' : colapsada ? 'hidden' : 'block'
  const filaFlex = auto
    ? 'justify-center px-2 lg:justify-start lg:px-3'
    : colapsada ? 'justify-center px-2' : 'px-3'
  const cabecera = auto
    ? 'justify-center px-2 lg:justify-start lg:px-4'
    : colapsada ? 'justify-center px-2' : 'px-4'
  // Expandida en móvil flota sobre el contenido: a 390 px de ancho, 224 px de
  // barra dejaban el panel inutilizable. En lg+ vuelve a ser sticky en flujo.
  const flotante = !auto && !colapsada ? 'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl' : ''

  return (
    <>
      {/* Hueco del riel mientras la barra flota, para que el contenido no salte */}
      {!auto && !colapsada && <div className="w-16 shrink-0 lg:hidden" aria-hidden />}

      {!auto && !colapsada && (
        <div
          onClick={alternar}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden
        />
      )}

      {/* sticky + h-screen: la barra queda fija al desplazar y el bloque de
          "Cerrar sesión" (mt-auto) se ancla al borde inferior de la ventana. */}
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto border-r border-black/10 bg-gradient-to-b from-[#15492c] to-[#0e3620] transition-[width] duration-200 dark:border-black/30 dark:from-[#123c24] dark:to-[#0a2b1a] ${ancho} ${flotante}`}
      >
        {/* Marca */}
        <div className={`flex items-center gap-2.5 py-5 ${cabecera}`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Leaf size={18} className="text-emerald-200" />
          </div>
          <div className={`min-w-0 ${soloAncha}`}>
            <h2 className="truncate text-[15px] font-semibold leading-tight text-white">
              Programa Saturno
            </h2>
            <p className="truncate text-[11px] text-emerald-200/70">Agricultura por contrato</p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-2 pt-1">
          <p className={`px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40 ${soloAncha}`}>
            Menú
          </p>
          <div className="space-y-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={withParams(href)}
                  onClick={alNavegar}
                  aria-current={active ? 'page' : undefined}
                  title={colapsada ? label : undefined}
                  className={`group flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${filaFlex} ${
                    active
                      ? 'bg-white/15 font-medium text-white shadow-sm ring-1 ring-white/10'
                      : 'text-emerald-50/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${
                      active
                        ? 'text-emerald-200'
                        : 'text-emerald-100/60 group-hover:text-emerald-100'
                    }`}
                  />
                  <span className={soloAncha}>{label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Cerrar sesión, tema y colapso */}
        <div className="mt-auto space-y-1 border-t border-white/10 p-2">
          <button
            onClick={handleLogout}
            title={colapsada ? 'Cerrar sesión' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-emerald-100/70 transition-colors hover:bg-white/10 hover:text-white ${filaFlex}`}
          >
            <LogOut size={18} className="shrink-0 text-emerald-100/60" />
            <span className={soloAncha}>Cerrar sesión</span>
          </button>

          {/* flex-wrap: en el riel de 64 px los dos botones de 36 px no caben
              en una línea y bajan solos, sin necesidad de otra rama de clases. */}
          <div className="flex flex-wrap items-center justify-center gap-1">
            <ThemeToggle />
            <button
              onClick={alternar}
              aria-expanded={auto ? undefined : !colapsada}
              aria-label={colapsada ? 'Expandir el menú' : 'Contraer el menú'}
              title={colapsada ? 'Expandir el menú' : 'Contraer el menú'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {/* Pre-hidratación el icono lo decide el breakpoint, igual que el ancho */}
              <PanelLeftOpen size={17} className={auto ? 'block lg:hidden' : colapsada ? 'block' : 'hidden'} />
              <PanelLeftClose size={17} className={auto ? 'hidden lg:block' : colapsada ? 'hidden' : 'block'} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
