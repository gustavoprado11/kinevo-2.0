import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveProgramDashboard } from '../active-program-dashboard'

// Mocks dos filhos com fetch/effects internos — não importam pra testes da
// toolbar e simplificam o ambiente jsdom.
vi.mock('../program-calendar', () => ({
    ProgramCalendar: () => <div data-testid="program-calendar" />,
}))
vi.mock('../adherence-trend-strip', () => ({
    AdherenceTrendStrip: () => <div data-testid="adherence-trend-strip" />,
}))
vi.mock('../session-detail-sheet', () => ({
    SessionDetailSheet: () => null,
}))

const baseProgram = {
    id: 'program-1',
    name: 'Hipertrofia 8 semanas',
    description: null,
    status: 'active' as const,
    duration_weeks: 8,
    current_week: 3,
    started_at: '2026-04-01T00:00:00Z',
    created_at: '2026-04-01T00:00:00Z',
    assigned_workouts: [
        { id: 'w1', name: 'A', scheduled_days: [1, 3, 5] },
    ],
}

const baseSummary = {
    totalSessions: 8,
    lastSessionDate: '2026-05-07T00:00:00Z',
    completedThisWeek: 2,
    streak: 1,
}

const baseProps = {
    program: baseProgram,
    summary: baseSummary,
    recentSessions: [],
    calendarInitialSessions: [],
    weeklyAdherence: [],
    tonnageMap: {},
    hasActiveProgram: true,
    studentId: 'student-1',
}

describe('ActiveProgramDashboard — toolbar hierarchy', () => {
    it('Editar é o botão primário (estilo violet sólido)', () => {
        render(<ActiveProgramDashboard {...baseProps} onEditProgram={vi.fn()} />)
        const edit = screen.getByTestId('toolbar-edit')
        expect(edit).toHaveTextContent(/Editar/i)
        expect(edit.className).toMatch(/bg-violet-600/)
    })

    it('Botão "Próximo" não existe mais como elemento direto da toolbar', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onAssignScheduled={vi.fn()}
                onCreateScheduled={vi.fn()}
            />,
        )
        // O label "Próximo" foi movido pro menu como "Criar próximo programa"
        // / "Atribuir próximo programa". Não deve haver botão isolado.
        expect(screen.queryByRole('button', { name: /^Próximo$/i })).not.toBeInTheDocument()
    })

    it('Prorrogar aparece somente quando status === "expired"', () => {
        const onExtendProgram = vi.fn()
        const { rerender } = render(
            <ActiveProgramDashboard {...baseProps} onExtendProgram={onExtendProgram} />,
        )
        expect(screen.queryByRole('button', { name: /Prorrogar/i })).not.toBeInTheDocument()

        rerender(
            <ActiveProgramDashboard
                {...baseProps}
                program={{ ...baseProgram, status: 'expired' as const }}
                onExtendProgram={onExtendProgram}
            />,
        )
        expect(screen.getByRole('button', { name: /Prorrogar/i })).toBeInTheDocument()
    })

    it('Relatório aparece quando onViewReport é passado', () => {
        render(<ActiveProgramDashboard {...baseProps} onViewReport={vi.fn()} />)
        expect(screen.getByRole('button', { name: /Relatório/i })).toBeInTheDocument()
    })

    it('Menu overflow abre ao clicar e mostra 4 itens com programa active', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCompleteProgram={vi.fn()}
                onAssignProgram={vi.fn()}
                onCreateScheduled={vi.fn()}
                onAssignScheduled={vi.fn()}
            />,
        )
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))

        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Concluir programa/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Trocar programa/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Criar próximo programa/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Atribuir próximo programa/i })).toBeInTheDocument()
    })

    it('"Concluir programa" chama onCompleteProgram e fecha o menu', () => {
        const onCompleteProgram = vi.fn()
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCompleteProgram={onCompleteProgram}
                onAssignProgram={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Concluir programa/i }))
        expect(onCompleteProgram).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('"Trocar programa" chama onAssignProgram', () => {
        const onAssignProgram = vi.fn()
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCompleteProgram={vi.fn()}
                onAssignProgram={onAssignProgram}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Trocar programa/i }))
        expect(onAssignProgram).toHaveBeenCalledTimes(1)
    })

    it('"Criar próximo programa" chama onCreateScheduled', () => {
        const onCreateScheduled = vi.fn()
        const onAssignScheduled = vi.fn()
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCreateScheduled={onCreateScheduled}
                onAssignScheduled={onAssignScheduled}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Criar próximo programa/i }))
        expect(onCreateScheduled).toHaveBeenCalledTimes(1)
        expect(onAssignScheduled).not.toHaveBeenCalled()
    })

    it('"Atribuir próximo programa" chama onAssignScheduled', () => {
        const onCreateScheduled = vi.fn()
        const onAssignScheduled = vi.fn()
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCreateScheduled={onCreateScheduled}
                onAssignScheduled={onAssignScheduled}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Atribuir próximo programa/i }))
        expect(onAssignScheduled).toHaveBeenCalledTimes(1)
        expect(onCreateScheduled).not.toHaveBeenCalled()
    })

    it('clicar fora fecha o menu', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCompleteProgram={vi.fn()}
                onAssignProgram={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))
        expect(screen.getByRole('menu')).toBeInTheDocument()

        fireEvent.mouseDown(document.body)

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('Escape fecha o menu', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onCompleteProgram={vi.fn()}
                onAssignProgram={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Mais ações/i }))
        expect(screen.getByRole('menu')).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
})
