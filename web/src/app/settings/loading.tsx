import { Skeleton } from "@/components/ui/skeleton"

// Espelha configurações: header + seções empilhadas (perfil, billing, etc.).
export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4 max-w-3xl">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
