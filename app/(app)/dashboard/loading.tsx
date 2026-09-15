import { SkeletonEncabezado, SkeletonKpi, SkeletonTabla } from '@/components/Skeleton'

/**
 * Estado de carga del dashboard. Next lo muestra automáticamente mientras el
 * Server Component obtiene los datos (al entrar o al cambiar de ciclo), en vez
 * de dejar la pantalla anterior congelada sin señal de que algo pasa.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonEncabezado />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <SkeletonTabla filas={6} columnas={5} />
    </div>
  )
}
