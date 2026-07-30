/**
 * Badge de estado de la fase de llenado ("Aún no llena" / "Llenado" / "Cierre
 * de llenado"), portado de `seguimiento-lluvia-saturno`. Toma el `estado` ya
 * calculado (por `estadoLlenado()` o `estadoLlenadoAgregado()` en
 * lib/seguimiento-lluvia-calc.ts) en vez de `pctDias`, porque acá se usa tanto
 * para un lote individual como para el estado agregado de un grupo entero.
 */

const ESTILOS: Record<string, string> = {
  'Aún no llena': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Llenado': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'Cierre de llenado': 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
}

export default function EstadoLlenadoBadge({ estado }: { estado: string | null }) {
  if (!estado) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        —
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        ESTILOS[estado] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
      }`}
    >
      {estado}
    </span>
  )
}
