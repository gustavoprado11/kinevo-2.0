'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Check, FolderArchive, ChevronRight, MessageCircle, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markInsightRead, dismissInsight } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'
import type { PendingFinancialItem, PendingFormItem, ExpiredPlanItem } from '@/lib/dashboard/get-dashboard-data'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'
import { useCommunicationStore } from '@/stores/communication-store'
import { formatCurrency } from '@/lib/utils/financial'
import { DraftMessageComposer } from './draft-message-composer'
import { WinbackComposer } from './winback-composer'
import { AssistantMark } from '@/components/assistant/assistant-mark'

// ── Category config ──
//
// Redesign "ferramenta profissional": a categoria vira rótulo em mono
// micro-caps — cor SÓ nos estados que pedem atenção (alerta vermelho,
// financeiro âmbar); o resto fica em tinta terciária. Avatares neutros.

const CAT: Record<string, { label: string; labelClass: string }> = {
    alert:       { label: 'Alerta',     labelClass: 'text-red-600 dark:text-red-400' },
    progression: { label: 'Progressão', labelClass: 'text-k-text-quaternary' },
    suggestion:  { label: 'Sugestão',   labelClass: 'text-k-text-quaternary' },
    summary:     { label: 'Resumo',     labelClass: 'text-k-text-quaternary' },
    financial:   { label: 'Financeiro', labelClass: 'text-amber-600 dark:text-amber-400' },
    form:        { label: 'Avaliação',  labelClass: 'text-k-text-quaternary' },
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
    if (insight.insight_key?.startsWith('ready_to_progress')) {
        const count = typeof meta.count === 'number' ? meta.count : null
        const exercises = Array.isArray(meta.exercises) ? meta.exercises as Array<{ name?: string }> : []
        const where = count && count > 1
            ? `${count} exercícios`
            : (exercises[0]?.name || meta.exercise_name || 'um exercício')
        return `${name} bateu o topo do range em ${where}. Quer revisar como evoluir a prescrição (carga, reps, séries, cadência…)?`
    }
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

/**
 * Prompt que entra no COMPOSER do assistente quando o treinador clica no card —
 * escrito na voz DELE, para ser revisado/editado antes de enviar (o clique não
 * dispara turno nenhum). Parte do título do insight, que já resume o achado
 * (aluno, exercícios, tempo), e acrescenta o pedido de ação.
 */
function buildActionPrompt(insight: InsightItem): string {
    const name = insight.student_name || 'o aluno'
    const first = name.split(' ')[0]
    const meta = insight.action_metadata || {}
    const key = insight.insight_key || ''
    const title = insight.title.replace(/[.\s]+$/, '')

    if (key.startsWith('gap_alert')) {
        const days = meta.days_since_last
        const gap = !days || days >= 365
            ? `${name} ainda não realizou nenhum treino`
            : `${name} está sem treinar há ${days} dias`
        return `${gap}. Analise o histórico dele e me diga como retomar — e sugira uma mensagem para reengajar.`
    }
    if (key.startsWith('stagnation')) {
        return `${title}. Analise a progressão de ${first} e sugira como ajustar o programa (carga, volume ou variação de exercício).`
    }
    if (key.startsWith('ready_to_progress')) {
        return `${title}. Analise e sugira como evoluir a prescrição de ${first} (carga, repetições, séries).`
    }
    if (key.startsWith('program_expiring')) {
        return `O programa de ${name} está encerrando. Analise o progresso dele e proponha o próximo programa.`
    }
    if (key.startsWith('pain_report')) {
        return `${name} reportou desconforto no último check-in. Revise os detalhes e sugira ajustes no programa.`
    }
    return `${title}. Analise e me diga o que fazer com ${first}.`
}

/** Returns direct action buttons per insight type (no assistant needed) */
function getDirectActions(insight: InsightItem): Array<{
    id: string
    label: string
    icon: React.ReactNode
    action: 'message' | 'program' | 'profile'
}> {
    const key = insight.insight_key || ''
    const actions: ReturnType<typeof getDirectActions> = []

    // Gap alert → message the student + view profile
    if (key.startsWith('gap_alert')) {
        actions.push({ id: 'msg', label: 'Mensagem', icon: <MessageCircle className="w-3 h-3" />, action: 'message' })
    }
    // Stagnation → message + create program
    if (key.startsWith('stagnation')) {
        actions.push({ id: 'msg', label: 'Mensagem', icon: <MessageCircle className="w-3 h-3" />, action: 'message' })
        actions.push({ id: 'prog', label: 'Novo programa', icon: <Dumbbell className="w-3 h-3" />, action: 'program' })
    }
    // Ready to progress → create program
    if (key.startsWith('ready_to_progress')) {
        actions.push({ id: 'prog', label: 'Novo programa', icon: <Dumbbell className="w-3 h-3" />, action: 'program' })
    }
    // Program expiring → create program + message
    if (key.startsWith('program_expiring')) {
        actions.push({ id: 'prog', label: 'Novo programa', icon: <Dumbbell className="w-3 h-3" />, action: 'program' })
        actions.push({ id: 'msg', label: 'Mensagem', icon: <MessageCircle className="w-3 h-3" />, action: 'message' })
    }
    // Pain report → message student
    if (key.startsWith('pain_report')) {
        actions.push({ id: 'msg', label: 'Mensagem', icon: <MessageCircle className="w-3 h-3" />, action: 'message' })
    }

    return actions
}

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
    const [draftFor, setDraftFor] = useState<{ insight: InsightItem; studentId: string; studentName: string } | null>(null)
    const [winbackFor, setWinbackFor] = useState<{ studentId: string; planId: string; studentName: string; planTitle: string | null } | null>(null)
    const [hiddenExpiredPlans, setHiddenExpiredPlans] = useState<Set<string>>(new Set())
    const openChat = useAssistantChatStore(s => s.openChat)
    const { openPanel, openConversation } = useCommunicationStore()
    const P: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

    // Build rows
    const rows: UnifiedRow[] = []

    for (const i of insights) {
        const isUrgent = i.priority === 'critical' || i.priority === 'high'
        rows.push({
            id: `i-${i.id}`, type: 'insight', category: i.category, priority: P[i.priority] ?? 2,
            studentName: i.student_name || 'Aluno', studentId: i.student_id, isNew: i.status === 'new',
            title: i.title,
            subtitle: i.body.length > 160 ? i.body.slice(0, 160).trimEnd() + '...' : i.body,
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
        if (hiddenExpiredPlans.has(ep.studentId)) continue
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
                prefill: buildActionPrompt(row.insight),
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
            initialMessage: buildInitialMessage(insight),
            prefill: buildActionPrompt(insight),
        })
    }, [openChat])

    const handleDismiss = useCallback(async (e: React.MouseEvent, insightId: string) => {
        e.stopPropagation()
        setInsights(prev => prev.filter(i => i.id !== insightId))
        await dismissInsight(insightId)
    }, [])

    // "Mensagem" num card de insight → abre o compositor de rascunho (gera via IA),
    // em vez de só abrir o chat vazio. Marca como lido ao abrir.
    const handleOpenDraft = useCallback((e: React.MouseEvent, insight: InsightItem, studentId: string, studentName: string) => {
        e.stopPropagation()
        if (insight.status === 'new') {
            setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, status: 'read' as const } : i))
            markInsightRead(insight.id)
        }
        setDraftFor({ insight, studentId, studentName })
    }, [])

    const handleDraftSent = useCallback((insightId: string) => {
        setInsights(prev => prev.filter(i => i.id !== insightId))
        setDraftFor(null)
    }, [])

    const handleWinbackSent = useCallback((studentId: string) => {
        setHiddenExpiredPlans(prev => new Set(prev).add(studentId))
        setWinbackFor(null)
    }, [])

    const handleDirectAction = useCallback((e: React.MouseEvent, action: 'message' | 'program' | 'profile', studentId?: string | null, studentName?: string | null) => {
        e.stopPropagation()
        if (action === 'message' && studentId) {
            openPanel('messages')
            openConversation(studentId)
        } else if (action === 'program' && studentId) {
            window.location.href = `/students/${studentId}/program/new`
        } else if (action === 'profile' && studentId) {
            window.location.href = `/students/${studentId}`
        }
    }, [openPanel, openConversation])

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

    // Botão secundário quieto (tinta sobre card, hairline, canto de controle).
    const quietBtn = 'flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-control border border-k-border-subtle bg-surface-card text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary transition-colors'

    return (
        <div className="flex flex-col rounded-panel border border-k-border-subtle bg-surface-card">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-k-border-subtle px-5 py-3">
                <div className="flex items-baseline gap-2">
                    <AssistantMark className="w-3.5 h-3.5 text-k-text-tertiary self-center" />
                    <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Assistente Kinevo
                    </h2>
                    {rows.length > 0 && (
                        <span className="font-mono text-[10.5px] tabular-nums text-k-text-quaternary">
                            {rows.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Rows */}
            {rows.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="mb-3 flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-surface-inset">
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </div>
                    <p className="text-[13px] text-k-text-secondary">Tudo em dia com seus alunos</p>
                    <p className="text-xs text-k-text-quaternary mt-1">Insights e ações aparecerão aqui</p>
                </div>
            ) : (
                <div className="divide-y divide-k-border-subtle max-h-[320px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {rows.map((row) => {
                        const cat = CAT[row.category] || CAT.summary
                        const isManualFin = !!row.financialItem && (row.financialItem.billingType === 'manual_recurring' || row.financialItem.billingType === 'manual_one_off')
                        const hasActions = row.type === 'insight'
                            || row.type === 'form'
                            || row.type === 'expired_plan'
                            || (row.type === 'financial' && isManualFin)

                        return (
                            <div
                                key={row.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleRowClick(row)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(row) }}
                                className="group flex w-full flex-col px-5 py-3.5 text-left transition-colors hover:bg-surface-inset/60 cursor-pointer"
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    {/* Avatar neutro */}
                                    {row.avatarUrl ? (
                                        <Image src={row.avatarUrl} alt={row.studentName} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" unoptimized />
                                    ) : (
                                        <div className="h-8 w-8 shrink-0 rounded-full border border-k-border-subtle bg-surface-inset flex items-center justify-center">
                                            <span className="text-[11px] font-semibold text-k-text-secondary">
                                                {row.studentName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        {/* Line 1: Name + categoria em mono micro-caps */}
                                        <div className="flex items-baseline gap-2 mb-0.5">
                                            <span className="text-sm font-semibold text-k-text-primary truncate">
                                                {row.studentName}
                                            </span>
                                            <span className={`font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] shrink-0 ${cat.labelClass}`}>
                                                {cat.label}
                                            </span>
                                            {row.isNew && (
                                                <span className="w-1 h-1 rounded-full bg-primary shrink-0 self-center" title="Novo" />
                                            )}
                                        </div>

                                        {/* Line 2: Insight text */}
                                        <p className="text-[13px] text-k-text-secondary line-clamp-2">
                                            {row.title}
                                        </p>

                                        {/* Line 3: Subtitle / body */}
                                        {row.subtitle && (
                                            <p className="text-[11.5px] text-k-text-quaternary line-clamp-2 mt-0.5" suppressHydrationWarning>
                                                {row.subtitle}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions — own row below content so the text gets full width */}
                                {hasActions && (
                                <div className="flex items-center justify-end gap-2 mt-2 pl-11">
                                    {row.type === 'insight' && row.insight && (() => {
                                        const directActions = getDirectActions(row.insight!)
                                        const primaryAction = directActions[0]
                                        const secondaryActions = directActions.slice(1)
                                        return (
                                            <>
                                                {/* Secondary actions — hover only */}
                                                {secondaryActions.length > 0 && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {secondaryActions.map(da => (
                                                            <button
                                                                key={da.id}
                                                                onClick={(e) => da.action === 'message' && row.studentId
                                                                    ? handleOpenDraft(e, row.insight!, row.studentId, row.studentName)
                                                                    : handleDirectAction(e, da.action, row.studentId, row.studentName)}
                                                                className={quietBtn}
                                                                title={da.label}
                                                            >
                                                                {da.icon}
                                                                <span className="hidden lg:inline">{da.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Primary direct action — always visible */}
                                                {primaryAction && (
                                                    <button
                                                        onClick={(e) => primaryAction.action === 'message' && row.studentId
                                                            ? handleOpenDraft(e, row.insight!, row.studentId, row.studentName)
                                                            : handleDirectAction(e, primaryAction.action, row.studentId, row.studentName)}
                                                        className={quietBtn}
                                                        title={primaryAction.label}
                                                    >
                                                        {primaryAction.icon}
                                                        {primaryAction.label}
                                                    </button>
                                                )}
                                                {/* Dismiss — hover only */}
                                                <button
                                                    onClick={(e) => handleDismiss(e, row.insight!.id)}
                                                    className="p-1 rounded-control hover:bg-surface-inset transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Dispensar"
                                                >
                                                    <X className="w-3.5 h-3.5 text-k-text-quaternary" />
                                                </button>
                                                {/* Assistant — a ação da linha, única em violeta */}
                                                <button
                                                    onClick={(e) => handleInsightAction(e, row.insight!)}
                                                    className="text-[12px] font-medium text-primary hover:opacity-80 flex items-center gap-0.5 transition-opacity"
                                                >
                                                    {getActionLabel(row.insight!)} <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </>
                                        )
                                    })()}

                                    {row.type === 'financial' && row.financialItem && (() => {
                                        const fin = row.financialItem!
                                        const isManual = fin.billingType === 'manual_recurring' || fin.billingType === 'manual_one_off'
                                        if (!isManual) return null
                                        return (
                                            <button
                                                onClick={(e) => handleMarkAsPaid(e, fin.id)}
                                                disabled={markingPaid === fin.id}
                                                className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 hover:opacity-80 flex items-center gap-1 transition-opacity disabled:opacity-50"
                                            >
                                                {markingPaid === fin.id ? '...' : <><Check className="w-3 h-3" /> Pago</>}
                                            </button>
                                        )
                                    })()}

                                    {row.type === 'form' && (
                                        <Link href="/forms" onClick={e => e.stopPropagation()} className="text-[12px] font-medium text-primary hover:opacity-80 flex items-center gap-0.5 transition-opacity">
                                            Revisar <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    )}

                                    {row.type === 'expired_plan' && row.expiredPlanItem && (
                                        <div className="flex items-center gap-2">
                                            {row.studentId && (
                                                <button
                                                    onClick={(e) => handleDirectAction(e, 'message', row.studentId, row.studentName)}
                                                    className={`${quietBtn} opacity-0 group-hover:opacity-100`}
                                                    title="Enviar mensagem"
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                </button>
                                            )}
                                            {row.expiredPlanItem.planId && row.studentId && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setWinbackFor({ studentId: row.studentId!, planId: row.expiredPlanItem!.planId!, studentName: row.studentName, planTitle: row.expiredPlanItem!.planTitle }) }}
                                                    className="text-[12px] font-medium text-primary hover:opacity-80 transition-opacity"
                                                >
                                                    Reativar
                                                </button>
                                            )}
                                            {onSellPlan && row.studentId && (
                                                <button onClick={(e) => { e.stopPropagation(); onSellPlan(row.studentId!) }} className="text-[12px] font-medium text-primary hover:opacity-80 transition-opacity">
                                                    Vender plano
                                                </button>
                                            )}
                                            {onArchiveStudent && row.studentId && (
                                                <button onClick={(e) => { e.stopPropagation(); onArchiveStudent(row.studentId!, row.studentName) }} className="text-k-text-quaternary hover:text-red-500 transition-colors" title="Arquivar aluno">
                                                    <FolderArchive className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {draftFor && (
                <DraftMessageComposer
                    insight={draftFor.insight}
                    studentId={draftFor.studentId}
                    studentName={draftFor.studentName}
                    onClose={() => setDraftFor(null)}
                    onSent={handleDraftSent}
                />
            )}

            {winbackFor && (
                <WinbackComposer
                    studentId={winbackFor.studentId}
                    planId={winbackFor.planId}
                    studentName={winbackFor.studentName}
                    planTitle={winbackFor.planTitle}
                    onClose={() => setWinbackFor(null)}
                    onSent={handleWinbackSent}
                />
            )}
        </div>
    )
}
