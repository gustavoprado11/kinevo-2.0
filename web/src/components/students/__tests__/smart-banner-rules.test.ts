import { describe, it, expect } from 'vitest'
import {
    pickBanner,
    daysSinceLastSession,
    avgRate,
    avgRpe,
    daysToProgramEnd,
    avgTonnageChange,
    type BannerContext,
} from '../smart-banner-rules'

const NOW = new Date('2026-05-08T12:00:00Z')

function isoNDaysAgo(n: number): string {
    return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

function baseCtx(overrides: Partial<BannerContext> = {}): BannerContext {
    return {
        studentName: 'Ana Lima',
        studentPhone: null,
        activeProgram: {
            status: 'active',
            started_at: isoNDaysAgo(14),
            duration_weeks: 8,
        },
        historySummary: {
            totalSessions: 10,
            lastSessionDate: isoNDaysAgo(1),
            completedThisWeek: 3,
            expectedPerWeek: 4,
            streak: 0,
        },
        recentSessions: [],
        tonnageMap: {},
        weeklyAdherence: [],
        financialStatus: 'active',
        hasPendingForms: false,
        daysUntilReassessment: null,
        now: NOW,
        ...overrides,
    }
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

describe('helpers', () => {
    describe('daysSinceLastSession', () => {
        it('retorna null quando lastSessionDate é null', () => {
            expect(daysSinceLastSession(null, NOW)).toBeNull()
        })
        it('retorna 0 para hoje', () => {
            expect(daysSinceLastSession(NOW.toISOString(), NOW)).toBe(0)
        })
        it('retorna 5 quando 5 dias atrás', () => {
            expect(daysSinceLastSession(isoNDaysAgo(5), NOW)).toBe(5)
        })
    })

    describe('avgRate', () => {
        it('retorna null para array vazio', () => {
            expect(avgRate([], 4)).toBeNull()
        })
        it('normaliza 0–1 para 0–100', () => {
            expect(avgRate([{ rate: 0.4 }, { rate: 0.8 }], 4)).toBe(60)
        })
        it('mantém 0–100 sem normalizar', () => {
            expect(avgRate([{ rate: 60 }, { rate: 90 }], 4)).toBe(75)
        })
        it('limita às últimas N entradas', () => {
            expect(
                avgRate(
                    [{ rate: 100 }, { rate: 100 }, { rate: 0 }, { rate: 0 }],
                    2,
                ),
            ).toBe(0)
        })
    })

    describe('avgRpe', () => {
        it('ignora null e ≤ 0', () => {
            expect(
                avgRpe(
                    [{ rpe: null }, { rpe: 0 }, { rpe: 7 }, { rpe: 8 }],
                    4,
                ),
            ).toBe(7.5)
        })
        it('retorna null se nada válido', () => {
            expect(avgRpe([{ rpe: null }, { rpe: 0 }], 5)).toBeNull()
        })
    })

    describe('daysToProgramEnd', () => {
        it('null sem started_at', () => {
            expect(daysToProgramEnd({ status: 'active', started_at: null, duration_weeks: 4 }, NOW)).toBeNull()
        })
        it('positivo quando ainda há tempo', () => {
            const r = daysToProgramEnd(
                { status: 'active', started_at: isoNDaysAgo(7), duration_weeks: 4 },
                NOW,
            )
            // 4 sem * 7 = 28d total; passaram 7 → restam 21.
            expect(r).toBe(21)
        })
    })

    describe('avgTonnageChange', () => {
        it('média das últimas N sessões válidas', () => {
            const sessions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
            const map = {
                a: { percentChange: 10 },
                b: { percentChange: 20 },
                c: { percentChange: null },
            }
            expect(avgTonnageChange(sessions, map, 3)).toBe(15)
        })
        it('null quando todas as últimas N são nulas', () => {
            expect(avgTonnageChange([{ id: 'a' }], { a: { percentChange: null } }, 3)).toBeNull()
        })
    })
})

// ──────────────────────────────────────────────────────────────────────
// pickBanner — 8 cenários + null
// ──────────────────────────────────────────────────────────────────────

describe('pickBanner', () => {
    it('retorna null para aluno saudável', () => {
        const banner = pickBanner(baseCtx())
        expect(banner).toBeNull()
    })

    it('CRITICAL churn_risk quando inativo ≥7d e adesão ≤50%', () => {
        const ctx = baseCtx({
            historySummary: {
                ...baseCtx().historySummary,
                lastSessionDate: isoNDaysAgo(20),
            },
            weeklyAdherence: [
                { week: 1, rate: 30 },
                { week: 2, rate: 30 },
            ],
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('churn_risk')
        expect(banner?.level).toBe('critical')
        expect(banner?.weight).toBe(100)
    })

    it('inclui WhatsApp como secundário quando há phone', () => {
        const ctx = baseCtx({
            studentPhone: '+5511999998888',
            historySummary: {
                ...baseCtx().historySummary,
                lastSessionDate: isoNDaysAgo(20),
            },
            weeklyAdherence: [
                { week: 1, rate: 30 },
                { week: 2, rate: 30 },
            ],
        })
        const banner = pickBanner(ctx)
        expect(banner?.secondary?.actionId).toBe('open_whatsapp')
    })

    it('CRITICAL program_expired', () => {
        const ctx = baseCtx({
            activeProgram: {
                status: 'expired',
                started_at: isoNDaysAgo(60),
                duration_weeks: 4,
            },
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('program_expired')
        expect(banner?.level).toBe('critical')
    })

    it('CRITICAL financial_overdue para statuses bloqueantes', () => {
        for (const status of ['expired', 'past_due', 'overdue']) {
            const banner = pickBanner(baseCtx({ financialStatus: status }))
            expect(banner?.key).toBe('financial_overdue')
        }
    })

    it('HIGH progression_ready quando RPE 7-8.5 e tonelagem subindo', () => {
        const ctx = baseCtx({
            recentSessions: [
                { id: 'a', rpe: 7 },
                { id: 'b', rpe: 8 },
                { id: 'c', rpe: 7.5 },
            ],
            tonnageMap: {
                a: { percentChange: 5 },
                b: { percentChange: 8 },
                c: { percentChange: 3 },
            },
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('progression_ready')
        expect(banner?.level).toBe('high')
    })

    it('HIGH reassessment_due quando dias restantes ≤7', () => {
        const ctx = baseCtx({ daysUntilReassessment: 3 })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('reassessment_due')
    })

    it('reassessment vencida (negativo) destaca no detail', () => {
        const ctx = baseCtx({ daysUntilReassessment: -2 })
        const banner = pickBanner(ctx)
        expect(banner?.title).toMatch(/vencida/i)
    })

    it('HIGH first_session_pending', () => {
        const ctx = baseCtx({
            historySummary: {
                ...baseCtx().historySummary,
                totalSessions: 0,
                lastSessionDate: null,
            },
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('first_session_pending')
    })

    it('INFO cycle_ending quando programa termina em ≤7d', () => {
        // 4 semanas * 7 = 28d; passaram 25 → restam 3 dias.
        const ctx = baseCtx({
            activeProgram: {
                status: 'active',
                started_at: isoNDaysAgo(25),
                duration_weeks: 4,
            },
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('cycle_ending')
        expect(banner?.level).toBe('info')
    })

    it('streak ≥3 sozinho não dispara nenhum banner (celebração vive na QuickMessageCard)', () => {
        const ctx = baseCtx({
            historySummary: { ...baseCtx().historySummary, streak: 5 },
        })
        expect(pickBanner(ctx)).toBeNull()
    })

    it('respeita prioridade: critical > high > info', () => {
        // Aluno com churn_risk + reassessment_due; deve vencer churn_risk.
        const ctx = baseCtx({
            historySummary: {
                ...baseCtx().historySummary,
                lastSessionDate: isoNDaysAgo(15),
            },
            weeklyAdherence: [
                { week: 1, rate: 20 },
                { week: 2, rate: 30 },
            ],
            daysUntilReassessment: 1,
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('churn_risk')
    })

    it('weight desempata dentro do mesmo level (critical 100 > 90 > 80)', () => {
        // program_expired (90) + financial_overdue (80) → vence program_expired.
        const ctx = baseCtx({
            activeProgram: {
                status: 'expired',
                started_at: isoNDaysAgo(60),
                duration_weeks: 4,
            },
            financialStatus: 'overdue',
        })
        const banner = pickBanner(ctx)
        expect(banner?.key).toBe('program_expired')
    })
})
