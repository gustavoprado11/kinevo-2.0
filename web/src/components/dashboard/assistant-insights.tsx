'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, X, AlertTriangle, TrendingUp, Lightbulb, BarChart3, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markInsightRead, dismissInsight } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

// ── Styling maps ──

const CATEGORY_CONFIG: Record<string, { label: string; dotColor: string; textColor: string; borderColor: string; Icon: typeof AlertTriangle }> = {
    alert: { label: 'Alerta', dotColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', borderColor: 'border-l-red-500', Icon: AlertTriangle },
    progression: { label: 'Progressão', dotColor: 'bg-teal-500', textColor: 'text-teal-600 dark:text-teal-400', borderColor: 'border-l-teal-500', Icon: TrendingUp },
    suggestion: { label: 'Sugestão', dotColor: 'bg-violet-500', textColor: 'text-violet-600 dark:text-violet-400', borderColor: 'border-l-violet-500', Icon: Lightbulb },
    summary: { label: 'Resumo', dotColor: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-l-blue-500', Icon: BarChart3 },
}


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

interface AssistantInsightsProps {
    initialInsights: InsightItem[]
    trainerId: string
}

function buildInitialMessage(insight: InsightItem): string {
    const name = insight.student_name || 'o aluno'
    const meta = insight.action_metadata || {}

    if (insight.insight_key?.startsWith('gap_alert')) {
        const days = meta.days_since_last
        if (!days || days >= 365) {
            return `Vi que ${name} ainda não realizou nenhum treino. Como posso ajudar?`
        }
        return `Vi que ${name} está sem treinar há ${days} dias. Como posso ajudar?`
    }
    if (insight.insight_key?.startsWith('stagnation')) {
        return `Identifiquei que ${name} está estagnado em ${meta.exercise_name || 'um exercício'}. Quer analisar?`
    }
    if (insight.insight_key?.startsWith('ready_to_progress')) {
        return `${name} está pronto para progredir em ${meta.exercise_name || 'um exercício'}. Quer analisar?`
    }
    if (insight.insight_key?.startsWith('program_expiring')) {
        return `O programa de ${name} está encerrando. Quer que eu analise o progresso para sugerir o próximo?`
    }
    if (insight.insight_key?.startsWith('pain_report')) {
        return `${name} reportou desconforto no último check-in. Quer revisar os detalhes?`
    }
    return `Insight sobre ${name}: ${insight.title}. Como posso ajudar?`
}

export function AssistantInsights({ initialInsights, trainerId }: AssistantInsightsProps) {
    const [insights, setInsights] = useState<InsightItem[]>(initialInsights)
    const [dismissingId, setDismissingId] = useState<string | null>(null)
    const openChat = useAssistantChatStore(s => s.openChat)
    const MAX_VISIBLE = 5

    const newCount = insights.filter(i => i.status === 'new').length
    const visibleInsights = insights.slice(0, MAX_VISIBLE)
    const hasMore = insights.length > MAX_VISIBLE

    // Open chat with insight context
    const handleInsightClick = useCallback(async (insight: InsightItem) => {
        if (insight.status === 'new') {
            setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, status: 'read' as const } : i))
            markInsightRead(insight.id)
        }

        openChat({
            studentId: insight.student_id || undefined,
            studentName: insight.student_name || undefined,
            insightId: insight.insight_key || undefined,
            initialMessage: buildInitialMessage(insight),
        })
    }, [openChat])

    // Dismiss insight
    const handleDismiss = useCallback(async (e: React.MouseEvent, insightId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setDismissingId(insightId)
        setInsights(prev => prev.filter(i => i.id !== insightId))
        await dismissInsight(insightId)
        setDismissingId(null)
    }, [])

    // Realtime subscription for new insights
    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null

        channel = supabase
            .channel(`assistant_insights_${trainerId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'assistant_insights',
                    filter: `trainer_id=eq.${trainerId}`,
                },
                (payload) => {
                    const newInsight = payload.new as any
                    setInsights(prev => {
                        // Avoid duplicates
                        if (prev.some(i => i.id === newInsight.id)) return prev
                        const item: InsightItem = {
                            ...newInsight,
                            student_name: null, // Will be resolved on next full fetch
                            action_metadata: newInsight.action_metadata || {},
                        }
                        return [item, ...prev]
                    })
                }
            )
            .subscribe()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [trainerId])

    // Empty state
    if (insights.length === 0) {
        return (
            <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-foreground">Insights do assistente</h2>
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

    return (
        <section className="mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-foreground">Insights do assistente</h2>
                    {newCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-violet-500 text-white leading-none">
                            {newCount} {newCount === 1 ? 'novo' : 'novos'}
                        </span>
                    )}
                </div>
                {hasMore && (
                    <span className="text-xs text-muted-foreground">
                        +{insights.length - MAX_VISIBLE} mais
                    </span>
                )}
            </div>

            {/* Insight cards */}
            <div className="space-y-2">
                {visibleInsights.map(insight => {
                    const config = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.summary
                    const CategoryIcon = config.Icon

                    const cardContent = (
                        <div
                            className={`
                                relative flex gap-3 p-3 rounded-r-xl border border-l-[3px] transition-colors cursor-pointer
                                ${config.borderColor}
                                ${insight.status === 'new'
                                    ? 'bg-card border-border/60 hover:bg-muted/30'
                                    : 'bg-card border-border/40 hover:bg-muted/20 opacity-85'
                                }
                            `}
                            onClick={() => handleInsightClick(insight)}
                        >
                            {/* Category icon */}
                            <div className="flex-shrink-0 pt-0.5">
                                <div className={`w-7 h-7 rounded-full ${config.dotColor}/10 flex items-center justify-center`}>
                                    <CategoryIcon className={`w-3.5 h-3.5 ${config.textColor}`} />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[10px] font-semibold tracking-wide ${config.textColor}`}>
                                        {config.label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>{timeAgo(insight.created_at)}</span>
                                    {insight.status === 'new' && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                                    )}
                                </div>
                                <p className="text-sm font-medium text-foreground leading-snug">{insight.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{insight.body}</p>
                            </div>

                            {/* Dismiss button */}
                            <button
                                onClick={(e) => handleDismiss(e, insight.id)}
                                className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                style={{ opacity: dismissingId === insight.id ? 0.5 : undefined }}
                                title="Dispensar"
                            >
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>
                    )

                    return <div key={insight.id} className="group">{cardContent}</div>
                })}
            </div>
        </section>
    )
}
