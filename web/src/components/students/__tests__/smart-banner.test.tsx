import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SmartBanner } from '../smart-banner'
import type { BannerContext } from '../smart-banner-rules'

const trackMock = vi.fn()
vi.mock('@/lib/analytics', () => ({
    track: (...args: unknown[]) => trackMock(...args),
}))

const NOW = new Date('2026-05-08T12:00:00Z')
function isoNDaysAgo(n: number): string {
    return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

function ctx(overrides: Partial<BannerContext> = {}): BannerContext {
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

beforeEach(() => {
    trackMock.mockReset()
})

describe('SmartBanner', () => {
    it('retorna null quando pickBanner retorna null', () => {
        const { container } = render(
            <SmartBanner studentId="s1" context={ctx()} onAction={vi.fn()} />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('renderiza variante crítica para churn_risk', () => {
        const banner = render(
            <SmartBanner
                studentId="s1"
                context={ctx({
                    studentPhone: '+5511999998888',
                    historySummary: {
                        totalSessions: 10,
                        lastSessionDate: isoNDaysAgo(20),
                        completedThisWeek: 0,
                        expectedPerWeek: 4,
                        streak: 0,
                    },
                    weeklyAdherence: [
                        { week: 1, rate: 30 },
                        { week: 2, rate: 30 },
                    ],
                })}
                onAction={vi.fn()}
            />,
        )
        const node = banner.getByTestId('smart-banner')
        expect(node).toHaveAttribute('data-banner-key', 'churn_risk')
        expect(node).toHaveAttribute('data-banner-level', 'critical')
        // Botões esperados:
        expect(banner.getByRole('button', { name: /Enviar mensagem/i })).toBeInTheDocument()
        expect(banner.getByRole('button', { name: /WhatsApp/i })).toBeInTheDocument()
    })

    it('renderiza variante info para cycle_ending', () => {
        const banner = render(
            <SmartBanner
                studentId="s1"
                context={ctx({
                    // 4 semanas de programa, passaram 25 dias → restam 3.
                    activeProgram: {
                        status: 'active',
                        started_at: isoNDaysAgo(25),
                        duration_weeks: 4,
                    },
                })}
                onAction={vi.fn()}
            />,
        )
        const node = banner.getByTestId('smart-banner')
        expect(node).toHaveAttribute('data-banner-key', 'cycle_ending')
        expect(node).toHaveAttribute('data-banner-level', 'info')
    })

    it('chama track("smart_banner_view", ...) no mount com banner ativo', () => {
        render(
            <SmartBanner
                studentId="student-42"
                context={ctx({
                    historySummary: {
                        totalSessions: 10,
                        lastSessionDate: isoNDaysAgo(20),
                        completedThisWeek: 0,
                        expectedPerWeek: 4,
                        streak: 0,
                    },
                    weeklyAdherence: [
                        { week: 1, rate: 30 },
                        { week: 2, rate: 30 },
                    ],
                })}
                onAction={vi.fn()}
            />,
        )
        expect(trackMock).toHaveBeenCalledWith(
            'smart_banner_view',
            expect.objectContaining({
                student_id: 'student-42',
                banner_key: 'churn_risk',
                banner_level: 'critical',
            }),
        )
    })

    it('NÃO chama track("smart_banner_view") quando não há banner', () => {
        render(<SmartBanner studentId="s1" context={ctx()} onAction={vi.fn()} />)
        expect(trackMock).not.toHaveBeenCalled()
    })

    it('dispara onAction("send_message") ao clicar no botão primário e tracka', () => {
        const onAction = vi.fn()
        render(
            <SmartBanner
                studentId="student-42"
                context={ctx({
                    historySummary: {
                        totalSessions: 10,
                        lastSessionDate: isoNDaysAgo(20),
                        completedThisWeek: 0,
                        expectedPerWeek: 4,
                        streak: 0,
                    },
                    weeklyAdherence: [
                        { week: 1, rate: 30 },
                        { week: 2, rate: 30 },
                    ],
                })}
                onAction={onAction}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Enviar mensagem/i }))
        expect(onAction).toHaveBeenCalledWith('send_message')
        expect(trackMock).toHaveBeenCalledWith(
            'smart_banner_action',
            expect.objectContaining({
                student_id: 'student-42',
                banner_key: 'churn_risk',
                action_role: 'primary',
                action_id: 'send_message',
            }),
        )
    })
})
