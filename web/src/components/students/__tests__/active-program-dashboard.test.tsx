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

describe('ActiveProgramDashboard — toolbar "Próximo"', () => {
    it('renderiza botão "Próximo" quando onAssignScheduled é passado', () => {
        const onAssignScheduled = vi.fn()
        render(<ActiveProgramDashboard {...baseProps} onAssignScheduled={onAssignScheduled} />)
        expect(screen.getByRole('button', { name: /Próximo/i })).toBeInTheDocument()
    })

    it('renderiza botão "Próximo" quando apenas onCreateScheduled é passado', () => {
        const onCreateScheduled = vi.fn()
        render(<ActiveProgramDashboard {...baseProps} onCreateScheduled={onCreateScheduled} />)
        expect(screen.getByRole('button', { name: /Próximo/i })).toBeInTheDocument()
    })

    it('NÃO renderiza botão "Próximo" quando ambos os callbacks são undefined (retrocompatibilidade)', () => {
        render(<ActiveProgramDashboard {...baseProps} />)
        expect(screen.queryByRole('button', { name: /Próximo/i })).not.toBeInTheDocument()
        // Mas as outras ações da toolbar continuam aparecendo.
        expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Trocar/i })).toBeInTheDocument()
    })

    it('clicar no botão "Próximo" abre o menu com 2 itens (Criar / Atribuir)', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onAssignScheduled={vi.fn()}
                onCreateScheduled={vi.fn()}
            />,
        )
        // Menu fechado por padrão.
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))

        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Criar novo programa/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Atribuir programa existente/i })).toBeInTheDocument()
    })

    it('"Criar novo programa" chama onCreateScheduled e fecha o menu', () => {
        const onCreateScheduled = vi.fn()
        const onAssignScheduled = vi.fn()
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onAssignScheduled={onAssignScheduled}
                onCreateScheduled={onCreateScheduled}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Criar novo programa/i }))

        expect(onCreateScheduled).toHaveBeenCalledTimes(1)
        expect(onAssignScheduled).not.toHaveBeenCalled()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('"Atribuir programa existente" chama onAssignScheduled e fecha o menu', () => {
        const onCreateScheduled = vi.fn()
        const onAssignScheduled = vi.fn()
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onAssignScheduled={onAssignScheduled}
                onCreateScheduled={onCreateScheduled}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))
        fireEvent.click(screen.getByRole('menuitem', { name: /Atribuir programa existente/i }))

        expect(onAssignScheduled).toHaveBeenCalledTimes(1)
        expect(onCreateScheduled).not.toHaveBeenCalled()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('só renderiza o item "Criar" quando apenas onCreateScheduled é passado', () => {
        render(<ActiveProgramDashboard {...baseProps} onCreateScheduled={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))
        expect(screen.getByRole('menuitem', { name: /Criar novo programa/i })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: /Atribuir/i })).not.toBeInTheDocument()
    })

    it('só renderiza o item "Atribuir" quando apenas onAssignScheduled é passado', () => {
        render(<ActiveProgramDashboard {...baseProps} onAssignScheduled={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))
        expect(screen.getByRole('menuitem', { name: /Atribuir programa existente/i })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: /Criar novo/i })).not.toBeInTheDocument()
    })

    it('clicar fora do menu fecha-o', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onAssignScheduled={vi.fn()}
                onCreateScheduled={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))
        expect(screen.getByRole('menu')).toBeInTheDocument()

        // mousedown fora do componente — listener escuta document.mousedown.
        fireEvent.mouseDown(document.body)

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('Escape fecha o menu', () => {
        render(
            <ActiveProgramDashboard
                {...baseProps}
                onAssignScheduled={vi.fn()}
                onCreateScheduled={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))
        expect(screen.getByRole('menu')).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
})
