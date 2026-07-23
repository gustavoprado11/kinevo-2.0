import type { DisplayStatus } from '@/types/financial'

interface ContractForStatus {
    billing_type: string | null
    status: string | null
    cancel_at_period_end: boolean | null
    current_period_end: string | null
}

/**
 * Replicates the display_status logic from the get_financial_students() RPC.
 * See migration 043_financial_v2_functions.sql for the canonical SQL version.
 */
export function computeDisplayStatus(contract: ContractForStatus | null): DisplayStatus {
    if (!contract) return 'courtesy'
    if (contract.billing_type === 'courtesy') return 'courtesy'
    if (contract.status === 'canceled') {
        // Expired = period ended naturally; Canceled = deliberate cancellation before period end
        if (contract.current_period_end && new Date(contract.current_period_end).getTime() < Date.now()) {
            return 'expired'
        }
        return 'canceled'
    }
    if (contract.status === 'pending') return 'awaiting_payment'
    if (contract.cancel_at_period_end && contract.status !== 'canceled') {
        // Period already ended → expired, not "canceling"
        if (contract.current_period_end && new Date(contract.current_period_end).getTime() < Date.now()) {
            return 'expired'
        }
        return 'canceling'
    }
    if (contract.status === 'past_due') return 'overdue'

    if (
        contract.status === 'active' &&
        (contract.billing_type === 'manual_recurring' ||
            contract.billing_type === 'manual_one_off' ||
            // asaas_auto (prazo fixo Asaas) agora ganha vigência na confirmação
            // → entra na mesma janela de graça/vencido dos manuais.
            contract.billing_type === 'asaas_auto') &&
        contract.current_period_end
    ) {
        const periodEnd = new Date(contract.current_period_end).getTime()
        const now = Date.now()
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000

        if (periodEnd < now && periodEnd >= now - threeDaysMs) return 'grace_period'
        if (periodEnd < now - threeDaysMs) return 'overdue'
    }

    if (contract.status === 'active') return 'active'

    return 'courtesy'
}

export const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
    courtesy: { label: 'Cortesia', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    awaiting_payment: { label: 'Aguardando', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
    active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    grace_period: { label: 'Período de Graça', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    canceling: { label: 'Cancelando', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    overdue: { label: 'Inadimplente', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
    canceled: { label: 'Encerrado', className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' },
    expired: { label: 'Expirado', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
}

export const INTERVAL_LABELS: Record<string, string> = {
    month: '/mês',
    quarter: '/trimestre',
    year: '/ano',
}

/**
 * Natureza comercial do contrato — separa o que o gestor precisa distinguir:
 *   • subscription (Assinatura): renova sozinha a cada ciclo. Interessa a
 *     "próxima cobrança".
 *   • fixed_term (Plano): prazo fixo (ex.: "3 meses"), vence e NÃO renova
 *     sozinho. Interessa a "vigência do plano" (até quando vale).
 *   • courtesy (Cortesia): acesso liberado, sem cobrança nem vencimento.
 *
 * A fonte da verdade é o billing_type. `asaas_auto` = link Asaas pago uma vez
 * (à vista OU parcelado no cartão) = prazo fixo; `asaas_auto_recurring` = cartão
 * que recobra todo ciclo = assinatura.
 */
export type ContractKind = 'subscription' | 'fixed_term' | 'courtesy'

const FIXED_TERM_BILLING = new Set(['manual_one_off', 'asaas_auto'])
const SUBSCRIPTION_BILLING = new Set(['manual_recurring', 'stripe_auto', 'asaas_auto_recurring'])

export function getContractKind(billingType: string | null | undefined): ContractKind {
    if (!billingType || billingType === 'courtesy') return 'courtesy'
    if (FIXED_TERM_BILLING.has(billingType)) return 'fixed_term'
    if (SUBSCRIPTION_BILLING.has(billingType)) return 'subscription'
    return 'subscription'
}

export const CONTRACT_KIND_CONFIG: Record<ContractKind, { label: string; description: string }> = {
    subscription: { label: 'Assinatura', description: 'Renova automaticamente a cada ciclo' },
    fixed_term: { label: 'Plano', description: 'Prazo fixo — vence e não renova sozinho' },
    courtesy: { label: 'Cortesia', description: 'Acesso liberado, sem cobrança' },
}

/**
 * Rótulo da data de vigência conforme a natureza do contrato e o status.
 * Resolve a confusão "que vencimento é esse?" — deixa explícito que é o do
 * PLANO (comercial), distinto do vencimento do TREINO (fim do programa).
 */
export function periodEndLabel(kind: ContractKind, displayStatus: DisplayStatus): string {
    if (displayStatus === 'expired') return 'Plano expirou em'
    // Plano de prazo fixo: sempre "válido até" (a data é o fim da vigência).
    if (kind === 'fixed_term') return 'Plano válido até'
    // Assinatura: a data é a próxima cobrança (ou o fim do acesso, se cancelando).
    return displayStatus === 'canceling' ? 'Acesso até' : 'Próx. cobrança'
}

// S5: delega para a fonte única web+mobile (a versão Intl daqui produzia
// espaço não-quebrável e divergia da string-built do mobile).
export { formatBRL, formatBRL as formatCurrency, parseBRL } from '@kinevo/shared/utils/currency'
