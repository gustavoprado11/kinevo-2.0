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
    if (contract.status === 'canceled') return 'canceled'
    if (contract.status === 'pending') return 'awaiting_payment'
    if (contract.cancel_at_period_end && contract.status !== 'canceled') return 'canceling'
    if (contract.status === 'past_due') return 'overdue'

    if (
        contract.status === 'active' &&
        (contract.billing_type === 'manual_recurring' || contract.billing_type === 'manual_one_off') &&
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
}

export const INTERVAL_LABELS: Record<string, string> = {
    month: '/mês',
    quarter: '/trimestre',
    year: '/ano',
}

export const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
