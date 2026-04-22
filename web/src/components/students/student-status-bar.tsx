'use client'

import { useMemo, useState } from 'react'
import {
    Dumbbell,
    Clock,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Flame,
    TrendingDown,
    BatteryLow,
    CalendarClock,
    ArrowDown,
    MessageCircle,
    X,
} from 'lucide-react'

/**
 * StudentStatusBar
 * ----------------
 * Faixa única, horizontal, que vai **dentro do header** do aluno. Antes,
 * o header tinha só os dois stats operacionais ("0/4 esta semana", "há 5
 * dias último treino") e tudo mais (pontos de atenção, banner "Sem treino
 * há N dias" e ContextualAlerts) virava 3 faixas empilhadas abaixo do
 * header, cortando o viewport em fatias antes do dashboard começar.
 *
 * A ideia aqui é consolidar tudo num corpo só:
 *  - Stats operacionais à esquerda (frequência semanal + último treino)
 *  - Alertas / pontos de atenção à direita como chips compactos
 *  - CTA de contato aparece só quando o aluno está >=3 dias sem treinar
 *    (antes do limiar, não vale a pena ocupar espaço com ele)
 *  - Clicar num chip expande o detalhe numa linha logo abaixo (mesmo
 *    padrão do ContextualAlerts anterior, só que inline no header)
 */

// ── Types ──

type Severity = 'good' | 'attention' | 'critical'

interface StatusChip {
    id: string
    label: string // texto curto que aparece no chip
    detail?: string // texto longo que aparece expandido
    severity: Severity
    icon?: React.ReactNode
}

interface StudentStatusBarProps {
    historySummary: {
        totalSessions: number
        lastSessionDate: string | null
        completedThisWeek: number
        expectedPerWeek: number
        streak: number
    }
    recentSessions: any[]
    tonnageMap: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>
    weeklyAdherence: { week: number; rate: number }[]
    activeProgram: {
        status: string
        duration_weeks: number | null
        started_at: string | null
    } | null
    financialStatus: string
    hasPendingForms: boolean
    studentName: string
    studentPhone: string | null
    /** Chamado ao clicar em "Mensagem" no CTA de inatividade. */
    onSendMessage: () => void
}

// ── Component ──

export function StudentStatusBar({
    historySummary,
    recentSessions,
    tonnageMap,
    weeklyAdherence,
    activeProgram,
    financialStatus,
    hasPendingForms,
    studentName,
    studentPhone,
    onSendMessage,
}: StudentStatusBarProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // ── Stats operacionais (sempre presentes quando há programa ativo) ──
    const stats = useMemo(() => {
        const out: { key: string; icon: React.ReactNode; value: string; label: string; tone: 'neutral' | 'amber' | 'red' | 'emerald' }[] = []

        if (activeProgram && historySummary.expectedPerWeek > 0) {
            const metGoal = historySummary.completedThisWeek >= historySummary.expectedPerWeek
            out.push({
                key: 'weekly',
                icon: <Dumbbell className="w-3.5 h-3.5" />,
                value: `${historySummary.completedThisWeek}/${historySummary.expectedPerWeek}`,
                label: metGoal ? 'Meta atingida!' : 'esta semana',
                tone: metGoal ? 'emerald' : 'amber',
            })
        }

        if (historySummary.lastSessionDate) {
            const daysSince = Math.floor((Date.now() - new Date(historySummary.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
            const lastLabel = daysSince === 0 ? 'Hoje' : daysSince === 1 ? 'Ontem' : `há ${daysSince} dias`
            const tone: 'neutral' | 'amber' | 'red' = daysSince >= 6 ? 'red' : daysSince >= 3 ? 'amber' : 'neutral'
            out.push({
                key: 'last',
                icon: <Clock className="w-3.5 h-3.5" />,
                value: lastLabel,
                label: 'último treino',
                tone,
            })
        } else if (activeProgram && historySummary.totalSessions === 0) {
            out.push({
                key: 'not-started',
                icon: <Clock className="w-3.5 h-3.5" />,
                value: 'Não iniciou',
                label: 'aguardando primeiro treino',
                tone: 'amber',
            })
        }

        return out
    }, [activeProgram, historySummary])

    // ── Chips de alerta (colapsáveis) ──
    const chips = useMemo(() => {
        const out: StatusChip[] = []

        if (!activeProgram) {
            out.push({
                id: 'no-program',
                label: 'Sem programa ativo',
                detail: 'O aluno não tem um programa em andamento. Crie um ou atribua um existente.',
                severity: 'critical',
                icon: <XCircle className="w-3.5 h-3.5" />,
            })
        }

        // Inatividade (unificação do antigo banner "Sem treino há N dias").
        // Dois casos disparam o chip + CTA de contato: aluno sumiu ≥3 dias OU
        // o aluno nunca completou a primeira sessão mesmo com programa ativo.
        if (activeProgram && historySummary.lastSessionDate) {
            const daysSince = Math.floor((Date.now() - new Date(historySummary.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
            if (daysSince >= 6) {
                out.push({
                    id: 'inactivity',
                    label: `Sem treino há ${daysSince} dias`,
                    detail: `${studentName.split(' ')[0]} está há ${daysSince} dias sem completar uma sessão. Considere entrar em contato.`,
                    severity: 'critical',
                    icon: <AlertCircle className="w-3.5 h-3.5" />,
                })
            } else if (daysSince >= 3) {
                out.push({
                    id: 'inactivity',
                    label: `Sem treino há ${daysSince} dias`,
                    detail: 'Monitore a frequência — pode ser só um intervalo normal ou um sinal precoce de desengajamento.',
                    severity: 'attention',
                    icon: <AlertCircle className="w-3.5 h-3.5" />,
                })
            }
        } else if (activeProgram && !historySummary.lastSessionDate && historySummary.totalSessions === 0) {
            out.push({
                id: 'inactivity',
                label: `${studentName.split(' ')[0]} ainda não iniciou`,
                detail: 'O aluno tem programa atribuído mas ainda não completou a primeira sessão. Um empurrãozinho pode ajudar.',
                severity: 'attention',
                icon: <AlertCircle className="w-3.5 h-3.5" />,
            })
        }

        // Adesão (unificação do antigo StudentHealthSummary + ContextualAlerts)
        if (weeklyAdherence.length >= 2) {
            const lastTwo = weeklyAdherence.slice(-2)
            // Atenção: os valores podem vir em duas escalas (0–1 ou 0–100) dependendo
            // do produtor. Normalizamos para 0–100 antes de comparar.
            const normalize = (r: number) => (r <= 1 ? r * 100 : r)
            const avg = lastTwo.reduce((s, w) => s + normalize(w.rate), 0) / lastTwo.length
            if (avg < 50) {
                out.push({
                    id: 'adherence',
                    label: `Adesão ${Math.round(avg)}%`,
                    detail: 'O aluno pode precisar de ajuste na frequência ou motivação extra. Adesão abaixo de 50% nas últimas 2 semanas.',
                    severity: 'critical',
                    icon: <BatteryLow className="w-3.5 h-3.5" />,
                })
            } else if (avg < 70) {
                out.push({
                    id: 'adherence',
                    label: `Adesão em queda (${Math.round(avg)}%)`,
                    detail: 'Tendência de queda na frequência de treinos nas últimas 2 semanas.',
                    severity: 'attention',
                    icon: <BatteryLow className="w-3.5 h-3.5" />,
                })
            }
        }

        // PSE / intensidade
        const rpeValues = recentSessions
            .map(s => s.rpe)
            .filter((r: unknown): r is number => typeof r === 'number' && r > 0)
        if (rpeValues.length >= 2) {
            const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
            if (avgRpe >= 9) {
                out.push({
                    id: 'rpe-high',
                    label: `PSE muito alta (${avgRpe.toFixed(1)})`,
                    detail: 'PSE média muito alta. Considere reduzir intensidade ou volume para evitar overtraining.',
                    severity: 'critical',
                    icon: <Flame className="w-3.5 h-3.5" />,
                })
            } else if (avgRpe >= 8) {
                out.push({
                    id: 'rpe-elevated',
                    label: `PSE média elevada (${avgRpe.toFixed(1)})`,
                    detail: 'PSE média elevada. Monitore fadiga acumulada nas próximas sessões.',
                    severity: 'attention',
                    icon: <Flame className="w-3.5 h-3.5" />,
                })
            }
        }

        // Carga
        const changes = Object.values(tonnageMap).filter(t => t.percentChange != null)
        if (changes.length >= 2) {
            const avgChange = changes.reduce((sum, t) => sum + (t.percentChange ?? 0), 0) / changes.length
            if (avgChange <= -10) {
                out.push({
                    id: 'load-drop',
                    label: `Carga -${Math.abs(avgChange).toFixed(0)}%`,
                    detail: 'Carga caiu significativamente nos últimos treinos. Possível fadiga, dor ou desmotivação — vale uma conversa.',
                    severity: 'critical',
                    icon: <TrendingDown className="w-3.5 h-3.5" />,
                })
            } else if (avgChange <= -5) {
                out.push({
                    id: 'load-slight',
                    label: `Carga reduzida (${avgChange.toFixed(1)}%)`,
                    detail: 'Queda leve — pode ser deload planejado ou fadiga pontual.',
                    severity: 'attention',
                    icon: <ArrowDown className="w-3.5 h-3.5" />,
                })
            }
        }

        // Programa acabando
        if (activeProgram?.started_at && activeProgram.duration_weeks) {
            const start = new Date(activeProgram.started_at)
            const endDate = new Date(start.getTime() + activeProgram.duration_weeks * 7 * 24 * 60 * 60 * 1000)
            const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            if (daysLeft <= 7 && daysLeft > 0 && activeProgram.status === 'active') {
                out.push({
                    id: 'program-ending',
                    label: `Programa termina em ${daysLeft}d`,
                    detail: 'Programa termina em breve. Planeje a transição para o próximo programa.',
                    severity: 'attention',
                    icon: <CalendarClock className="w-3.5 h-3.5" />,
                })
            }
        }

        // Financeiro
        if (financialStatus === 'expired' || financialStatus === 'past_due' || financialStatus === 'overdue') {
            out.push({
                id: 'financial',
                label: financialStatus === 'expired' ? 'Financeiro expirado' : 'Financeiro atrasado',
                detail: 'Situação financeira requer atenção. Confira o card Financeiro ao lado.',
                severity: 'critical',
                icon: <AlertCircle className="w-3.5 h-3.5" />,
            })
        } else if (financialStatus === 'canceling' || financialStatus === 'canceled') {
            out.push({
                id: 'financial',
                label: 'Assinatura cancelando',
                detail: 'A assinatura está em processo de cancelamento.',
                severity: 'attention',
                icon: <AlertCircle className="w-3.5 h-3.5" />,
            })
        }

        // Avaliações pendentes
        if (hasPendingForms) {
            out.push({
                id: 'forms',
                label: 'Avaliações pendentes',
                detail: 'O aluno tem avaliações/check-ins pendentes de resposta.',
                severity: 'attention',
                icon: <AlertTriangle className="w-3.5 h-3.5" />,
            })
        }

        return out
    }, [activeProgram, historySummary, recentSessions, tonnageMap, weeklyAdherence, financialStatus, hasPendingForms, studentName])

    const expanded = chips.find(c => c.id === expandedId) ?? null

    const hasAnyContent = stats.length > 0 || chips.length > 0
    if (!hasAnyContent) return null

    // CTA rápido de contato — só aparece quando há chip de inatividade
    const inactivityChip = chips.find(c => c.id === 'inactivity')
    const whatsappLink = studentPhone ? `https://wa.me/${studentPhone.replace(/\D/g, '')}` : null

    return (
        <div className="space-y-2">
            {/* Linha principal: stats à esquerda, chips à direita */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* Stats */}
                <div className="flex flex-wrap items-center gap-2">
                    {stats.map(stat => (
                        <span
                            key={stat.key}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold ${statToneClasses(stat.tone)}`}
                        >
                            {stat.icon}
                            <span className="font-bold">{stat.value}</span>
                            <span className="opacity-70 font-medium">{stat.label}</span>
                        </span>
                    ))}
                </div>

                {/* Separador sutil só quando temos stats E chips */}
                {stats.length > 0 && chips.length > 0 && (
                    <span className="hidden sm:inline-block h-4 w-px bg-k-border-subtle" aria-hidden />
                )}

                {/* Chips de alerta */}
                {chips.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                        {chips.map(chip => {
                            const isActive = expandedId === chip.id
                            const dot =
                                chip.severity === 'critical'
                                    ? 'bg-red-500'
                                    : chip.severity === 'attention'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                            return (
                                <button
                                    key={chip.id}
                                    type="button"
                                    onClick={() => setExpandedId(isActive ? null : chip.id)}
                                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11.5px] font-medium transition-colors ${
                                        isActive
                                            ? 'bg-k-surface-raised border-k-border-default text-k-text-primary shadow-sm'
                                            : 'bg-transparent border-k-border-subtle text-k-text-secondary hover:bg-k-surface hover:text-k-text-primary'
                                    }`}
                                    aria-expanded={isActive}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                    <span className="truncate max-w-[200px]">{chip.label}</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* CTA de contato quando o aluno está sumido */}
                {inactivityChip && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        <button
                            onClick={onSendMessage}
                            className="inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-md transition-colors"
                        >
                            <MessageCircle className="w-3 h-3" />
                            Mensagem
                        </button>
                        {whatsappLink && (
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2.5 h-7 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-md transition-colors"
                            >
                                WhatsApp
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Detalhe expandido */}
            {expanded && (
                <div
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[12px] leading-relaxed ${
                        expanded.severity === 'critical'
                            ? 'bg-red-50/70 dark:bg-red-500/5 border-red-200/70 dark:border-red-500/20 text-red-700 dark:text-red-300'
                            : expanded.severity === 'attention'
                                ? 'bg-amber-50/70 dark:bg-amber-500/5 border-amber-200/70 dark:border-amber-500/20 text-amber-800 dark:text-amber-300'
                                : 'bg-emerald-50/70 dark:bg-emerald-500/5 border-emerald-200/70 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}
                >
                    {expanded.icon && <div className="shrink-0 mt-0.5 opacity-80">{expanded.icon}</div>}
                    <div className="flex-1">
                        <p className="font-semibold">{expanded.label}</p>
                        {expanded.detail && <p className="mt-0.5 opacity-80">{expanded.detail}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="shrink-0 p-1 -m-1 rounded hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100"
                        aria-label="Fechar detalhe"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    )
}

function statToneClasses(tone: 'neutral' | 'amber' | 'red' | 'emerald'): string {
    switch (tone) {
        case 'emerald':
            return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        case 'amber':
            return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
        case 'red':
            return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
        default:
            return 'bg-k-surface dark:bg-white/5 text-k-text-secondary'
    }
}
