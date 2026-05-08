import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProgramHistorySection } from '../program-history-section'

vi.mock('../session-detail-sheet', () => ({
    SessionDetailSheet: () => null,
}))

function makeProgram(overrides: Partial<{
    id: string
    name: string
    sessions_count: number
    workouts_count: number
}> = {}) {
    return {
        id: overrides.id ?? 'p1',
        name: overrides.name ?? 'Programa Hipertrofia',
        description: null,
        started_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-02-01T00:00:00Z',
        duration_weeks: 4,
        workouts_count: overrides.workouts_count ?? 3,
        sessions_count: overrides.sessions_count ?? 12,
    }
}

describe('ProgramHistorySection', () => {
    it('mostra empty state quando não há programas', () => {
        render(<ProgramHistorySection programs={[]} />)
        expect(screen.getByText(/Nenhum programa concluído ainda/i)).toBeInTheDocument()
    })

    it('esconde programas com sessions_count === 0 por padrão', () => {
        render(
            <ProgramHistorySection
                programs={[
                    makeProgram({ id: 'p1', name: 'Programa Real', sessions_count: 12 }),
                    makeProgram({ id: 'p2', name: 'Programa Substituído', sessions_count: 0 }),
                ]}
            />,
        )
        expect(screen.getByText('Programa Real')).toBeInTheDocument()
        expect(screen.queryByText('Programa Substituído')).not.toBeInTheDocument()
    })

    it('mostra link "Mostrar N substituídos" com contagem correta', () => {
        render(
            <ProgramHistorySection
                programs={[
                    makeProgram({ id: 'p1', sessions_count: 12 }),
                    makeProgram({ id: 'p2', sessions_count: 0 }),
                    makeProgram({ id: 'p3', sessions_count: 0 }),
                    makeProgram({ id: 'p4', sessions_count: 0 }),
                ]}
            />,
        )
        expect(screen.getByText('Mostrar 3 substituídos')).toBeInTheDocument()
    })

    it('singular quando há apenas 1 substituído', () => {
        render(
            <ProgramHistorySection
                programs={[
                    makeProgram({ id: 'p1', sessions_count: 12 }),
                    makeProgram({ id: 'p2', sessions_count: 0 }),
                ]}
            />,
        )
        expect(screen.getByText('Mostrar 1 substituído')).toBeInTheDocument()
    })

    it('ao clicar no link, todos os programas aparecem', () => {
        render(
            <ProgramHistorySection
                programs={[
                    makeProgram({ id: 'p1', name: 'Programa Real', sessions_count: 12 }),
                    makeProgram({ id: 'p2', name: 'Programa Substituído', sessions_count: 0 }),
                ]}
            />,
        )
        fireEvent.click(screen.getByText('Mostrar 1 substituído'))
        expect(screen.getByText('Programa Real')).toBeInTheDocument()
        expect(screen.getByText('Programa Substituído')).toBeInTheDocument()
        // Label muda para "Ocultar".
        expect(screen.getByText('Ocultar substituídos')).toBeInTheDocument()
    })

    it('não mostra link quando não há substituídos', () => {
        render(
            <ProgramHistorySection
                programs={[
                    makeProgram({ id: 'p1', sessions_count: 12 }),
                    makeProgram({ id: 'p2', sessions_count: 8 }),
                ]}
            />,
        )
        expect(screen.queryByText(/Mostrar.*substituíd/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/Ocultar substituídos/i)).not.toBeInTheDocument()
    })

    it('mostra empty state especial + botão quando todos os programas são substituídos', () => {
        // Caso degenerado: só há substituídos, mas o usuário ainda pode revelar.
        render(
            <ProgramHistorySection
                programs={[
                    makeProgram({ id: 'p1', sessions_count: 0 }),
                    makeProgram({ id: 'p2', sessions_count: 0 }),
                ]}
            />,
        )
        expect(screen.getByText(/Nenhum programa concluído ainda/i)).toBeInTheDocument()
        const reveal = screen.getByText('Mostrar 2 substituídos')
        fireEvent.click(reveal)
        // Após clicar, os 2 substituídos aparecem.
        expect(screen.getAllByText('Programa Hipertrofia')).toHaveLength(2)
    })
})
