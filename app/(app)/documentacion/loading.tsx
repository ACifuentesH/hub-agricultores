import { SkeletonEncabezado, SkeletonBox, SkeletonCard, SkeletonTabs } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonEncabezado />
      <SkeletonTabs />
      <div className="space-y-3">
        <SkeletonBox className="h-2.5 w-64" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
