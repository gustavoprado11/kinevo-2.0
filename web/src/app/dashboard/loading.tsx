import { AppLayout } from '@/components/layout'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'

export default function DashboardLoading() {
    return (
        <AppLayout trainerName="" trainerEmail="">
            <div className="kv-mode-in">
                <DashboardSkeleton />
            </div>
        </AppLayout>
    )
}
