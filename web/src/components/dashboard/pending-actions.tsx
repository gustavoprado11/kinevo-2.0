'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CheckCircle, Check } from 'lucide-react'
import Link from 'next/link'
import type { PendingFinancialItem, PendingFormItem, InactiveStudentItem } from '@/lib/dashboard/get-dashboard-data'

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
        <div className="w-7 h-7 rounded-full border border-k-border-subtle bg-glass-bg flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-k-text-secondary">
                {name.charAt(0).toUpperCase()}
            </span>
        </div>
    )
}

interface PendingActionsProps {
    pendingFinancial: PendingFinancialItem[]
    pendingForms: PendingFormItem[]
    inactiveStudents: InactiveStudentItem[]
    activeStudentsCount: number
    onMarkAsPaid: (contractId: string) => Promise<void>
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
    activeStudentsCount,
    onMarkAsPaid,
}: PendingActionsProps) {
    const [markingPaid, setMarkingPaid] = useState<string | null>(null)
    const [dismissedContracts, setDismissedContracts] = useState<Set<string>>(new Set())

    const visibleFinancial = pendingFinancial.filter(c => !dismissedContracts.has(c.id))
    const totalPending = visibleFinancial.length + pendingForms.length + inactiveStudents.length

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
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-6 w-fit">
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400">Tudo em dia!</span>
                </div>
            )
        }
        return null
    }

    // Build unified action items sorted by urgency
    type ActionItem = {
        key: string
        urgency: 'high' | 'medium' | 'low'
        render: () => React.ReactNode
    }

    const items: ActionItem[] = []

    // Financial items
    for (const c of visibleFinancial) {
        const isPastDue = c.currentPeriodEnd && new Date(c.currentPeriodEnd) < new Date()
        const isManual = c.billingType === 'manual_recurring' || c.billingType === 'manual_one_off'

        items.push({
            key: `fin-${c.id}`,
            urgency: isPastDue ? 'high' : 'medium',
            render: () => (
                <div
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isPastDue
                            ? 'bg-red-500/5 border-red-500/15'
                            : 'bg-amber-500/5 border-amber-500/15'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={c.studentName} avatarUrl={c.studentAvatar} />
                        <div className="min-w-0">
                            <span className="text-sm text-k-text-primary block truncate">{c.studentName}</span>
                            <span className="text-xs text-k-text-quaternary block">
                                {formatCurrency(c.amount)}
                                {c.currentPeriodEnd && ` · ${isPastDue ? 'venceu' : 'vence'} ${new Date(c.currentPeriodEnd).toLocaleDateString('pt-BR')}`}
                            </span>
                            <span className="text-[10px] text-k-text-quaternary">Financeiro</span>
                        </div>
                    </div>
                    {isManual ? (
                        <button
                            onClick={() => handleMarkAsPaid(c.id)}
                            disabled={markingPaid === c.id}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 ${
                                isPastDue
                                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                            }`}
                        >
                            <CheckCircle size={13} />
                            {markingPaid === c.id ? 'Registrando...' : 'Registrar pagamento'}
                        </button>
                    ) : (
                        <Link
                            href="/financial/subscriptions"
                            className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg font-medium transition-colors flex-shrink-0"
                        >
                            Ver contrato →
                        </Link>
                    )}
                </div>
            ),
        })
    }

    // Form items
    for (const f of pendingForms) {
        items.push({
            key: `form-${f.id}`,
            urgency: 'low',
            render: () => (
                <div className="flex items-center justify-between p-3 rounded-xl border bg-violet-500/5 border-violet-500/15">
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={f.studentName} avatarUrl={f.studentAvatar} />
                        <div className="min-w-0">
                            <span className="text-sm text-k-text-primary block truncate">{f.studentName}</span>
                            <span className="text-xs text-k-text-quaternary block">
                                Respondeu {f.templateTitle} {timeAgo(f.submittedAt)}
                            </span>
                            <span className="text-[10px] text-k-text-quaternary">Avaliação</span>
                        </div>
                    </div>
                    <Link
                        href="/forms"
                        className="text-xs px-3 py-1.5 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 rounded-lg font-medium transition-colors flex-shrink-0"
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
            render: () => (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                    s.daysSinceLastSession > 7
                        ? 'bg-red-500/5 border-red-500/15'
                        : 'bg-amber-500/5 border-amber-500/15'
                }`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <ActionAvatar name={s.name} avatarUrl={s.avatarUrl} />
                        <div className="min-w-0">
                            <span className="text-sm text-k-text-primary block truncate">{s.name}</span>
                            <span className="text-xs text-k-text-quaternary block">
                                {s.daysSinceLastSession >= 999 ? 'Ainda não treinou' : `Sem treinar há ${s.daysSinceLastSession} dias`}
                            </span>
                            <span className="text-[10px] text-k-text-quaternary">Aluno</span>
                        </div>
                    </div>
                    <Link
                        href={`/students/${s.id}`}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                            s.daysSinceLastSession > 7
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        }`}
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
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-k-text-primary">Ações pendentes</span>
                <span className="text-[10px] text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded">
                    {totalPending}
                </span>
            </div>
            <div className="space-y-1.5">
                {visibleItems.map(item => (
                    <div key={item.key}>{item.render()}</div>
                ))}
                {hasMore && (
                    <p className="text-xs text-k-text-quaternary hover:text-k-text-secondary transition-colors pl-3 pt-1 cursor-default">
                        e mais {items.length - 5} pendência{items.length - 5 > 1 ? 's' : ''}
                    </p>
                )}
            </div>
        </div>
    )
}
