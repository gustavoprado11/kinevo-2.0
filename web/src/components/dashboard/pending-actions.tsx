'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CheckCircle, Check, FolderArchive } from 'lucide-react'
import Link from 'next/link'
import type { PendingFinancialItem, PendingFormItem, InactiveStudentItem, ExpiredPlanItem } from '@/lib/dashboard/get-dashboard-data'

function ActionAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
    if (avatarUrl) {
        return (
            <Image
                src={avatarUrl}
                alt={name}
                width={28}
                height={28}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
        )
    }
    return (
        <div className="w-7 h-7 rounded-full border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-glass-bg flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-[#6E6E73] dark:text-k-text-secondary">
                {name.charAt(0).toUpperCase()}
            </span>
        </div>
    )
}

interface PendingActionsProps {
    pendingFinancial: PendingFinancialItem[]
    pendingForms: PendingFormItem[]
    inactiveStudents: InactiveStudentItem[]
    expiredPlans: ExpiredPlanItem[]
    activeStudentsCount: number
    onMarkAsPaid: (contractId: string) => Promise<void>
    onSellPlan?: (studentId: string) => void
    onArchiveStudent?: (studentId: string, studentName: string) => void
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `há ${diffMin}min`
    if (diffHours < 24) return `há ${diffHours}h`
    if (diffDays === 1) return 'ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function PendingActions({
    pendingFinancial,
    pendingForms,
    inactiveStudents,
    expiredPlans,
    activeStudentsCount,
    onMarkAsPaid,
    onSellPlan,
    onArchiveStudent,
}: PendingActionsProps) {
    const [markingPaid, setMarkingPaid] = useState<string | null>(null)
    const [dismissedContracts, setDismissedContracts] = useState<Set<string>>(new Set())

    const visibleFinancial = pendingFinancial.filter(c => !dismissedContracts.has(c.id))
    const totalPending = visibleFinancial.length + expiredPlans.length + pendingForms.length + inactiveStudents.length

    const handleMarkAsPaid = async (contractId: string) => {
        setMarkingPaid(contractId)
        await onMarkAsPaid(contractId)
        setDismissedContracts(prev => new Set(prev).add(contractId))
        setMarkingPaid(null)
    }

    // No pending items — show "all good" banner (only if trainer has students)
    if (totalPending === 0) {
        if (activeStudentsCount > 0) {
            return (
                <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-emerald-500/5 border border-[#D2D2D7] dark:border-emerald-500/10 rounded-xl mb-6 w-fit shadow-apple-card dark:shadow-none">
                    <Check size={14} className="text-[#34C759] dark:text-emerald-400" />
                    <span className="text-xs font-medium text-[#34C759] dark:text-emerald-400">Tudo em dia!</span>
                </div>
            )
        }
        return null
    }

    // Build unified action items sorted by urgency
    type ActionItem = {
        key: string
        urgency: 'high' | 'medium' | 'low'
        isLast?: boolean
        render: (isLast: boolean) => React.ReactNode
    }

    const items: ActionItem[] = []

    // Financial items
    for (const c of visibleFinancial) {
        const isPastDue = c.currentPeriodEnd && new Date(c.currentPeriodEnd) < new Date()
        const isManual = c.billingType === 'manual_recurring' || c.billingType === 'manual_one_off'

        items.push({
            key: `fin-${c.id}`,
            urgency: isPastDue ? 'high' : 'medium',
            render: (isLast: boolean) => (
                <div
                    className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                        !isLast ? 'border-b border-[#D2D2D7]/60 dark:border-k-border-subtle' : ''
                    } ${
                        isPastDue
                            ? 'dark:bg-red-500/5 dark:border-red-500/15'
                            : 'dark:bg-amber-500/5 dark:border-amber-500/15'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={c.studentName} avatarUrl={c.studentAvatar} />
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary block truncate">{c.studentName}</span>
                            <span className="text-xs text-[#6E6E73] dark:text-k-text-quaternary block">
                                {formatCurrency(c.amount)}
                                {c.currentPeriodEnd && ` · ${isPastDue ? 'venceu' : 'vence'} ${new Date(c.currentPeriodEnd).toLocaleDateString('pt-BR')}`}
                            </span>
                            <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary">Financeiro</span>
                        </div>
                    </div>
                    {isManual ? (
                        <button
                            onClick={() => handleMarkAsPaid(c.id)}
                            disabled={markingPaid === c.id}
                            className={`text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 text-[#007AFF] hover:text-[#0056B3] ${
                                isPastDue
                                    ? 'dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'
                                    : 'dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20'
                            } dark:text-sm dark:px-3 dark:py-1.5 dark:rounded-lg`}
                        >
                            <CheckCircle size={13} />
                            {markingPaid === c.id ? 'Registrando...' : 'Registrar pagamento'}
                        </button>
                    ) : (
                        <Link
                            href="/financial/subscriptions"
                            className="text-sm font-medium text-[#007AFF] hover:text-[#0056B3] dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 dark:px-3 dark:py-1.5 dark:rounded-lg transition-colors flex-shrink-0"
                        >
                            Ver contrato →
                        </Link>
                    )}
                </div>
            ),
        })
    }

    // Expired plans — priority between financial and forms
    for (const ep of expiredPlans) {
        items.push({
            key: `expired-${ep.studentId}`,
            urgency: 'medium',
            render: (isLast: boolean) => (
                <div className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                    !isLast ? 'border-b border-[#D2D2D7]/60 dark:border-k-border-subtle' : ''
                } dark:bg-red-500/5 dark:border-red-500/15`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={ep.studentName} avatarUrl={ep.studentAvatar} />
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary block truncate">{ep.studentName}</span>
                            <span className="text-xs text-[#6E6E73] dark:text-k-text-quaternary block">
                                {ep.planTitle ? `${ep.planTitle} · ` : ''}Expirou em {new Date(ep.expiredAt).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary">Plano expirado</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {onSellPlan && (
                            <button
                                onClick={() => onSellPlan(ep.studentId)}
                                className="text-sm font-medium text-[#007AFF] hover:text-[#0056B3] dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 dark:px-3 dark:py-1.5 dark:rounded-lg transition-colors"
                            >
                                Vender novo plano →
                            </button>
                        )}
                        {onArchiveStudent && (
                            <button
                                onClick={() => onArchiveStudent(ep.studentId, ep.studentName)}
                                className="text-sm font-medium text-[#86868B] hover:text-[#FF3B30] dark:bg-gray-500/10 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 dark:px-3 dark:py-1.5 dark:rounded-lg transition-colors flex items-center gap-1"
                            >
                                <FolderArchive size={13} />
                                Arquivar
                            </button>
                        )}
                    </div>
                </div>
            ),
        })
    }

    // Form items
    for (const f of pendingForms) {
        items.push({
            key: `form-${f.id}`,
            urgency: 'low',
            render: (isLast: boolean) => (
                <div className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                    !isLast ? 'border-b border-[#D2D2D7]/60 dark:border-k-border-subtle' : ''
                } dark:bg-violet-500/5 dark:border-violet-500/15`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={f.studentName} avatarUrl={f.studentAvatar} />
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary block truncate">{f.studentName}</span>
                            <span className="text-xs text-[#6E6E73] dark:text-k-text-quaternary block" suppressHydrationWarning>
                                Respondeu {f.templateTitle} {timeAgo(f.submittedAt)}
                            </span>
                            <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary">Avaliação</span>
                        </div>
                    </div>
                    <Link
                        href="/forms"
                        className="text-sm font-medium text-[#007AFF] hover:text-[#0056B3] dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20 dark:px-3 dark:py-1.5 dark:rounded-lg transition-colors flex-shrink-0"
                    >
                        Dar feedback →
                    </Link>
                </div>
            ),
        })
    }

    // Inactive students
    for (const s of inactiveStudents) {
        items.push({
            key: `inactive-${s.id}`,
            urgency: s.daysSinceLastSession > 7 ? 'medium' : 'low',
            render: (isLast: boolean) => (
                <div className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                    !isLast ? 'border-b border-[#D2D2D7]/60 dark:border-k-border-subtle' : ''
                } ${
                    s.daysSinceLastSession > 7
                        ? 'dark:bg-red-500/5 dark:border-red-500/15'
                        : 'dark:bg-amber-500/5 dark:border-amber-500/15'
                }`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={s.name} avatarUrl={s.avatarUrl} />
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary block truncate">{s.name}</span>
                            <span className="text-xs text-[#6E6E73] dark:text-k-text-quaternary block">
                                {s.daysSinceLastSession >= 999 ? 'Ainda não treinou' : `Sem treinar há ${s.daysSinceLastSession} dias`}
                            </span>
                            <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary">Aluno</span>
                        </div>
                    </div>
                    <Link
                        href={`/students/${s.id}`}
                        className={`text-sm font-medium text-[#007AFF] hover:text-[#0056B3] transition-colors flex-shrink-0 ${
                            s.daysSinceLastSession > 7
                                ? 'dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'
                                : 'dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20'
                        } dark:px-3 dark:py-1.5 dark:rounded-lg`}
                    >
                        Ver perfil →
                    </Link>
                </div>
            ),
        })
    }

    // Sort by urgency
    const urgencyOrder = { high: 0, medium: 1, low: 2 }
    items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

    const visibleItems = items.slice(0, 5)
    const hasMore = items.length > 5

    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Ações pendentes</span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold text-white bg-[#FF3B30] dark:text-k-text-quaternary dark:bg-glass-bg rounded-full">
                    {totalPending}
                </span>
            </div>
            <div className="bg-white dark:bg-transparent rounded-xl border border-[#D2D2D7] dark:border-transparent shadow-apple-card dark:shadow-none overflow-hidden">
                {visibleItems.map((item, index) => (
                    <div key={item.key}>{item.render(index === visibleItems.length - 1 && !hasMore)}</div>
                ))}
                {hasMore && (
                    <div className="px-4 py-2 border-t border-[#E8E8ED] dark:border-k-border-subtle">
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-secondary transition-colors cursor-default">
                            e mais {items.length - 5} pendência{items.length - 5 > 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
