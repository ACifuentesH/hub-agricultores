import { SkeletonEncabezado, SkeletonBox, SkeletonCard } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonEncabezado />

      {/* Las cuatro secciones del repositorio, cada una como grilla de tarjetas */}
      {Array.from({ length: 4 }).map((_, i) => (
        <section key={i} className="space-y-3">
          <div className="flex items-start gap-2.5">
            <SkeletonBox className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <SkeletonBox className="h-4 w-40" />
              <SkeletonBox className="h-2.5 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, c) => (
              <SkeletonCard key={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
