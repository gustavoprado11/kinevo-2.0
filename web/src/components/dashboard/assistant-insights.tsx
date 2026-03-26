'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, X, AlertTriangle, TrendingUp, Lightbulb, BarChart3, ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markInsightRead, dismissInsight } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'
import Link from 'next/link'

// ── Styling maps ──

const CATEGORY_CONFIG: Record<string, { label: string; dotColor: string; textColor: string; borderColor: string; Icon: typeof AlertTriangle }> = {
    alert: { label: 'Alerta', dotColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', borderColor: 'border-l-red-500', Icon: AlertTriangle },
    progression: { label: 'Progressão', dotColor: 'bg-teal-500', textColor: 'text-teal-600 dark:text-teal-400', borderColor: 'border-l-teal-500', Icon: TrendingUp },
    suggestion: { label: 'Sugestão', dotColor: 'bg-violet-500', textColor: 'text-violet-600 dark:text-violet-400', borderColor: 'border-l-violet-500', Icon: Lightbulb },
    summary: { label: 'Resumo', dotColor: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-l-blue-500', Icon: BarChart3 },
}

const ACTION_LINKS: Record<string, (meta: Record<string, any>) => string> = {
    contact_student: (m) => `/students/${m.student_id}`,
    review_program: (m) => `/students/${m.student_id}`,
    adjust_load: (m) => `/students/${m.student_id}`,
    generate_program: (m) => `/students/${m.student_id}/prescribe`,
    view_session: (m) => `/students/${m.student_id}`,
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

export function AssistantInsights({ initialInsights, trainerId }: AssistantInsightsProps) {
    const [insights, setInsights] = useState<InsightItem[]>(initialInsights)
    const [dismissingId, setDismissingId] = useState<string | null>(null)
    const MAX_VISIBLE = 5

    const newCount = insights.filter(i => i.status === 'new').length
    const visibleInsights = insights.slice(0, MAX_VISIBLE)
    const hasMore = insights.length > MAX_VISIBLE

    // Mark as read when clicked
    const handleInsightClick = useCallback(async (insight: InsightItem) => {
        if (insight.status === 'new') {
            setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, status: 'read' as const } : i))
            await markInsightRead(insight.id)
        }
    }, [])

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
                    <Link
                        href="/insights"
                        className="text-xs text-violet-500 hover:text-violet-400 font-medium flex items-center gap-0.5"
                    >
                        Ver todos <ChevronRight className="w-3 h-3" />
                    </Link>
                )}
            </div>

            {/* Insight cards */}
            <div className="space-y-2">
                {visibleInsights.map(insight => {
                    const config = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.summary
                    const CategoryIcon = config.Icon
                    const linkFn = insight.action_type ? ACTION_LINKS[insight.action_type] : null
                    const href = linkFn ? linkFn(insight.action_metadata) : null

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
                                    <span className="text-[10px] text-muted-foreground">{timeAgo(insight.created_at)}</span>
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

                    if (href) {
                        return (
                            <Link key={insight.id} href={href} className="block group">
                                {cardContent}
                            </Link>
                        )
                    }

                    return <div key={insight.id} className="group">{cardContent}</div>
                })}
            </div>
        </section>
    )
}
