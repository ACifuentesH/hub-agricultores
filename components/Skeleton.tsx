/**
 * Primitivas de skeleton para los loading.tsx de cada ruta.
 *
 * La idea es que el esqueleto tenga la MISMA forma que el contenido real: así
 * el salto al cargar es imperceptible y la espera se siente como progreso, no
 * como un bloqueo. El brillo (.skeleton en globals.css) da la señal de "esto
 * está trabajando".
 */

export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`skeleton text-gray-500 dark:text-gray-300 ${className}`} />
}

/** Tarjeta de KPI: icono + etiqueta + valor. */
export function SkeletonKpi() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <SkeletonBox className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBox className="h-3 w-20" />
        <SkeletonBox className="h-6 w-24" />
      </div>
    </div>
  )
}

/** Tabla con cabecera y filas. */
export function SkeletonTabla({ filas = 5, columnas = 5 }: { filas?: number; columnas?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <SkeletonBox className="h-4 w-40" />
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: columnas }).map((_, c) => (
              <SkeletonBox
                key={c}
                className={`h-3.5 ${c === 0 ? 'w-40' : 'w-20'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Bloque de tarjeta genérico (panel, gráfico, sección). */
export function SkeletonPanel({ className = 'h-40' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="space-y-3">
        <SkeletonBox className="h-3.5 w-32" />
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-4/5" />
      </div>
    </div>
  )
}

/** Tarjeta de documento: icono + 2 líneas de texto + fila de acciones. */
export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-2.5">
        <SkeletonBox className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBox className="h-3.5 w-3/4" />
          <SkeletonBox className="h-4 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-2.5 w-24" />
        <SkeletonBox className="h-2.5 w-12" />
      </div>
      <div className="flex items-center gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        <SkeletonBox className="h-6 w-14 rounded-md" />
        <SkeletonBox className="h-6 w-20 rounded-md" />
        <SkeletonBox className="h-6 w-6 rounded-md" />
      </div>
    </div>
  )
}

/** Cabecera de página: subtítulo + control a la derecha. */
export function SkeletonEncabezado() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SkeletonBox className="h-4 w-72" />
      <SkeletonBox className="h-9 w-40 rounded-lg" />
    </div>
  )
}
