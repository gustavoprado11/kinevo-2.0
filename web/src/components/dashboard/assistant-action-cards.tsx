'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Sparkles, X, AlertTriangle, TrendingUp, Lightbulb, BarChart3,
    Check, CreditCard, FileText, FolderArchive, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markInsightRead, dismissInsight } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'
import type { PendingFinancialItem, PendingFormItem, ExpiredPlanItem } from '@/lib/dashboard/get-dashboard-data'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

// ── Category config ──

const CAT: Record<string, { label: string; avatarBg: string; avatarText: string; badgeBg: string; badgeText: string }> = {
    alert:       { label: 'Alerta',     avatarBg: 'bg-red-50 dark:bg-red-500/10',       avatarText: 'text-red-600 dark:text-red-400',       badgeBg: 'bg-red-50 dark:bg-red-500/10',       badgeText: 'text-red-700 dark:text-red-400' },
    progression: { label: 'Progressão', avatarBg: 'bg-teal-50 dark:bg-teal-500/10',     avatarText: 'text-teal-600 dark:text-teal-400',     badgeBg: 'bg-teal-50 dark:bg-teal-500/10',     badgeText: 'text-teal-700 dark:text-teal-400' },
    suggestion:  { label: 'Sugestão',   avatarBg: 'bg-violet-50 dark:bg-violet-500/10', avatarText: 'text-violet-600 dark:text-violet-400', badgeBg: 'bg-violet-50 dark:bg-violet-500/10', badgeText: 'text-violet-700 dark:text-violet-400' },
    summary:     { label: 'Resumo',     avatarBg: 'bg-blue-50 dark:bg-blue-500/10',     avatarText: 'text-blue-600 dark:text-blue-400',     badgeBg: 'bg-blue-50 dark:bg-blue-500/10',     badgeText: 'text-blue-700 dark:text-blue-400' },
    financial:   { label: 'Financeiro', avatarBg: 'bg-amber-50 dark:bg-amber-500/10',   avatarText: 'text-amber-600 dark:text-amber-400',   badgeBg: 'bg-amber-50 dark:bg-amber-500/10',   badgeText: 'text-amber-700 dark:text-amber-400' },
    form:        { label: 'Avaliação',  avatarBg: 'bg-blue-50 dark:bg-blue-500/10',     avatarText: 'text-blue-600 dark:text-blue-400',     badgeBg: 'bg-blue-50 dark:bg-blue-500/10',     badgeText: 'text-blue-700 dark:text-blue-400' },
}

// ── Helpers ──

function buildInitialMessage(insight: InsightItem): string {
    const name = insight.student_name || 'o aluno'
    const meta = insight.action_metadata || {}
    if (insight.insight_key?.startsWith('gap_alert')) {
        const days = meta.days_since_last
        if (!days || days >= 365) return `Vi que ${name} ainda não realizou nenhum treino. Como posso ajudar?`
        return `Vi que ${name} está sem treinar há ${days} dias. Como posso ajudar?`
    }
    if (insight.insight_key?.startsWith('stagnation')) return `Identifiquei que ${name} está estagnado em ${meta.exercise_name || 'um exercício'}. Quer analisar?`
    if (insight.insight_key?.startsWith('ready_to_progress')) return `${name} está pronto para progredir em ${meta.exercise_name || 'um exercício'}. Quer analisar?`
    if (insight.insight_key?.startsWith('program_expiring')) return `O programa de ${name} está encerrando. Quer que eu analise o progresso para sugerir o próximo?`
    if (insight.insight_key?.startsWith('pain_report')) return `${name} reportou desconforto no último check-in. Quer revisar os detalhes?`
    return `Insight sobre ${name}: ${insight.title}. Como posso ajudar?`
}

function getActionLabel(insight: InsightItem): string {
    const key = insight.insight_key || ''
    if (key.startsWith('program_expiring')) return 'Gerar programa'
    if (key.startsWith('stagnation') || key.startsWith('ready_to_progress')) return 'Analisar'
    if (key.startsWith('pain_report')) return 'Revisar'
    return 'Assistente'
}

function getActionChip(insight: InsightItem): string | undefined {
    const key = insight.insight_key || ''
    if (key.startsWith('program_expiring')) return 'Gere um novo programa para este aluno'
    if (key.startsWith('stagnation') || key.startsWith('ready_to_progress')) return 'Analise a tendência de progressão deste aluno'
    return undefined
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// ── Unified row type ──

interface UnifiedRow {
    id: string
    type: 'insight' | 'financial' | 'form' | 'expired_plan'
    category: string
    priority: number
    studentName: string
    studentId?: string | null
    avatarUrl?: string | null
    title: string
    subtitle: string
    isNew: boolean
    insight?: InsightItem
    financialItem?: PendingFinancialItem
    formItem?: PendingFormItem
    expiredPlanItem?: ExpiredPlanItem
}

// ── Props ──

interface AssistantActionCardsProps {
    initialInsights: InsightItem[]
    pendingFinancial: PendingFinancialItem[]
    pendingForms: PendingFormItem[]
    expiredPlans: ExpiredPlanItem[]
    trainerId: string
    onMarkAsPaid: (contractId: string) => Promise<void>
    onSellPlan?: (studentId: string) => void
    onArchiveStudent?: (studentId: string, studentName: string) => void
}

// ── Component ──

export function AssistantActionCards({
    initialInsights, pendingFinancial, pendingForms, expiredPlans,
    trainerId, onMarkAsPaid, onSellPlan, onArchiveStudent,
}: AssistantActionCardsProps) {
    const [insights, setInsights] = useState<InsightItem[]>(initialInsights)
    const [markingPaid, setMarkingPaid] = useState<string | null>(null)
    const openChat = useAssistantChatStore(s => s.openChat)
    const P: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

    // Build rows
    const rows: UnifiedRow[] = []

    for (const i of insights) {
        const isUrgent = i.priority === 'critical' || i.priority === 'high'
        rows.push({
            id: `i-${i.id}`, type: 'insight', category: i.category, priority: P[i.priority] ?? 2,
            studentName: i.student_name || 'Aluno', studentId: i.student_id, isNew: i.status === 'new',
            title: i.title,
            subtitle: i.body.length > 90 ? i.body.slice(0, 90).trimEnd() + '...' : i.body,
            insight: i,
        })
    }

    for (const fin of pendingFinancial) {
        const isPastDue = fin.currentPeriodEnd && new Date(fin.currentPeriodEnd) < new Date()
        rows.push({
            id: `f-${fin.id}`, type: 'financial', category: 'financial', priority: isPastDue ? 1 : 2,
            studentName: fin.studentName, studentId: fin.studentId, avatarUrl: fin.studentAvatar, isNew: false,
            title: `${formatCurrency(fin.amount)} ${isPastDue ? 'vencido' : 'pendente'}`,
            subtitle: fin.currentPeriodEnd ? `${isPastDue ? 'Venceu' : 'Vence'} em ${new Date(fin.currentPeriodEnd).toLocaleDateString('pt-BR')}` : '',
            financialItem: fin,
        })
    }

    for (const form of pendingForms) {
        rows.push({
            id: `fm-${form.id}`, type: 'form', category: 'form', priority: 2,
            studentName: form.studentName, avatarUrl: form.studentAvatar, isNew: false,
            title: `Respondeu ${form.templateTitle}`,
            subtitle: 'Pendente de revisão',
            formItem: form,
        })
    }

    for (const ep of expiredPlans) {
        rows.push({
            id: `ep-${ep.studentId}`, type: 'expired_plan', category: 'financial', priority: 2,
            studentName: ep.studentName, studentId: ep.studentId, avatarUrl: ep.studentAvatar, isNew: false,
            title: 'Plano expirou',
            subtitle: ep.planTitle || '',
            expiredPlanItem: ep,
        })
    }

    rows.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : 0)

    // ── Handlers ──

    const handleRowClick = useCallback((row: UnifiedRow) => {
        if (row.type === 'insight' && row.insight) {
            if (row.insight.status === 'new') {
                setInsights(prev => prev.map(i => i.id === row.insight!.id ? { ...i, status: 'read' as const } : i))
                markInsightRead(row.insight.id)
            }
            openChat({
                studentId: row.insight.student_id || undefined,
                studentName: row.insight.student_name || undefined,
                insightId: row.insight.insight_key || undefined,
                initialMessage: buildInitialMessage(row.insight),
            })
        } else if (row.studentId) {
            window.location.href = `/students/${row.studentId}`
        }
    }, [openChat])

    const handleInsightAction = useCallback((e: React.MouseEvent, insight: InsightItem) => {
        e.stopPropagation()
        if (insight.status === 'new') {
            setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, status: 'read' as const } : i))
            markInsightRead(insight.id)
        }
        openChat({
            studentId: insight.student_id || undefined,
            studentName: insight.student_name || undefined,
            insightId: insight.insight_key || undefined,
            initialMessage: getActionChip(insight) || buildInitialMessage(insight),
        })
    }, [openChat])

    const handleDismiss = useCallback(async (e: React.MouseEvent, insightId: string) => {
        e.stopPropagation()
        setInsights(prev => prev.filter(i => i.id !== insightId))
        await dismissInsight(insightId)
    }, [])

    const handleMarkAsPaid = useCallback(async (e: React.MouseEvent, contractId: string) => {
        e.stopPropagation()
        setMarkingPaid(contractId)
        await onMarkAsPaid(contractId)
        setMarkingPaid(null)
    }, [onMarkAsPaid])

    // ── Realtime ──

    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel(`assistant_insights_${trainerId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assistant_insights', filter: `trainer_id=eq.${trainerId}` },
                (payload) => {
                    const n = payload.new as any
                    setInsights(prev => {
                        if (prev.some(i => i.id === n.id)) return prev
                        return [{ ...n, student_name: null, action_metadata: n.action_metadata || {} } as InsightItem, ...prev]
                    })
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [trainerId])

    // ── Render ──

    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            {/* Header — matches DailyActivityFeed pattern */}
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Assistente Kinevo</h2>
                    {rows.length > 0 && (
                        <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded">
                            {rows.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Rows */}
            {rows.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                        <Check className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                    </div>
                    <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary">Tudo em dia com seus alunos</p>
                    <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-1">Insights e ações aparecerão aqui</p>
                </div>
            ) : (
                <div className="divide-y divide-[#E8E8ED] dark:divide-border max-h-[320px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {rows.map(row => {
                        const cat = CAT[row.category] || CAT.summary

                        return (
                            <div
                                key={row.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleRowClick(row)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(row) }}
                                className="group flex w-full items-center justify-between px-5 py-4 text-left transition-all hover:bg-[#F5F5F7] dark:hover:bg-muted/50 cursor-pointer"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Avatar */}
                                    {row.avatarUrl ? (
                                        <Image src={row.avatarUrl} alt={row.studentName} width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" unoptimized />
                                    ) : (
                                        <div className={`h-10 w-10 shrink-0 rounded-full ${cat.avatarBg} flex items-center justify-center`}>
                                            <span className={`text-sm font-bold ${cat.avatarText}`}>
                                                {row.studentName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}

                                    <div className="min-w-0">
                                        {/* Line 1: Name + badge */}
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground truncate">
                                                {row.studentName}
                                            </span>
                                            <span className={`text-[9px] font-semibold px-2 py-[1px] rounded-full shrink-0 ${cat.badgeBg} ${cat.badgeText}`}>
                                                {cat.label}
                                            </span>
                                            {row.isNew && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                            )}
                                        </div>

                                        {/* Line 2: Insight text */}
                                        <p className="text-[13px] text-[#6E6E73] dark:text-muted-foreground truncate max-w-md">
                                            {row.title}
                                        </p>

                                        {/* Line 3: Subtitle / body */}
                                        {row.subtitle && (
                                            <p className="text-[11px] text-[#AEAEB2] dark:text-muted-foreground/60 line-clamp-2 max-w-md mt-0.5" suppressHydrationWarning>
                                                {row.subtitle}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right side action */}
                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                    {row.type === 'insight' && row.insight && (
                                        <>
                                            <button
                                                onClick={(e) => handleDismiss(e, row.insight!.id)}
                                                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Dispensar"
                                            >
                                                <X className="w-3.5 h-3.5 text-[#AEAEB2] dark:text-muted-foreground/50" />
                                            </button>
                                            <button
                                                onClick={(e) => handleInsightAction(e, row.insight!)}
                                                className="text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 flex items-center gap-1 transition-colors"
                                            >
                                                {getActionLabel(row.insight!)} <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}

                                    {row.type === 'financial' && row.financialItem && (() => {
                                        const fin = row.financialItem!
                                        const isManual = fin.billingType === 'manual_recurring' || fin.billingType === 'manual_one_off'
                                        if (!isManual) return null
                                        return (
                                            <button
                                                onClick={(e) => handleMarkAsPaid(e, fin.id)}
                                                disabled={markingPaid === fin.id}
                                                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1 transition-colors disabled:opacity-50"
                                            >
                                                {markingPaid === fin.id ? '...' : <><Check className="w-3 h-3" /> Pago</>}
                                            </button>
                                        )
                                    })()}

                                    {row.type === 'form' && (
                                        <Link href="/forms" onClick={e => e.stopPropagation()} className="text-[11px] font-medium text-[#007AFF] dark:text-primary hover:opacity-80 flex items-center gap-1 transition-colors">
                                            Revisar <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    )}

                                    {row.type === 'expired_plan' && row.expiredPlanItem && (
                                        <div className="flex items-center gap-2">
                                            {onSellPlan && row.studentId && (
                                                <button onClick={(e) => { e.stopPropagation(); onSellPlan(row.studentId!) }} className="text-[11px] font-medium text-[#007AFF] dark:text-primary hover:opacity-80 transition-colors">
                                                    Vender plano
                                                </button>
                                            )}
                                            {onArchiveStudent && row.studentId && (
                                                <button onClick={(e) => { e.stopPropagation(); onArchiveStudent(row.studentId!, row.studentName) }} className="text-[11px] font-medium text-[#AEAEB2] dark:text-muted-foreground hover:text-red-500 transition-colors">
                                                    <FolderArchive className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
