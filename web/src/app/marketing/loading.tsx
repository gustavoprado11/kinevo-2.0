import { Skeleton } from "@/components/ui/skeleton"

// Renderiza DENTRO do marketing/layout.tsx (que já traz AppLayout + header +
// tabs). Espelha a overview: card de status da landing + KPIs + leads recentes.
export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-6 pb-10 space-y-5">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}
