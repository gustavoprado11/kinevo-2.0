import { Skeleton } from "@/components/ui/skeleton"

// Espelha o dashboard de formulários redesenhado: header + régua de métricas
// + painéis hairline (pendências/templates à esquerda, respostas à direita).
export default function FormsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-40 rounded-control" />
          <Skeleton className="h-9 w-36 rounded-control" />
        </div>
      </div>

      <Skeleton className="h-9 w-56 rounded-control" />

      {/* Régua de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-panel border border-k-border-subtle bg-k-border-subtle overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-card px-5 py-4 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, col) => (
          <div key={col} className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-k-border-subtle">
              <Skeleton className="h-3.5 w-40" />
            </div>
            <div className="divide-y divide-k-border-subtle">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
