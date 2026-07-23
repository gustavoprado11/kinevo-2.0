import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getUpcomingRenewals } from '@/lib/financial/upcoming-renewals'
import { VencimentosClient } from './vencimentos-client'

export default async function VencimentosPage() {
    const { trainer } = await getTrainerWithSubscription()
    const renewals = await getUpcomingRenewals(trainer.id)
    return (
        <VencimentosClient
            renewals={renewals}
            trainer={{
                name: trainer.name,
                email: trainer.email,
                avatar_url: trainer.avatar_url,
                theme: trainer.theme,
            }}
        />
    )
}
