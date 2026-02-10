import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { AppLayout } from '@/components/layout'
import { BillingSection } from '@/components/settings/billing-section'

export default async function SettingsPage() {
    const { trainer, subscription } = await getTrainerWithSubscription()

    return (
        <AppLayout trainerName={trainer.name} trainerEmail={trainer.email}>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Configurações</h1>
                <p className="text-gray-400 mt-1">Gerencie suas preferências e assinatura</p>
            </div>

            <BillingSection subscription={subscription} />
        </AppLayout>
    )
}
