import { Skeleton } from "@/components/ui/skeleton"

// Skeleton mirrors the 3-column layout of ProgramBuilderClient (left rail with
// week/day picker, center canvas with workout cards, right panel with exercise
// library) so swapping skeleton → real builder produces minimal layout shift.
// Without this file the previous route stayed visible during SSR, causing the
// CLS 0.26 reported by Vercel Speed Insights on this route.
export default function NewProgramLoading() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-64" />
                    <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24 rounded-md" />
                    <Skeleton className="h-10 w-32 rounded-md" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-4">
                <div className="space-y-3">
                    <Skeleton className="h-9 w-full rounded-md" />
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                </div>

                <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-3 rounded-lg border border-border/40 p-4">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-8 w-20 rounded-md" />
                            </div>
                            {[...Array(3)].map((__, j) => (
                                <Skeleton key={j} className="h-14 w-full rounded-md" />
                            ))}
                        </div>
                    ))}
                </div>

                <div className="space-y-3">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-9 w-full rounded-md" />
                    {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-md" />
                    ))}
                </div>
            </div>
        </div>
    )
}
