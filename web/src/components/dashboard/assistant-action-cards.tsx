'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Sparkles, X, AlertTriangle, TrendingUp, Lightbulb, BarChart3,
    Check, MessageSquare, BarChart2, User, CreditCard, FileText,
    FolderArchive, Layers,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markInsightRead, dismissInsight } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'
import type { PendingFinancialItem, PendingFormItem, ExpiredPlanItem } from '@/lib/dashboard/get-dashboard-data'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

// ── Category config ──

const CATEGORY_CONFIG: Record<string, {
    label: string
    badgeBg: string
    badgeText: string
    borderColor: string
    avatarBg: string
    avatarText: string
    Icon: typeof AlertTriangle
}> = {
    alert:       { label: 'Alerta',     badgeBg: 'bg-red-50 dark:bg-red-500/10',    badgeText: 'text-red-700 dark:text-red-400',       borderColor: 'border-l-red-500',    avatarBg: 'bg-red-50 dark:bg-red-500/10',    avatarText: 'text-red-700 dark:text-red-400',    Icon: AlertTriangle },
    progression: { label: 'Progressão', badgeBg: 'bg-teal-50 dark:bg-teal-500/10',  badgeText: 'text-teal-700 dark:text-teal-400',     borderColor: 'border-l-teal-500',   avatarBg: 'bg-teal-50 dark:bg-teal-500/10',  avatarText: 'text-teal-700 dark:text-teal-400',  Icon: TrendingUp },
    suggestion:  { label: 'Sugestão',   badgeBg: 'bg-violet-50 dark:bg-violet-500/10', badgeText: 'text-violet-700 dark:text-violet-400', borderColor: 'border-l-violet-500', avatarBg: 'bg-violet-50 dark:bg-violet-500/10', avatarText: 'text-violet-700 dark:text-violet-400', Icon: Lightbulb },
    summary:     { label: 'Resumo',     badgeBg: 'bg-blue-50 dark:bg-blue-500/10',  badgeText: 'text-blue-700 dark:text-blue-400',     borderColor: 'border-l-blue-500',   avatarBg: 'bg-blue-50 dark:bg-blue-500/10',  avatarText: 'text-blue-700 dark:text-blue-400',  Icon: BarChart3 },
    financial:   { label: 'Financeiro', badgeBg: 'bg-amber-50 dark:bg-amber-500/10', badgeText: 'text-amber-700 dark:text-amber-400',   borderColor: 'border-l-amber-500',  avatarBg: 'bg-amber-50 dark:bg-amber-500/10', avatarText: 'text-amber-700 dark:text-amber-400', Icon: CreditCard },
    form:        { label: 'Avaliação',  badgeBg: 'bg-blue-50 dark:bg-blue-500/10',  badgeText: 'text-blue-700 dark:text-blue-400',     borderColor: 'border-l-blue-500',   avatarBg: 'bg-blue-50 dark:bg-blue-500/10',  avatarText: 'text-blue-700 dark:text-blue-400',  Icon: FileText },
}

// ── Helpers ──

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'agora'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `há ${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `há ${hours}h`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'ontem'
    if (days < 7) return `há ${days}d`
    return `há ${Math.floor(days / 7)} sem.`
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text
    return text.slice(0, max).trimEnd() + '...'
}

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

function Avatar({ name, avatarUrl, category }: { name: string; avatarUrl?: string | null; category: string }) {
    if (avatarUrl) {
        return <Image src={avatarUrl} alt={name} width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0" unoptimized />
    }
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.summary
    return (
        <div className={`w-8 h-8 rounded-full ${config.avatarBg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-xs font-bold ${config.avatarText}`}>{name.charAt(0).toUpperCase()}</span>
        </div>
    )
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// ── Unified card type ──

interface UnifiedCard {
    id: string
    type: 'insight' | 'financial' | 'form' | 'expired_plan'
    category: string
    priority: number
    priorityLabel: string
    studentName: string
    studentId?: string | null
    avatarUrl?: string | null
    title: string
    body: string
    timestamp: string
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
    const MAX_VISIBLE = 6
    const PRIORITY_MAP: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

    // Build unified card list
    const cards: UnifiedCard[] = []

    for (const insight of insights) {
        const p = insight.priority
        const isUrgent = p === 'critical' || p === 'high'
        cards.push({
            id: `insight-${insight.id}`,
            type: 'insight',
            category: insight.category,
            priority: PRIORITY_MAP[p] ?? 2,
            priorityLabel: isUrgent ? 'Urgente' : CATEGORY_CONFIG[insight.category]?.label || 'Insight',
            studentName: insight.student_name || 'Aluno',
            studentId: insight.student_id,
            title: insight.title,
            body: insight.body,
            timestamp: insight.created_at,
            insight,
        })
    }

    for (const fin of pendingFinancial) {
        const isPastDue = fin.currentPeriodEnd && new Date(fin.currentPeriodEnd) < new Date()
        cards.push({
            id: `fin-${fin.id}`, type: 'financial', category: 'financial',
            priority: isPastDue ? 1 : 2, priorityLabel: 'Financeiro',
            studentName: fin.studentName, studentId: fin.studentId, avatarUrl: fin.studentAvatar,
            title: `${fin.studentName} — ${formatCurrency(fin.amount)} ${isPastDue ? 'vencido' : 'pendente'}`,
            body: fin.currentPeriodEnd ? `${isPastDue ? 'Venceu' : 'Vence'} em ${new Date(fin.currentPeriodEnd).toLocaleDateString('pt-BR')}` : 'Pagamento pendente',
            timestamp: fin.currentPeriodEnd || new Date().toISOString(),
            financialItem: fin,
        })
    }

    for (const form of pendingForms) {
        cards.push({
            id: `form-${form.id}`, type: 'form', category: 'form',
            priority: 2, priorityLabel: 'Avaliação',
            studentName: form.studentName, avatarUrl: form.studentAvatar,
            title: `${form.studentName} respondeu ${form.templateTitle}`,
            body: 'Avaliação pendente de revisão',
            timestamp: form.submittedAt, formItem: form,
        })
    }

    for (const ep of expiredPlans) {
        cards.push({
            id: `expired-${ep.studentId}`, type: 'expired_plan', category: 'financial',
            priority: 2, priorityLabel: 'Financeiro',
            studentName: ep.studentName, studentId: ep.studentId, avatarUrl: ep.studentAvatar,
            title: `Plano de ${ep.studentName} expirou`,
            body: ep.planTitle ? `${ep.planTitle} — expirou em ${new Date(ep.expiredAt).toLocaleDateString('pt-BR')}` : `Expirou em ${new Date(ep.expiredAt).toLocaleDateString('pt-BR')}`,
            timestamp: ep.expiredAt, expiredPlanItem: ep,
        })
    }

    cards.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const visibleCards = cards.slice(0, MAX_VISIBLE)
    const hasMore = cards.length > MAX_VISIBLE

    // ── Handlers ──

    const handleInsightAction = useCallback((insight: InsightItem, chipMessage?: string) => {
        if (insight.status === 'new') {
            setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, status: 'read' as const } : i))
            markInsightRead(insight.id)
        }
        openChat({
            studentId: insight.student_id || undefined,
            studentName: insight.student_name || undefined,
            insightId: insight.insight_key || undefined,
            initialMessage: chipMessage || buildInitialMessage(insight),
        })
    }, [openChat])

    const handleDismiss = useCallback(async (e: React.MouseEvent, insightId: string) => {
        e.stopPropagation()
        setInsights(prev => prev.filter(i => i.id !== insightId))
        await dismissInsight(insightId)
    }, [])

    const handleMarkAsPaid = useCallback(async (contractId: string) => {
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

    // ── Empty state ──

    if (cards.length === 0) {
        return (
            <section className="mb-6">
                <SectionHeader count={0} hasMore={false} extra={0} />
                <div className="flex items-center gap-3 py-6 px-4 rounded-xl border border-border bg-card">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Tudo em dia com seus alunos</p>
                </div>
            </section>
        )
    }

    // ── Render ──

    return (
        <section className="mb-6">
            <SectionHeader count={cards.length} hasMore={hasMore} extra={cards.length - MAX_VISIBLE} />

            <div className="space-y-2">
                {visibleCards.map(card => {
                    const config = CATEGORY_CONFIG[card.category] || CATEGORY_CONFIG.summary
                    const isUrgent = card.priority <= 1
                    const badgeLabel = isUrgent && card.type === 'insight' ? 'Urgente' : card.priorityLabel

                    return (
                        <div key={card.id} className="group">
                            <div className={`relative border border-l-[3px] rounded-r-xl ${config.borderColor} bg-card ${isUrgent ? 'border-red-200/60 dark:border-red-500/20' : 'border-border/50'} hover:bg-muted/20 transition-colors`}>
                                <div className="flex gap-3 p-3 pb-2">
                                    {/* Avatar */}
                                    <Avatar name={card.studentName} avatarUrl={card.avatarUrl} category={card.category} />

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Badge + time */}
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[10px] font-semibold px-2.5 py-[2px] rounded-[10px] ${isUrgent && card.type === 'insight' ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' : `${config.badgeBg} ${config.badgeText}`}`}>
                                                {badgeLabel}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>{timeAgo(card.timestamp)}</span>
                                            {card.type === 'insight' && card.insight?.status === 'new' && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                            )}
                                        </div>

                                        {/* Title */}
                                        <p className="text-sm font-medium text-foreground leading-snug">{card.title}</p>

                                        {/* Assistant analysis — inline, no background */}
                                        {card.type === 'insight' && (
                                            <div className="mt-1 flex items-start gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-muted-foreground leading-relaxed">{truncate(card.body, 120)}</p>
                                            </div>
                                        )}
                                        {card.type !== 'insight' && (
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed" suppressHydrationWarning>{card.body}</p>
                                        )}
                                    </div>

                                    {/* Dismiss */}
                                    {card.type === 'insight' && card.insight && (
                                        <button
                                            onClick={(e) => handleDismiss(e, card.insight!.id)}
                                            className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                            title="Dispensar"
                                        >
                                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                                        </button>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="px-3 pb-2.5 pt-0.5 flex flex-wrap gap-1.5 ml-11">
                                    {renderActions(card, { onInsightAction: handleInsightAction, onMarkAsPaid: handleMarkAsPaid, onSellPlan, onArchiveStudent, markingPaid })}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

// ── Section header ──

function SectionHeader({ count, hasMore, extra }: { count: number; hasMore: boolean; extra: number }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-foreground">Assistente Kinevo</h2>
                {count > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-violet-500 text-white leading-none">
                        {count} {count === 1 ? 'ação' : 'ações'}
                    </span>
                )}
            </div>
            {hasMore && <span className="text-xs text-muted-foreground">+{extra} mais</span>}
        </div>
    )
}

// ── Action buttons renderer ──

interface ActionHandlers {
    onInsightAction: (insight: InsightItem, chipMessage?: string) => void
    onMarkAsPaid: (contractId: string) => Promise<void>
    onSellPlan?: (studentId: string) => void
    onArchiveStudent?: (studentId: string, studentName: string) => void
    markingPaid: string | null
}

function renderActions(card: UnifiedCard, h: ActionHandlers) {
    const buttons: React.ReactNode[] = []

    if (card.type === 'insight' && card.insight) {
        const insight = card.insight
        const key = insight.insight_key || ''

        // Primary button varies by action_type
        if (key.startsWith('program_expiring')) {
            buttons.push(<Btn key="gen" primary onClick={() => h.onInsightAction(insight, 'Gere um novo programa para este aluno')}><Layers className="w-3 h-3" /> Gerar programa</Btn>)
        } else if (key.startsWith('stagnation') || key.startsWith('ready_to_progress')) {
            buttons.push(<Btn key="analyze" primary onClick={() => h.onInsightAction(insight, 'Analise a tendência de progressão deste aluno')}><TrendingUp className="w-3 h-3" /> Analisar progresso</Btn>)
        } else if (key.startsWith('pain_report')) {
            buttons.push(<Btn key="review" primary onClick={() => h.onInsightAction(insight)}><FileText className="w-3 h-3" /> Revisar programa</Btn>)
        } else {
            buttons.push(<Btn key="chat" primary onClick={() => h.onInsightAction(insight)}><MessageSquare className="w-3 h-3" /> Falar com assistente</Btn>)
        }

        // Secondary: chat (if primary isn't chat)
        if (!key.startsWith('gap_alert') && !key.startsWith('pain_report')) {
            buttons.push(<Btn key="chat2" onClick={() => h.onInsightAction(insight)}><MessageSquare className="w-3 h-3" /> Assistente</Btn>)
        }

        // Profile link
        if (insight.student_id) {
            buttons.push(<Link key="profile" href={`/students/${insight.student_id}`}><Btn as="span"><User className="w-3 h-3" /> Perfil</Btn></Link>)
        }
    }

    if (card.type === 'financial' && card.financialItem) {
        const fin = card.financialItem
        const isManual = fin.billingType === 'manual_recurring' || fin.billingType === 'manual_one_off'
        if (isManual) {
            buttons.push(<Btn key="paid" primary onClick={() => h.onMarkAsPaid(fin.id)} disabled={h.markingPaid === fin.id}>{h.markingPaid === fin.id ? 'Processando...' : <><Check className="w-3 h-3" /> Marcar pago</>}</Btn>)
        }
        if (card.studentId) buttons.push(<Link key="profile" href={`/students/${card.studentId}`}><Btn as="span"><User className="w-3 h-3" /> Perfil</Btn></Link>)
    }

    if (card.type === 'form') {
        buttons.push(<Link key="review" href="/forms"><Btn as="span" primary><FileText className="w-3 h-3" /> Revisar</Btn></Link>)
    }

    if (card.type === 'expired_plan') {
        if (h.onSellPlan && card.studentId) buttons.push(<Btn key="sell" primary onClick={() => h.onSellPlan!(card.studentId!)}><CreditCard className="w-3 h-3" /> Vender plano</Btn>)
        if (h.onArchiveStudent && card.studentId) buttons.push(<Btn key="archive" onClick={() => h.onArchiveStudent!(card.studentId!, card.studentName)}><FolderArchive className="w-3 h-3" /> Arquivar</Btn>)
    }

    return buttons
}

// ── Reusable button ──

function Btn({ children, primary, onClick, disabled, as: Tag = 'button' }: {
    children: React.ReactNode; primary?: boolean; onClick?: () => void; disabled?: boolean; as?: 'button' | 'span'
}) {
    const cn = primary
        ? 'inline-flex items-center gap-1 px-3 py-[5px] text-[11px] font-medium rounded-[14px] bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors disabled:opacity-50'
        : 'inline-flex items-center gap-1 px-3 py-[5px] text-[11px] font-medium rounded-[14px] bg-transparent text-muted-foreground border border-border hover:bg-muted transition-colors disabled:opacity-50'

    if (Tag === 'span') return <span className={cn}>{children}</span>
    return <button onClick={onClick} disabled={disabled} className={cn}>{children}</button>
}
