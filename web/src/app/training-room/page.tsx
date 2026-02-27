import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { TrainingRoomClient } from './training-room-client'
import { AppLayout } from '@/components/layout'

export default async function TrainingRoomPage() {
    const { trainer } = await getTrainerWithSubscription()

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            <TrainingRoomClient trainerId={trainer.id} />
        </AppLayout>
    )
}
