'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Sparkles, X, AlertTriangle, TrendingUp, Lightbulb, BarChart3,
    Check, MessageCircle, BarChart2, Eye, CreditCard, FileText,
    FolderArchive,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markInsightRead, dismissInsight } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'
import type { PendingFinancialItem, PendingFormItem, ExpiredPlanItem } from '@/lib/dashboard/get-dashboard-data'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

// ── Category config ──

const CATEGORY_CONFIG: Record<string, { label: string; dotColor: string; textColor: string; borderColor: string; bgColor: string; Icon: typeof AlertTriangle }> = {
    alert:       { label: 'Alerta',     dotColor: 'bg-red-500',    textColor: 'text-red-600 dark:text-red-400',       borderColor: 'border-l-red-500',    bgColor: 'bg-red-50 dark:bg-red-500/5',       Icon: AlertTriangle },
    progression: { label: 'Progressão', dotColor: 'bg-teal-500',   textColor: 'text-teal-600 dark:text-teal-400',     borderColor: 'border-l-teal-500',   bgColor: 'bg-teal-50 dark:bg-teal-500/5',     Icon: TrendingUp },
    suggestion:  { label: 'Sugestão',   dotColor: 'bg-violet-500', textColor: 'text-violet-600 dark:text-violet-400', borderColor: 'border-l-violet-500', bgColor: 'bg-violet-50 dark:bg-violet-500/5', Icon: Lightbulb },
    summary:     { label: 'Resumo',     dotColor: 'bg-blue-500',   textColor: 'text-blue-600 dark:text-blue-400',     borderColor: 'border-l-blue-500',   bgColor: 'bg-blue-50 dark:bg-blue-500/5',     Icon: BarChart3 },
    financial:   { label: 'Financeiro', dotColor: 'bg-amber-500',  textColor: 'text-amber-600 dark:text-amber-400',   borderColor: 'border-l-amber-500',  bgColor: 'bg-amber-50 dark:bg-amber-500/5',   Icon: CreditCard },
    form:        { label: 'Avaliação',  dotColor: 'bg-blue-500',   textColor: 'text-blue-600 dark:text-blue-400',     borderColor: 'border-l-blue-500',   bgColor: 'bg-blue-50 dark:bg-blue-500/5',     Icon: FileText },
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

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
    if (avatarUrl) {
        return <Image src={avatarUrl} alt={name} width={28} height={28} className="w-7 h-7 rounded-full object-cover flex-shrink-0" unoptimized />
    }
    return (
        <div className="w-7 h-7 rounded-full border border-border bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
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
    priority: number // 0=critical, 1=high, 2=medium, 3=low
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
    initialInsights,
    pendingFinancial,
    pendingForms,
    expiredPlans,
    trainerId,
    onMarkAsPaid,
    onSellPlan,
    onArchiveStudent,
}: AssistantActionCardsProps) {
    const [insights, setInsights] = useState<InsightItem[]>(initialInsights)
    const [markingPaid, setMarkingPaid] = useState<string | null>(null)
    const openChat = useAssistantChatStore(s => s.openChat)
    const MAX_VISIBLE = 6

    const PRIORITY_MAP: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

    // Build unified card list
    const cards: UnifiedCard[] = []

    // Insight cards
    for (const insight of insights) {
        cards.push({
            id: `insight-${insight.id}`,
            type: 'insight',
            category: insight.category,
            priority: PRIORITY_MAP[insight.priority] ?? 2,
            studentName: insight.student_name || 'Aluno',
            studentId: insight.student_id,
            title: insight.title,
            body: insight.body,
            timestamp: insight.created_at,
            insight,
        })
    }

    // Financial cards
    for (const fin of pendingFinancial) {
        const isPastDue = fin.currentPeriodEnd && new Date(fin.currentPeriodEnd) < new Date()
        cards.push({
            id: `fin-${fin.id}`,
            type: 'financial',
            category: 'financial',
            priority: isPastDue ? 1 : 2,
            studentName: fin.studentName,
            studentId: fin.studentId,
            avatarUrl: fin.studentAvatar,
            title: `${fin.studentName} — ${formatCurrency(fin.amount)} ${isPastDue ? 'vencido' : 'pendente'}`,
            body: fin.currentPeriodEnd ? `${isPastDue ? 'Venceu' : 'Vence'} em ${new Date(fin.currentPeriodEnd).toLocaleDateString('pt-BR')}` : 'Pagamento pendente',
            timestamp: fin.currentPeriodEnd || new Date().toISOString(),
            financialItem: fin,
        })
    }

    // Form cards
    for (const form of pendingForms) {
        cards.push({
            id: `form-${form.id}`,
            type: 'form',
            category: 'form',
            priority: 2,
            studentName: form.studentName,
            avatarUrl: form.studentAvatar,
            title: `${form.studentName} respondeu ${form.templateTitle}`,
            body: 'Avaliação pendente de revisão',
            timestamp: form.submittedAt,
            formItem: form,
        })
    }

    // Expired plan cards
    for (const ep of expiredPlans) {
        cards.push({
            id: `expired-${ep.studentId}`,
            type: 'expired_plan',
            category: 'financial',
            priority: 2,
            studentName: ep.studentName,
            studentId: ep.studentId,
            avatarUrl: ep.studentAvatar,
            title: `Plano de ${ep.studentName} expirou`,
            body: ep.planTitle ? `${ep.planTitle} — expirou em ${new Date(ep.expiredAt).toLocaleDateString('pt-BR')}` : `Expirou em ${new Date(ep.expiredAt).toLocaleDateString('pt-BR')}`,
            timestamp: ep.expiredAt,
            expiredPlanItem: ep,
        })
    }

    // Sort by priority, then timestamp
    cards.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const visibleCards = cards.slice(0, MAX_VISIBLE)
    const hasMore = cards.length > MAX_VISIBLE
    const newInsightCount = insights.filter(i => i.status === 'new').length

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
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-foreground">Assistente Kinevo</h2>
                </div>
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
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-foreground">Assistente Kinevo</h2>
                    {cards.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-violet-500 text-white leading-none">
                            {cards.length} {cards.length === 1 ? 'ação' : 'ações'}
                        </span>
                    )}
                </div>
                {hasMore && (
                    <span className="text-xs text-muted-foreground">+{cards.length - MAX_VISIBLE} mais</span>
                )}
            </div>

            {/* Cards */}
            <div className="space-y-2">
                {visibleCards.map(card => {
                    const config = CATEGORY_CONFIG[card.category] || CATEGORY_CONFIG.summary
                    const CategoryIcon = config.Icon

                    return (
                        <div key={card.id} className="group">
                            <div className={`relative border border-l-[3px] rounded-r-xl ${config.borderColor} bg-card border-border/50 hover:bg-muted/20 transition-colors`}>
                                {/* Main content row */}
                                <div className="flex gap-3 p-3 pb-2">
                                    {/* Avatar */}
                                    <Avatar name={card.studentName} avatarUrl={card.avatarUrl} />

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[10px] font-semibold tracking-wide ${config.textColor}`}>{config.label}</span>
                                            <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>{timeAgo(card.timestamp)}</span>
                                            {card.type === 'insight' && card.insight?.status === 'new' && (
                                                <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-foreground leading-snug">{card.title}</p>

                                        {/* Assistant analysis block */}
                                        {card.type === 'insight' && (
                                            <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg ${config.bgColor} flex items-start gap-1.5`}>
                                                <Sparkles className="w-3 h-3 text-violet-500 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{card.body}</p>
                                            </div>
                                        )}
                                        {card.type !== 'insight' && (
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed" suppressHydrationWarning>{card.body}</p>
                                        )}
                                    </div>

                                    {/* Dismiss (insights only) */}
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
                                <div className="px-3 pb-2.5 pt-0.5 flex flex-wrap gap-1.5 ml-10">
                                    {renderActions(card, {
                                        onInsightAction: handleInsightAction,
                                        onMarkAsPaid: handleMarkAsPaid,
                                        onSellPlan,
                                        onArchiveStudent,
                                        markingPaid,
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
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

function renderActions(card: UnifiedCard, handlers: ActionHandlers) {
    const buttons: React.ReactNode[] = []

    if (card.type === 'insight' && card.insight) {
        const insight = card.insight

        // Primary: talk to assistant
        buttons.push(
            <ActionButton key="chat" primary onClick={() => handlers.onInsightAction(insight)}>
                <MessageCircle className="w-3 h-3" /> Falar com assistente
            </ActionButton>
        )

        // Context-specific secondary
        if (insight.insight_key?.startsWith('stagnation') || insight.insight_key?.startsWith('ready_to_progress')) {
            buttons.push(
                <ActionButton key="analyze" onClick={() => handlers.onInsightAction(insight, 'Analise a tendência de progressão deste aluno')}>
                    <BarChart2 className="w-3 h-3" /> Analisar progresso
                </ActionButton>
            )
        }
        if (insight.insight_key?.startsWith('program_expiring')) {
            buttons.push(
                <ActionButton key="generate" onClick={() => handlers.onInsightAction(insight, 'Gere um novo programa para este aluno')}>
                    <Sparkles className="w-3 h-3" /> Gerar programa
                </ActionButton>
            )
        }

        // View profile
        if (insight.student_id) {
            buttons.push(
                <Link key="profile" href={`/students/${insight.student_id}`}>
                    <ActionButton as="span"><Eye className="w-3 h-3" /> Ver perfil</ActionButton>
                </Link>
            )
        }
    }

    if (card.type === 'financial' && card.financialItem) {
        const fin = card.financialItem
        const isManual = fin.billingType === 'manual_recurring' || fin.billingType === 'manual_one_off'
        if (isManual) {
            buttons.push(
                <ActionButton key="paid" primary onClick={() => handlers.onMarkAsPaid(fin.id)} disabled={handlers.markingPaid === fin.id}>
                    {handlers.markingPaid === fin.id ? 'Processando...' : <><Check className="w-3 h-3" /> Marcar pago</>}
                </ActionButton>
            )
        }
        if (card.studentId) {
            buttons.push(
                <Link key="profile" href={`/students/${card.studentId}`}>
                    <ActionButton as="span"><Eye className="w-3 h-3" /> Ver perfil</ActionButton>
                </Link>
            )
        }
    }

    if (card.type === 'form' && card.formItem) {
        buttons.push(
            <Link key="review" href="/forms">
                <ActionButton as="span" primary><FileText className="w-3 h-3" /> Revisar</ActionButton>
            </Link>
        )
    }

    if (card.type === 'expired_plan' && card.expiredPlanItem) {
        if (handlers.onSellPlan && card.studentId) {
            buttons.push(
                <ActionButton key="sell" primary onClick={() => handlers.onSellPlan!(card.studentId!)}>
                    <CreditCard className="w-3 h-3" /> Vender plano
                </ActionButton>
            )
        }
        if (handlers.onArchiveStudent && card.studentId) {
            buttons.push(
                <ActionButton key="archive" onClick={() => handlers.onArchiveStudent!(card.studentId!, card.studentName)}>
                    <FolderArchive className="w-3 h-3" /> Arquivar
                </ActionButton>
            )
        }
    }

    return buttons
}

// ── Reusable action button ──

function ActionButton({
    children, primary, onClick, disabled, as: Tag = 'button',
}: {
    children: React.ReactNode
    primary?: boolean
    onClick?: () => void
    disabled?: boolean
    as?: 'button' | 'span'
}) {
    const className = primary
        ? 'inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors disabled:opacity-50'
        : 'inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full bg-transparent text-muted-foreground border border-border hover:bg-muted transition-colors disabled:opacity-50'

    if (Tag === 'span') return <span className={className}>{children}</span>
    return <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
}
