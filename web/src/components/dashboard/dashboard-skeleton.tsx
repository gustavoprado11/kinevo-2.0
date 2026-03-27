import { Skeleton } from '@/components/ui/skeleton'

const cardClass = "rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card p-5 shadow-apple-card dark:shadow-none"

// ── Quick Actions Skeleton ──

export function QuickActionsSkeleton() {
    return (
        <div className="flex gap-2 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-36 rounded-xl" />
            ))}
        </div>
    )
}

// ── Stat Cards Skeleton ──

export function StatCardsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cardClass}>
                    <div className="flex items-center justify-between mb-3">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="h-4 w-4 rounded" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                </div>
            ))}
        </div>
    )
}

// ── Insights Skeleton ──

export function InsightsSkeleton() {
    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Expiring Programs Skeleton ──

export function ExpiringProgramsSkeleton() {
    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <Skeleton className="h-3.5 w-36" />
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-border">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Activity Feed Skeleton ──

export function ActivityFeedSkeleton() {
    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <Skeleton className="h-3.5 w-28" />
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-3.5 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                        <div className="space-y-1.5 text-right">
                            <Skeleton className="h-3.5 w-10 ml-auto" />
                            <Skeleton className="h-3 w-8 ml-auto" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Full Dashboard Skeleton ──

export function DashboardSkeleton() {
    return (
        <div className="space-y-0">
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Skeleton className="h-8 w-56 mb-2" />
                    <Skeleton className="h-3.5 w-36" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>

            {/* Quick Actions */}
            <QuickActionsSkeleton />

            {/* Stat Cards */}
            <StatCardsSkeleton />

            {/* Insights + Expiring grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 mb-6">
                <InsightsSkeleton />
                <ExpiringProgramsSkeleton />
            </div>

            {/* Activity Feed */}
            <ActivityFeedSkeleton />
        </div>
    )
}
