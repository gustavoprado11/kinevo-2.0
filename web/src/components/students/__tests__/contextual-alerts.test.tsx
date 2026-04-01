import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ContextualAlerts } from '../contextual-alerts'

const baseProps = {
    historySummary: {
        totalSessions: 20,
        lastSessionDate: new Date().toISOString(),
        completedThisWeek: 3,
        expectedPerWeek: 4,
        streak: 3,
    },
    recentSessions: [] as any[],
    tonnageMap: {} as Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>,
    weeklyAdherence: [
        { week: 1, rate: 90 },
        { week: 2, rate: 85 },
    ],
    activeProgram: {
        status: 'active',
        duration_weeks: 8,
        started_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
}

describe('ContextualAlerts', () => {
    it('renders nothing when there are no alerts', () => {
        const { container } = render(<ContextualAlerts {...baseProps} />)
        // With healthy data and no special conditions, returns null
        expect(container.firstChild).toBeNull()
    })

    it('shows high RPE alert when average RPE >= 9', () => {
        const { container } = render(
            <ContextualAlerts
                {...baseProps}
                recentSessions={[
                    { id: '1', rpe: 9, completed_at: new Date().toISOString() },
                    { id: '2', rpe: 10, completed_at: new Date().toISOString() },
                ]}
            />
        )
        expect(container.textContent).toContain('PSE')
    })

    it('shows load decrease alert when tonnage drops significantly', () => {
        const { container } = render(
            <ContextualAlerts
                {...baseProps}
                tonnageMap={{
                    'ex-1': { tonnage: 5000, previousTonnage: 8000, percentChange: -37.5 },
                    'ex-2': { tonnage: 4000, previousTonnage: 6000, percentChange: -33 },
                }}
            />
        )
        // Needs >= 2 entries with percentChange and avgChange <= -10
        expect(container.textContent).toContain('Carga')
    })

    it('shows adherence warning when rate is below 50%', () => {
        const { container } = render(
            <ContextualAlerts
                {...baseProps}
                weeklyAdherence={[
                    { week: 1, rate: 40 },
                    { week: 2, rate: 35 },
                ]}
            />
        )
        expect(container.textContent).toContain('Adesão')
    })

    it('shows program ending soon alert', () => {
        // Program started 7.5 weeks ago with 8-week duration = ends in ~3.5 days
        const startedAt = new Date(Date.now() - 53 * 24 * 60 * 60 * 1000).toISOString()
        const { container } = render(
            <ContextualAlerts
                {...baseProps}
                activeProgram={{
                    status: 'active',
                    duration_weeks: 8,
                    started_at: startedAt,
                }}
            />
        )
        expect(container.textContent).toContain('Programa termina')
    })

    it('handles null activeProgram gracefully', () => {
        const { container } = render(
            <ContextualAlerts {...baseProps} activeProgram={null} />
        )
        // Returns null because early return on !activeProgram
        expect(container.firstChild).toBeNull()
    })

    it('shows elevated RPE warning for average between 8 and 9', () => {
        const { container } = render(
            <ContextualAlerts
                {...baseProps}
                recentSessions={[
                    { id: '1', rpe: 8, completed_at: new Date().toISOString() },
                    { id: '2', rpe: 8.5, completed_at: new Date().toISOString() },
                ]}
            />
        )
        expect(container.textContent).toContain('PSE média elevada')
    })
})
