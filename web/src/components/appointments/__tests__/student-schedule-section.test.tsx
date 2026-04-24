import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StudentScheduleSection } from '../student-schedule-section'

// Mock the edit modal so we don't instantiate it
vi.mock('../edit-appointment-modal', () => ({
    EditAppointmentModal: ({ isOpen, rule }: { isOpen: boolean; rule: { id: string } }) =>
        isOpen ? <div data-testid="edit-modal">editing:{rule.id}</div> : null,
}))

// Mock the group card to avoid rendering its internals here
vi.mock('../recurring-group-card', () => ({
    RecurringGroupCard: ({ slots }: { slots: { id: string; group_id: string | null }[] }) => (
        <div data-testid="group-card">
            group:{slots[0]?.group_id}|slots:{slots.length}
        </div>
    ),
}))

const cancelActionMock = vi.fn()
vi.mock('@/actions/appointments/cancel-recurring', () => ({
    cancelRecurringAppointment: (...args: unknown[]) => cancelActionMock(...args),
}))

const cancelAllActionMock = vi.fn()
vi.mock('@/actions/appointments/cancel-all-for-student', () => ({
    cancelAllAppointmentsForStudent: (...args: unknown[]) => cancelAllActionMock(...args),
}))

// Chainable browser supabase mock
let queryResponse: { data: unknown; error: unknown } = { data: [], error: null }
vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: () => {
            const chain = {
                select: () => chain,
                eq: () => chain,
                order: () => chain,
                then: (resolve: (v: typeof queryResponse) => unknown) =>
                    Promise.resolve(queryResponse).then(resolve),
            }
            return chain
        },
    }),
}))

function makeRule(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'ra-1',
        trainer_id: 'trainer-1',
        student_id: 'student-1',
        day_of_week: 2,
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-07',
        ends_on: null,
        status: 'active',
        notes: null,
        group_id: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        ...overrides,
    }
}

describe('StudentScheduleSection', () => {
    beforeEach(() => {
        queryResponse = { data: [], error: null }
        cancelActionMock.mockReset()
        cancelAllActionMock.mockReset()
    })

    it('mostra empty state quando aluno não tem rotinas', async () => {
        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByText(/Nenhuma rotina cadastrada/i)).toBeInTheDocument()
        })
    })

    it('renderiza lista de rotinas ativas', async () => {
        queryResponse = {
            data: [
                makeRule({ id: 'ra-1', day_of_week: 2, start_time: '07:00' }),
                makeRule({ id: 'ra-2', day_of_week: 4, start_time: '18:30' }),
            ],
            error: null,
        }
        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByText(/Terça às 07:00/i)).toBeInTheDocument()
        })
        expect(screen.getByText(/Quinta às 18:30/i)).toBeInTheDocument()
    })

    it('abre modal de edição ao clicar em Editar', async () => {
        queryResponse = { data: [makeRule()], error: null }
        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByText(/Terça às 07:00/i)).toBeInTheDocument()
        })
        fireEvent.click(screen.getByLabelText(/Editar rotina/i))
        expect(screen.getByTestId('edit-modal')).toHaveTextContent('editing:ra-1')
    })

    it('agrupa rotinas com mesmo group_id em um RecurringGroupCard', async () => {
        queryResponse = {
            data: [
                makeRule({ id: 'ra-a', day_of_week: 1, group_id: 'group-1' }),
                makeRule({ id: 'ra-b', day_of_week: 3, group_id: 'group-1' }),
                makeRule({ id: 'ra-solo', day_of_week: 6, group_id: null }),
            ],
            error: null,
        }
        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByTestId('group-card')).toHaveTextContent('group:group-1|slots:2')
        })
        // O solo continua como card individual
        expect(screen.getByText(/Sábado às 07:00/i)).toBeInTheDocument()
    })

    it('NÃO mostra botão "Encerrar todos" quando aluno não tem rotinas', async () => {
        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByText(/Nenhuma rotina cadastrada/i)).toBeInTheDocument()
        })
        expect(
            screen.queryByRole('button', { name: /Encerrar todos/i }),
        ).not.toBeInTheDocument()
    })

    it('mostra botão "Encerrar todos" e chama cancelAllAppointmentsForStudent ao confirmar', async () => {
        queryResponse = {
            data: [
                makeRule({ id: 'ra-1' }),
                makeRule({ id: 'ra-2', day_of_week: 4 }),
            ],
            error: null,
        }
        cancelAllActionMock.mockResolvedValueOnce({
            success: true,
            data: { canceledCount: 2 },
        })

        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByText(/Terça às 07:00/i)).toBeInTheDocument()
        })

        const endAllBtn = screen.getByRole('button', { name: /Encerrar todos/i })
        expect(endAllBtn).toBeInTheDocument()

        fireEvent.click(endAllBtn)
        expect(screen.getByText(/Encerrar todos os agendamentos\?/i)).toBeInTheDocument()
        // contagem correta no body ("<strong>2</strong> rotinas ativas")
        expect(screen.getByText(/rotinas ativas/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Encerrar tudo/i }))
        await waitFor(() => {
            expect(cancelAllActionMock).toHaveBeenCalledWith({ studentId: 'student-1' })
        })
    })

    it('abre confirmação ao clicar em Encerrar rotina e chama action após confirmar', async () => {
        queryResponse = { data: [makeRule()], error: null }
        cancelActionMock.mockResolvedValueOnce({ success: true })

        render(<StudentScheduleSection studentId="student-1" />)
        await waitFor(() => {
            expect(screen.getByText(/Terça às 07:00/i)).toBeInTheDocument()
        })

        fireEvent.click(screen.getByLabelText(/Encerrar rotina/i))
        expect(screen.getByText(/Encerrar rotina\?/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Sim, encerrar/i }))
        await waitFor(() => {
            expect(cancelActionMock).toHaveBeenCalledWith({ id: 'ra-1' })
        })
    })
})
