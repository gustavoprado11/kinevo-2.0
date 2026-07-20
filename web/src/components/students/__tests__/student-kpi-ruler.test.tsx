import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StudentKpiRuler } from '../student-kpi-ruler'

const baseSummary = {
    totalSessions: 12,
    lastSessionDate: null as string | null,
    completedThisWeek: 2,
    expectedPerWeek: 4,
    streak: 3,
}

const activeProgram = {
    status: 'active',
    duration_weeks: 8,
    started_at: '2026-06-29T00:00:00Z',
}

function daysAgo(n: number): string {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('StudentKpiRuler', () => {
    it('renderiza célula "Esta semana" com progresso e faltantes', () => {
        render(
            <StudentKpiRuler
                historySummary={baseSummary}
                recentSessions={[]}
                weeklyAdherence={[]}
                activeProgram={activeProgram}
            />,
        )
        expect(screen.getByText('Esta semana')).toBeInTheDocument()
        expect(screen.getByText('faltam 2 treinos')).toBeInTheDocument()
    })

    it('último treino fica âmbar a partir de 3 dias e vermelho a partir de 7', () => {
        const { rerender } = render(
            <StudentKpiRuler
                historySummary={{ ...baseSummary, lastSessionDate: daysAgo(4) }}
                recentSessions={[]}
                weeklyAdherence={[]}
                activeProgram={activeProgram}
            />,
        )
        expect(screen.getByText('4').closest('p')?.className).toMatch(/text-amber-600/)

        rerender(
            <StudentKpiRuler
                historySummary={{ ...baseSummary, lastSessionDate: daysAgo(9) }}
                recentSessions={[]}
                weeklyAdherence={[]}
                activeProgram={activeProgram}
            />,
        )
        expect(screen.getByText('9').closest('p')?.className).toMatch(/text-red-600/)
    })

    it('normaliza adesão nas duas escalas (0–1 e 0–100)', () => {
        render(
            <StudentKpiRuler
                historySummary={baseSummary}
                recentSessions={[]}
                weeklyAdherence={[
                    { week: 1, rate: 0.8 },
                    { week: 2, rate: 80 },
                ]}
                activeProgram={activeProgram}
            />,
        )
        // (80 + 80) / 2 = 80% — se não normalizasse, daria 40%.
        expect(screen.getByText('Adesão · 4 sem')).toBeInTheDocument()
        expect(screen.getByText('80')).toBeInTheDocument()
    })

    it('PSE média só aparece com 2+ sessões com RPE', () => {
        const { rerender } = render(
            <StudentKpiRuler
                historySummary={baseSummary}
                recentSessions={[{ rpe: 8 }]}
                weeklyAdherence={[]}
                activeProgram={activeProgram}
            />,
        )
        expect(screen.queryByText('PSE média')).not.toBeInTheDocument()

        rerender(
            <StudentKpiRuler
                historySummary={baseSummary}
                recentSessions={[{ rpe: 8 }, { rpe: 9 }]}
                weeklyAdherence={[]}
                activeProgram={activeProgram}
            />,
        )
        expect(screen.getByText('PSE média')).toBeInTheDocument()
        expect(screen.getByText('8,5')).toBeInTheDocument()
    })

    it('sem programa e sem histórico, não renderiza nada', () => {
        const { container } = render(
            <StudentKpiRuler
                historySummary={{ ...baseSummary, totalSessions: 0 }}
                recentSessions={[]}
                weeklyAdherence={[]}
                activeProgram={null}
            />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('carrega a âncora do tour student-history-summary', () => {
        const { container } = render(
            <StudentKpiRuler
                historySummary={baseSummary}
                recentSessions={[]}
                weeklyAdherence={[]}
                activeProgram={activeProgram}
            />,
        )
        expect(container.querySelector('[data-onboarding="student-history-summary"]')).toBeTruthy()
    })
})
