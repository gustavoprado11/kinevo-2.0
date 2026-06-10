import { Skeleton } from "@/components/ui/skeleton"

// Espelha a biblioteca de exercícios: header + busca/filtros + grid de cards.
export default function ExercisesLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-10 w-44 rounded-md" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-full max-w-sm rounded-md" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
