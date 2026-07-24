import LoadingCampo from '@/components/LoadingCampo'
import { SkeletonEncabezado, SkeletonBox } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonEncabezado />

      {/* Índice de lotes */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <SkeletonBox className="mb-2 h-2.5 w-44" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBox key={i} className="h-6 w-24 rounded-md" />
          ))}
        </div>
      </div>

      {/* Panel de un lote: línea de tiempo + 4 tarjetas */}
      <div className="space-y-4">
        <SkeletonBox className="h-5 w-52" />
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <LoadingCampo mensaje="Calculando la etapa de tus lotes…" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <SkeletonBox className="mb-3 h-2.5 w-24" />
              <SkeletonBox className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
