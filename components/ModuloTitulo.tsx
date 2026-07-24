'use client'

import { usePathname } from 'next/navigation'

/**
 * Título del módulo activo, mostrado en la cabecera fija.
 *
 * Vive en la cabecera (y no en cada página) para que siga visible al desplazar.
 * Por eso las páginas ya no repiten su <h1>: sería un título duplicado.
 */
const TITULOS: { prefijo: string; titulo: string }[] = [
  { prefijo: '/dashboard', titulo: 'Dashboard' },
  { prefijo: '/clima', titulo: 'Clima' },
  { prefijo: '/cultivo', titulo: 'Cultivo' },
  { prefijo: '/documentacion', titulo: 'Documentación' },
  { prefijo: '/master', titulo: 'Agricultores' },
]

export default function ModuloTitulo() {
  const pathname = usePathname()
  const match = TITULOS.find(t => pathname.startsWith(t.prefijo))
  return (
    <h1 className="truncate text-base font-semibold text-gray-800 dark:text-gray-100">
      {match?.titulo ?? 'Proyecto Saturno'}
    </h1>
  )
}
