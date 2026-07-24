import LoadingCampo from '@/components/LoadingCampo'
import { SkeletonEncabezado, SkeletonPanel, SkeletonBox } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonEncabezado />

      {/* Tarjeta "Lectura más reciente" */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <SkeletonBox className="h-4 w-40" />
          <SkeletonBox className="h-5 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <SkeletonBox className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <SkeletonBox className="h-2.5 w-16" />
                <SkeletonBox className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonPanel className="h-44" />
        </div>
        <SkeletonPanel className="h-44" />
      </div>

      {/* El histórico es lo más pesado: aquí va la animación de marca */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <LoadingCampo mensaje="Consultando la estación…" />
      </div>
    </div>
  )
}
