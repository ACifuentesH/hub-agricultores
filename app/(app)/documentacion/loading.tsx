import { SkeletonEncabezado, SkeletonBox, SkeletonTabla } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonEncabezado />

      {/* Las cuatro secciones del repositorio */}
      {Array.from({ length: 4 }).map((_, i) => (
        <section key={i} className="space-y-3">
          <div className="flex items-start gap-2.5">
            <SkeletonBox className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <SkeletonBox className="h-4 w-40" />
              <SkeletonBox className="h-2.5 w-64" />
            </div>
          </div>
          <SkeletonTabla filas={2} columnas={4} />
        </section>
      ))}
    </div>
  )
}
