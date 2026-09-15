'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CloudSun, Sprout, FolderOpen,
  Users, Leaf, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

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
 * Colapso de la barra de escritorio (>= lg, riel de 64 px o panel de 224 px).
 * En el teléfono la navegación vive en la barra inferior de más abajo, que
 * no colapsa ni tiene marca — por eso ya no hace falta el estado `auto` que
 * antes decidía el ancho por breakpoint antes de hidratar: la barra lateral
 * ahora está `hidden` por debajo de `lg` sin importar este estado.
 */
type Estado = 'si' | 'no'

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
  return localStorage.getItem(CLAVE) === 'si' ? 'si' : 'no'
}

const leerEnServidor = (): Estado => 'no'

function guardar(valor: Estado) {
  localStorage.setItem(CLAVE, valor)
  window.dispatchEvent(new Event(EVENTO))
}

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const links = role === 'master' ? masterLinks : farmerLinks

  const estado = useSyncExternalStore(suscribir, leer, leerEnServidor)
  const colapsada = estado === 'si'
  const alternar = () => guardar(colapsada ? 'no' : 'si')

  // Navegar entre secciones conserva ciclo y agricultor seleccionados; si no,
  // cambiar de pantalla reseteaba el filtro y "reaparecían" datos de otro año.
  const qs = searchParams.toString()
  const withParams = (href: string) => (qs ? `${href}?${qs}` : href)

  const ancho = colapsada ? 'w-16' : 'w-56'
  const soloAncha = colapsada ? 'hidden' : 'block'
  const filaFlex = colapsada ? 'justify-center px-2' : 'px-3'
  const cabecera = colapsada ? 'justify-center px-2' : 'px-4'

  return (
    <>
      {/* Barra lateral — solo en escritorio (>= lg). Sticky + h-screen para
          que quede fija al desplazar. */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-black/10 bg-gradient-to-b from-[#15492c] to-[#0e3620] transition-[width] duration-200 lg:flex dark:border-black/30 dark:from-[#123c24] dark:to-[#0a2b1a] ${ancho}`}
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

        {/* Colapso. Cerrar sesión y tema viven arriba, en el menú de usuario
            de la cabecera. */}
        <div className="mt-auto border-t border-white/10 p-2">
          <button
            onClick={alternar}
            aria-expanded={!colapsada}
            aria-label={colapsada ? 'Expandir el menú' : 'Contraer el menú'}
            title={colapsada ? 'Expandir el menú' : 'Contraer el menú'}
            className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-emerald-100/70 transition-colors hover:bg-white/10 hover:text-white ${filaFlex}`}
          >
            <PanelLeftOpen size={18} className={`shrink-0 text-emerald-100/60 ${colapsada ? 'block' : 'hidden'}`} />
            <PanelLeftClose size={18} className={`shrink-0 text-emerald-100/60 ${colapsada ? 'hidden' : 'block'}`} />
            <span className={soloAncha}>Contraer menú</span>
          </button>
        </div>
      </aside>

      {/* Barra inferior — solo en el teléfono, como una app normal: iconos +
          etiqueta siempre visibles, sin marca ni colapso. Fixed para que no
          se desplace con el contenido; el layout le reserva el hueco abajo
          con padding en el <main>. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-black/10 bg-gradient-to-t from-[#0e3620] to-[#15492c] pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-black/30 dark:from-[#0a2b1a] dark:to-[#123c24]"
        aria-label="Navegación principal"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={withParams(href)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-white' : 'text-emerald-100/60'
              }`}
            >
              <Icon size={20} className={active ? 'text-emerald-200' : 'text-emerald-100/50'} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
