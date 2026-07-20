'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { DisplayStatus } from '@/types/financial'
import { STATUS_CONFIG, INTERVAL_LABELS, formatCurrency } from '@/lib/utils/financial'
import { formatBrDate } from '@kinevo/shared/utils/format-br-date'

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

// Status como ponto + texto (pílula saiu no redesign). O label vem do
// STATUS_CONFIG compartilhado com o módulo Financeiro; aqui só a cor do ponto.
const STATUS_DOT: Record<DisplayStatus, string> = {
    courtesy: 'bg-blue-500',
    awaiting_payment: 'bg-amber-500',
    active: 'bg-emerald-500',
    grace_period: 'bg-amber-500',
    canceling: 'bg-amber-500',
    overdue: 'bg-red-500',
    canceled: 'bg-k-text-quaternary',
    expired: 'bg-red-500',
}

function StatusDot({ status }: { status: DisplayStatus }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-k-text-tertiary">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? 'bg-k-text-quaternary'}`} aria-hidden="true" />
            {STATUS_CONFIG[status]?.label ?? status}
        </span>
    )
}

export function FinancialSidebarCard({
    contract,
    displayStatus,
    onConfigureBilling,
    onViewHistory,
}: FinancialSidebarCardProps) {
    const isOverdue = displayStatus === 'overdue' || displayStatus === 'grace_period'

    // Empty state — painel hairline com texto quieto + ação
    if (!contract || displayStatus === 'courtesy') {
        return (
            <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Financeiro
                    </span>
                    <StatusDot status={displayStatus} />
                </div>
                <p className="text-[11.5px] text-k-text-quaternary mt-2 mb-3">Sem contrato ativo.</p>
                {onConfigureBilling && (
                    <button
                        onClick={onConfigureBilling}
                        className="px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset border border-k-border-primary rounded-control transition-colors"
                    >
                        Configurar cobrança
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Financeiro
                </span>
                <StatusDot status={displayStatus} />
            </div>

            <div className="space-y-2.5">
                {/* Plan + amount */}
                {(contract.plan_title || contract.amount != null) && (
                    <p className="text-sm text-k-text-secondary">
                        {contract.plan_title || 'Plano'}
                        {contract.amount != null && (
                            <>
                                <span className="text-k-text-quaternary mx-1">·</span>
                                <span className="font-mono font-semibold text-k-text-primary tabular-nums">
                                    {formatCurrency(contract.amount)}
                                </span>
                                <span className="text-k-text-quaternary text-xs">
                                    {INTERVAL_LABELS[contract.plan_interval || 'month'] || '/mês'}
                                </span>
                            </>
                        )}
                    </p>
                )}

                {/* Next due date / expiry */}
                {contract.current_period_end && displayStatus !== 'canceled' && (
                    <p className="text-xs text-k-text-tertiary">
                        {displayStatus === 'expired'
                            ? 'Expirou em'
                            : displayStatus === 'canceling'
                                ? 'Acesso até'
                                : 'Próx. vencimento'}
                        {' '}
                        <span className="font-mono text-k-text-secondary tabular-nums">
                            {formatBrDate(contract.current_period_end)}
                        </span>
                    </p>
                )}

                {/* Overdue alert */}
                {isOverdue && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Pagamento em atraso
                    </p>
                )}

                {/* Separator + View history */}
                {onViewHistory && (
                    <>
                        <div className="border-t border-k-border-subtle" />
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
