import { SkeletonEncabezado, SkeletonKpi, SkeletonTabla } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonEncabezado />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
      <SkeletonTabla filas={8} columnas={6} />
    </div>
  )
}
