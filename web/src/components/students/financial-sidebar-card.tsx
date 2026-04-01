'use client'

import { CreditCard, AlertTriangle, ArrowRight } from 'lucide-react'
import type { DisplayStatus } from '@/types/financial'
import { STATUS_CONFIG, INTERVAL_LABELS, formatCurrency } from '@/lib/utils/financial'

interface FinancialContract {
    id: string
    billing_type: string
    amount: number | null
    current_period_end: string | null
    cancel_at_period_end: boolean | null
    plan_title: string | null
    plan_interval: string | null
}

interface FinancialSidebarCardProps {
    studentId: string
    contract: FinancialContract | null
    displayStatus: DisplayStatus
    onConfigureBilling?: () => void
    onViewHistory?: () => void
}

export function FinancialSidebarCard({
    contract,
    displayStatus,
    onConfigureBilling,
    onViewHistory,
}: FinancialSidebarCardProps) {
    const statusCfg = STATUS_CONFIG[displayStatus]
    const isOverdue = displayStatus === 'overdue' || displayStatus === 'grace_period'

    // Empty state — follows "Próximos Programas" empty pattern
    if (!contract || displayStatus === 'courtesy') {
        return (
            <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        Financeiro
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusCfg.className}`}>
                            {statusCfg.label}
                        </span>
                    </h3>
                </div>
                <div className="text-center py-4">
                    <p className="text-sm text-[#86868B] dark:text-k-text-quaternary mb-3">Sem contrato ativo</p>
                    {onConfigureBilling && (
                        <div className="flex items-center justify-center">
                            <button
                                onClick={onConfigureBilling}
                                className="px-3 py-1.5 text-xs font-bold text-k-text-tertiary hover:text-k-text-primary border border-k-border-subtle rounded-lg transition-all"
                            >
                                Configurar cobrança
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6">
            {/* Header — same pattern as Observações / Próximos Programas */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                    Financeiro
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusCfg.className}`}>
                        {statusCfg.label}
                    </span>
                </h3>
            </div>

            <div className="space-y-3">
                {/* Plan + amount */}
                {(contract.plan_title || contract.amount != null) && (
                    <div>
                        <p className="text-sm font-medium text-[#1C1C1E] dark:text-k-text-secondary">
                            {contract.plan_title || 'Plano'}
                            {contract.amount != null && (
                                <>
                                    <span className="text-[#86868B] dark:text-k-text-quaternary mx-1">·</span>
                                    <span className="font-semibold text-[#1C1C1E] dark:text-white">
                                        {formatCurrency(contract.amount)}
                                    </span>
                                    <span className="text-[#86868B] dark:text-k-text-quaternary text-xs">
                                        {INTERVAL_LABELS[contract.plan_interval || 'month'] || '/mês'}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                )}

                {/* Next due date / expiry */}
                {contract.current_period_end && displayStatus !== 'canceled' && (
                    <div>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">
                            {displayStatus === 'expired'
                                ? 'Expirou em'
                                : displayStatus === 'canceling'
                                    ? 'Acesso até'
                                    : 'Próx. vencimento'}
                        </p>
                        <p className="text-sm font-medium text-[#1C1C1E] dark:text-k-text-secondary mt-0.5">
                            {new Date(contract.current_period_end).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                )}

                {/* Overdue alert */}
                {isOverdue && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            Pagamento em atraso
                        </span>
                    </div>
                )}

                {/* Separator + View history */}
                {onViewHistory && (
                    <>
                        <div className="border-t border-[#E5E5EA]/50 dark:border-k-border-primary/50" />
                        <button
                            onClick={onViewHistory}
                            className="flex items-center gap-1.5 text-xs font-medium text-k-text-tertiary hover:text-k-text-primary transition-colors"
                        >
                            Ver histórico
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
