import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StudentStatusBar } from '../student-status-bar'

// ── Fixtures ──

const todayIso = () => new Date().toISOString()
const daysAgoIso = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const baseProps = {
    historySummary: {
        totalSessions: 20,
        lastSessionDate: daysAgoIso(1),
        completedThisWeek: 3,
        expectedPerWeek: 4,
        streak: 3,
    },
    recentSessions: [] as any[],
    tonnageMap: {} as Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>,
    weeklyAdherence: [
        { week: 1, rate: 85 },
        { week: 2, rate: 90 },
    ],
    activeProgram: {
        status: 'active',
        duration_weeks: 8,
        started_at: daysAgoIso(14),
    },
    financialStatus: 'active',
    hasPendingForms: false,
    studentName: 'Gustavo Prado',
    studentPhone: null,
    onSendMessage: vi.fn(),
}

describe('StudentStatusBar', () => {
    it('renders operational stats (esta semana + último treino)', () => {
        const { container } = render(<StudentStatusBar {...baseProps} />)
        const text = container.textContent || ''
        expect(text).toContain('3/4')
        expect(text).toContain('esta semana')
        expect(text).toContain('último treino')
    })

    it('shows "Meta atingida!" label when weekly target is met', () => {
        const { container } = render(
            <StudentStatusBar
                {...baseProps}
                historySummary={{ ...baseProps.historySummary, completedThisWeek: 4 }}
            />
        )
        const text = container.textContent || ''
        expect(text).toContain('Meta atingida!')
    })

    it('shows "Sem treino há N dias" chip when student has been inactive ≥3 days', () => {
        const { container } = render(
            <StudentStatusBar
                {...baseProps}
                historySummary={{ ...baseProps.historySummary, lastSessionDate: daysAgoIso(5) }}
            />
        )
        const text = container.textContent || ''
        expect(text).toContain('Sem treino há 5 dias')
    })

    it('shows "ainda não iniciou" chip when student has 0 sessions and an active program', () => {
        const { container } = render(
            <StudentStatusBar
                {...baseProps}
                historySummary={{
                    totalSessions: 0,
                    lastSessionDate: null,
                    completedThisWeek: 0,
                    expectedPerWeek: 4,
                    streak: 0,
                }}
            />
        )
        const text = container.textContent || ''
        expect(text).toContain('ainda não iniciou')
    })

    it('shows Mensagem CTA when an inactivity chip is present', () => {
        const { getByText } = render(
            <StudentStatusBar
                {...baseProps}
                historySummary={{ ...baseProps.historySummary, lastSessionDate: daysAgoIso(5) }}
            />
        )
        const btn = getByText('Mensagem')
        expect(btn).toBeTruthy()
    })

    it('does NOT show Mensagem CTA when student is on track', () => {
        const { queryByText } = render(<StudentStatusBar {...baseProps} />)
        // Student trained yesterday, no inactivity chip → no CTA
        expect(queryByText('Mensagem')).toBeNull()
    })

    it('calls onSendMessage when Mensagem CTA is clicked', () => {
        const onSendMessage = vi.fn()
        const { getByText } = render(
            <StudentStatusBar
                {...baseProps}
                historySummary={{ ...baseProps.historySummary, lastSessionDate: daysAgoIso(5) }}
                onSendMessage={onSendMessage}
            />
        )
        fireEvent.click(getByText('Mensagem'))
        expect(onSendMessage).toHaveBeenCalledOnce()
    })

    it('shows PSE chip when average RPE is elevated', () => {
        const { container } = render(
            <StudentStatusBar
                {...baseProps}
                recentSessions={[
                    { id: '1', rpe: 8, completed_at: todayIso() },
                    { id: '2', rpe: 8.5, completed_at: todayIso() },
                ]}
            />
        )
        expect(container.textContent).toContain('PSE')
    })

    it('shows Adesão chip when weekly adherence drops below 70%', () => {
        const { container } = render(
            <StudentStatusBar
                {...baseProps}
                weeklyAdherence={[
                    { week: 1, rate: 45 },
                    { week: 2, rate: 50 },
                ]}
            />
        )
        expect(container.textContent).toContain('Adesão')
    })

    it('normalizes 0–1 adherence values to 0–100 before comparing', () => {
        // Some callers pass rates as fractions (0.3, 0.4). They should still
        // trigger the < 50% critical chip.
        const { container } = render(
            <StudentStatusBar
                {...baseProps}
                weeklyAdherence={[
                    { week: 1, rate: 0.3 },
                    { week: 2, rate: 0.4 },
                ]}
            />
        )
        const text = container.textContent || ''
        expect(text).toContain('Adesão')
        // And it should be rendered as a percentage, not as 0.35
        expect(text).toMatch(/Adesão\s*\d+%/)
    })

    it('shows Financeiro chip when status is overdue', () => {
        const { container } = render(
            <StudentStatusBar {...baseProps} financialStatus="overdue" />
        )
        expect(container.textContent).toContain('Financeiro')
    })

    it('shows Avaliações chip when there are pending forms', () => {
        const { container } = render(
            <StudentStatusBar {...baseProps} hasPendingForms={true} />
        )
        expect(container.textContent).toContain('Avaliações')
    })

    it('shows "Sem programa ativo" chip when there is no active program', () => {
        const { container } = render(
            <StudentStatusBar {...baseProps} activeProgram={null} />
        )
        expect(container.textContent).toContain('Sem programa ativo')
    })

    it('expands the detail row when a chip is clicked', () => {
        const { container, getByText } = render(
            <StudentStatusBar
                {...baseProps}
                recentSessions={[
                    { id: '1', rpe: 9, completed_at: todayIso() },
                    { id: '2', rpe: 10, completed_at: todayIso() },
                ]}
            />
        )
        // Click the PSE chip
        const chip = getByText(/PSE/)
        fireEvent.click(chip)
        // Detail text should now be visible
        expect(container.textContent).toContain('overtraining')
    })
})
