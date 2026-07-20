'use client'

import { useMemo } from 'react'
import { getProgramWeek, getProgramEndDate } from '@kinevo/shared/utils/schedule-projection'

/**
 * StudentKpiRuler
 * ---------------
 * Régua de sinais vitais do aluno — mesmo padrão da régua do dashboard
 * (painel único, divisores hairline via gap-px, rótulo mono, número 26px
 * tabular). Absorve os stats que viviam duplicados na StudentStatusBar
 * (dentro do header) e nos hero-stats do ActiveProgramDashboard.
 *
 * Cor é alerta, não decoração: último treino fica âmbar a partir de 3 dias
 * e vermelho a partir de 7 (mesma escalada do SmartBanner); adesão abaixo
 * de 70/50; PSE a partir de 8/9. Todo o resto é tinta.
 */

const TIMEZONE = 'America/Sao_Paulo'

interface StudentKpiRulerProps {
    historySummary: {
        totalSessions: number
        lastSessionDate: string | null
        completedThisWeek: number
        expectedPerWeek: number
        streak: number
    }
    recentSessions: Array<{ rpe?: number | null }>
    weeklyAdherence: { week: number; rate: number }[]
    activeProgram: {
        status: string
        duration_weeks: number | null
        started_at: string | null
    } | null
}

type Tone = 'neutral' | 'amber' | 'red' | 'emerald'

interface Cell {
    key: string
    label: string
    value: React.ReactNode
    tone: Tone
    sub?: React.ReactNode
}

// Os valores de adesão chegam em duas escalas (0–1 ou 0–100) dependendo do
// produtor — mesma normalização que a StudentStatusBar fazia.
function normalizeRate(rate: number): number {
    return rate <= 1 ? rate * 100 : rate
}

function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function toneClass(tone: Tone): string {
    switch (tone) {
        case 'amber': return 'text-amber-600 dark:text-amber-400'
        case 'red': return 'text-red-600 dark:text-red-400'
        case 'emerald': return 'text-emerald-600 dark:text-emerald-400'
        default: return 'text-k-text-primary'
    }
}

// Sufixo/unidade dentro do número grande ("2/4", "3d") em corpo menor.
function Unit({ children }: { children: React.ReactNode }) {
    return <span className="text-sm font-medium text-k-text-tertiary">{children}</span>
}

export function StudentKpiRuler({
    historySummary,
    recentSessions,
    weeklyAdherence,
    activeProgram,
}: StudentKpiRulerProps) {
    const cells = useMemo(() => {
        const out: Cell[] = []

        // ── Esta semana ──
        if (activeProgram && historySummary.expectedPerWeek > 0) {
            const { completedThisWeek: done, expectedPerWeek: expected } = historySummary
            const metGoal = done >= expected
            const remaining = Math.max(0, expected - done)
            out.push({
                key: 'week',
                label: 'Esta semana',
                value: <>{done}<Unit>/{expected}</Unit></>,
                tone: 'neutral',
                sub: metGoal
                    ? <span className="text-emerald-600 dark:text-emerald-400">Meta atingida</span>
                    : done > 0
                        ? `falta${remaining !== 1 ? 'm' : ''} ${remaining} treino${remaining !== 1 ? 's' : ''}`
                        : 'nenhum treino ainda',
            })
        }

        // ── Último treino ──
        if (historySummary.lastSessionDate) {
            const days = daysSince(historySummary.lastSessionDate)
            const tone: Tone = days >= 7 ? 'red' : days >= 3 ? 'amber' : 'neutral'
            const value = days === 0
                ? 'Hoje'
                : days === 1
                    ? 'Ontem'
                    : <>{days}<Unit>d</Unit></>
            out.push({
                key: 'last',
                label: 'Último treino',
                value,
                tone,
                sub: new Date(historySummary.lastSessionDate).toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    timeZone: TIMEZONE,
                }).replace(/\./g, ''),
            })
        } else if (activeProgram && historySummary.totalSessions === 0) {
            out.push({
                key: 'last',
                label: 'Último treino',
                value: '—',
                tone: 'amber',
                sub: 'não iniciou o programa',
            })
        }

        // ── Sequência ──
        if (historySummary.totalSessions > 0) {
            out.push({
                key: 'streak',
                label: 'Sequência',
                value: historySummary.streak,
                tone: 'neutral',
                sub: `treino${historySummary.streak !== 1 ? 's' : ''} seguido${historySummary.streak !== 1 ? 's' : ''}`,
            })
        }

        // ── Adesão (últimas 4 semanas) ──
        if (weeklyAdherence.length >= 2) {
            const recent = weeklyAdherence.slice(-4).map(w => normalizeRate(w.rate))
            const avg = Math.round(recent.reduce((s, r) => s + r, 0) / recent.length)
            const tone: Tone = avg < 50 ? 'red' : avg < 70 ? 'amber' : 'neutral'

            const previous = weeklyAdherence.slice(-8, -4).map(w => normalizeRate(w.rate))
            let sub: React.ReactNode = `últimas ${recent.length} semanas`
            if (previous.length >= 2) {
                const prevAvg = previous.reduce((s, r) => s + r, 0) / previous.length
                const delta = Math.round(avg - prevAvg)
                if (delta !== 0) {
                    sub = (
                        <>
                            <span className={delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                                {delta > 0 ? '+' : ''}{delta}%
                            </span>
                            {' '}vs 4 sem anteriores
                        </>
                    )
                }
            }
            out.push({
                key: 'adherence',
                label: 'Adesão · 4 sem',
                value: <>{avg}<Unit>%</Unit></>,
                tone,
                sub,
            })
        }

        // ── PSE média ──
        const rpeValues = recentSessions
            .map(s => s?.rpe)
            .filter((r): r is number => typeof r === 'number' && r > 0)
        if (rpeValues.length >= 2) {
            const avg = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
            const tone: Tone = avg >= 9 ? 'red' : avg >= 8 ? 'amber' : 'neutral'
            out.push({
                key: 'rpe',
                label: 'PSE média',
                value: avg.toFixed(1).replace('.', ','),
                tone,
                sub: `últimas ${rpeValues.length} sessões`,
            })
        }

        // ── Programa ──
        if (activeProgram?.duration_weeks && activeProgram.started_at) {
            const isExpired = activeProgram.status === 'expired'
            const week = isExpired
                ? activeProgram.duration_weeks
                : (getProgramWeek(new Date(), activeProgram.started_at, activeProgram.duration_weeks) ?? activeProgram.duration_weeks)
            const endDate = getProgramEndDate(activeProgram.started_at, activeProgram.duration_weeks)
                .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: TIMEZONE })
                .replace(/\./g, '')
            out.push({
                key: 'program',
                label: 'Programa',
                value: <>S{week}<Unit>/{activeProgram.duration_weeks}</Unit></>,
                tone: isExpired ? 'red' : 'neutral',
                sub: isExpired
                    ? <span className="text-red-600 dark:text-red-400">expirado</span>
                    : `termina ${endDate}`,
            })
        }

        return out
    }, [historySummary, recentSessions, weeklyAdherence, activeProgram])

    if (cells.length === 0) return null

    const gridClass = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-2 md:grid-cols-4',
        5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
        6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
    }[cells.length] ?? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'

    return (
        <div
            data-onboarding="student-history-summary"
            className={`grid ${gridClass} gap-px rounded-panel border border-k-border-subtle bg-k-border-subtle overflow-hidden`}
        >
            {cells.map(cell => (
                <div key={cell.key} className="bg-surface-card px-5 py-4 flex flex-col gap-1 min-w-0">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        {cell.label}
                    </span>
                    <p className={`text-[26px] leading-tight font-bold tracking-tight tabular-nums ${toneClass(cell.tone)}`}>
                        {cell.value}
                    </p>
                    {cell.sub && (
                        <span className="text-[11.5px] text-k-text-tertiary tabular-nums truncate">{cell.sub}</span>
                    )}
                </div>
            ))}
        </div>
    )
}
