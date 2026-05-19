// ============================================================================
// /financial/settings — Configurações da Carteira e do módulo Financeiro
// ============================================================================
// Server component: carrega estado da Carteira + flags de configuração.
// Sub-páginas servem casos avançados — a maioria dos trainers nunca precisa
// abrir esta página, mas ela existe pra centralizar tudo num lugar só.
// ============================================================================

import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getWalletRow, summarizeWallet } from '@/lib/asaas/wallet-service'
import { getFinancialSettings } from '@/lib/financial/settings'
import { FinancialSettingsClient } from './settings-client'
import type { KinevoWalletSummary } from '@/lib/asaas'

export default async function FinancialSettingsPage() {
    const { trainer } = await getTrainerWithSubscription()

    // Server fetches em paralelo
    const [walletRow, settings, legacyStripeContractsResp] = await Promise.all([
        getWalletRow(trainer.id),
        getFinancialSettings(trainer.id),
        supabaseAdmin
            .from('student_contracts')
            .select('id')
            .eq('trainer_id', trainer.id)
            .in('status', ['active', 'past_due'])
            .or('billing_type.eq.stripe_auto,stripe_subscription_id.not.is.null')
            .limit(1),
    ])

    const walletSummary: KinevoWalletSummary = summarizeWallet(walletRow)
    const hasStripeLegacyContracts = (legacyStripeContractsResp.data?.length ?? 0) > 0

    return (
        <FinancialSettingsClient
            trainer={{
                name: trainer.name,
                email: trainer.email,
                avatarUrl: trainer.avatar_url,
                theme: trainer.theme as 'light' | 'dark' | 'system' | null,
            }}
            wallet={walletSummary}
            hasStripeLegacyContracts={hasStripeLegacyContracts}
            initialSettings={settings}
        />
    )
}
