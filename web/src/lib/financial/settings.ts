// ============================================================================
// Financial settings — server-side helpers
// ============================================================================
// Lê e escreve em trainer_financial_settings. Sempre retorna defaults sensatos
// (mesmo quando ainda não existe linha pro trainer) pra UI ter algo válido pra
// renderizar antes do primeiro update.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface FinancialSettings {
    defaultAllowPix: boolean
    defaultAllowCreditCard: boolean
    defaultAllowBoleto: boolean
    blockOnOverdue: boolean
    overdueGraceDays: number
    notifyOnPaymentReceived: boolean
    notifyOnSubscriptionCanceled: boolean
    notifyOnPayoutCompleted: boolean
    notifyOnKycAlert: boolean
    showStripeLegacy: boolean
}

/** Defaults aplicados quando o trainer ainda não tem linha em trainer_financial_settings. */
export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
    defaultAllowPix: true,
    defaultAllowCreditCard: true,
    defaultAllowBoleto: false,
    blockOnOverdue: true,
    overdueGraceDays: 3,
    notifyOnPaymentReceived: true,
    notifyOnSubscriptionCanceled: true,
    notifyOnPayoutCompleted: true,
    notifyOnKycAlert: true,
    showStripeLegacy: false,
}

interface SettingsRow {
    default_allow_pix: boolean
    default_allow_credit_card: boolean
    default_allow_boleto: boolean
    block_on_overdue: boolean
    overdue_grace_days: number
    notify_on_payment_received: boolean
    notify_on_subscription_canceled: boolean
    notify_on_payout_completed: boolean
    notify_on_kyc_alert: boolean
    show_stripe_legacy: boolean
}

function rowToSettings(row: SettingsRow): FinancialSettings {
    return {
        defaultAllowPix: row.default_allow_pix,
        defaultAllowCreditCard: row.default_allow_credit_card,
        defaultAllowBoleto: row.default_allow_boleto,
        blockOnOverdue: row.block_on_overdue,
        overdueGraceDays: row.overdue_grace_days,
        notifyOnPaymentReceived: row.notify_on_payment_received,
        notifyOnSubscriptionCanceled: row.notify_on_subscription_canceled,
        notifyOnPayoutCompleted: row.notify_on_payout_completed,
        notifyOnKycAlert: row.notify_on_kyc_alert,
        showStripeLegacy: row.show_stripe_legacy,
    }
}

function settingsToRow(s: Partial<FinancialSettings>): Partial<SettingsRow> {
    const out: Partial<SettingsRow> = {}
    if (s.defaultAllowPix !== undefined) out.default_allow_pix = s.defaultAllowPix
    if (s.defaultAllowCreditCard !== undefined) out.default_allow_credit_card = s.defaultAllowCreditCard
    if (s.defaultAllowBoleto !== undefined) out.default_allow_boleto = s.defaultAllowBoleto
    if (s.blockOnOverdue !== undefined) out.block_on_overdue = s.blockOnOverdue
    if (s.overdueGraceDays !== undefined) out.overdue_grace_days = s.overdueGraceDays
    if (s.notifyOnPaymentReceived !== undefined) out.notify_on_payment_received = s.notifyOnPaymentReceived
    if (s.notifyOnSubscriptionCanceled !== undefined) out.notify_on_subscription_canceled = s.notifyOnSubscriptionCanceled
    if (s.notifyOnPayoutCompleted !== undefined) out.notify_on_payout_completed = s.notifyOnPayoutCompleted
    if (s.notifyOnKycAlert !== undefined) out.notify_on_kyc_alert = s.notifyOnKycAlert
    if (s.showStripeLegacy !== undefined) out.show_stripe_legacy = s.showStripeLegacy
    return out
}

/**
 * Lê as configurações do trainer. Se não houver linha ainda, retorna os
 * defaults definidos no DB (sem criar a linha — só na primeira escrita).
 */
export async function getFinancialSettings(trainerId: string): Promise<FinancialSettings> {
    const { data, error } = await supabaseAdmin
        .from('trainer_financial_settings')
        .select(
            'default_allow_pix, default_allow_credit_card, default_allow_boleto, ' +
            'block_on_overdue, overdue_grace_days, ' +
            'notify_on_payment_received, notify_on_subscription_canceled, notify_on_payout_completed, notify_on_kyc_alert, ' +
            'show_stripe_legacy'
        )
        .eq('trainer_id', trainerId)
        .maybeSingle()

    if (error) {
        console.error('[financial/settings] read failed:', error)
        return DEFAULT_FINANCIAL_SETTINGS
    }

    if (!data) return DEFAULT_FINANCIAL_SETTINGS
    return rowToSettings(data as unknown as SettingsRow)
}

/**
 * Atualiza (ou cria, na primeira chamada) as configurações do trainer.
 * Aceita patch parcial — só os campos passados são alterados.
 * Retorna a versão completa atualizada.
 */
export async function updateFinancialSettings(
    trainerId: string,
    patch: Partial<FinancialSettings>
): Promise<FinancialSettings> {
    // Validações de range pra campos sensíveis
    if (patch.overdueGraceDays !== undefined) {
        if (!Number.isInteger(patch.overdueGraceDays) || patch.overdueGraceDays < 1 || patch.overdueGraceDays > 30) {
            throw new Error('overdueGraceDays deve ser inteiro entre 1 e 30')
        }
    }

    const rowPatch = settingsToRow(patch)

    // Upsert: cria linha com defaults na primeira vez, depois apenas atualiza os
    // campos passados.
    const { data, error } = await supabaseAdmin
        .from('trainer_financial_settings')
        .upsert(
            { trainer_id: trainerId, ...rowPatch },
            { onConflict: 'trainer_id' }
        )
        .select(
            'default_allow_pix, default_allow_credit_card, default_allow_boleto, ' +
            'block_on_overdue, overdue_grace_days, ' +
            'notify_on_payment_received, notify_on_subscription_canceled, notify_on_payout_completed, notify_on_kyc_alert, ' +
            'show_stripe_legacy'
        )
        .single()

    if (error || !data) {
        throw new Error(`Falha ao salvar configurações: ${error?.message ?? 'erro desconhecido'}`)
    }

    return rowToSettings(data as unknown as SettingsRow)
}
