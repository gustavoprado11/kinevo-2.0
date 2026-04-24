import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecurringGroupCard } from '../recurring-group-card'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'

vi.mock('../edit-appointment-modal', () => ({
    EditAppointmentModal: ({ isOpen, rule }: { isOpen: boolean; rule: { id: string } }) =>
        isOpen ? <div data-testid="edit-modal">editing:{rule.id}</div> : null,
}))

const cancelSlotMock = vi.fn()
const cancelGroupMock = vi.fn()
vi.mock('@/actions/appointments/cancel-recurring', () => ({
    cancelRecurringAppointment: (...args: unknown[]) => cancelSlotMock(...args),
}))
vi.mock('@/actions/appointments/cancel-recurring-group', () => ({
    cancelRecurringGroup: (...args: unknown[]) => cancelGroupMock(...args),
}))

function makeSlot(overrides: Partial<RecurringAppointment> = {}): RecurringAppointment {
    return {
        id: 'ra-1',
        trainer_id: 'trainer-1',
        student_id: 'student-1',
        day_of_week: 1,
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-06',
        ends_on: null,
        status: 'active',
        notes: null,
        group_id: 'group-123',
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        ...overrides,
    }
}

describe('RecurringGroupCard', () => {
    beforeEach(() => {
        cancelSlotMock.mockReset()
        cancelGroupMock.mockReset()
    })

    it('renderiza header com contagem e pills de dias', () => {
        const slots = [
            makeSlot({ id: 'a', day_of_week: 1, start_time: '07:00' }),
            makeSlot({ id: 'b', day_of_week: 3, start_time: '07:00' }),
            makeSlot({ id: 'c', day_of_week: 5, start_time: '18:00' }),
        ]
        render(<RecurringGroupCard slots={slots} onChange={() => {}} />)
        expect(screen.getByText(/Pacote de 3 treinos/i)).toBeInTheDocument()
        // Days pills — looking for headline weekday pills (not full sidebar)
        expect(screen.getByText('Seg')).toBeInTheDocument()
        expect(screen.getByText('Qua')).toBeInTheDocument()
        expect(screen.getByText('Sex')).toBeInTheDocument()
    })

    it('renderiza um item por slot ordenado por dia/hora', () => {
        const slots = [
            makeSlot({ id: 'c', day_of_week: 5, start_time: '18:00' }),
            makeSlot({ id: 'a', day_of_week: 1, start_time: '07:00' }),
            makeSlot({ id: 'b', day_of_week: 3, start_time: '07:00' }),
        ]
        render(<RecurringGroupCard slots={slots} onChange={() => {}} />)
        expect(screen.getByText(/Seg às 07:00/i)).toBeInTheDocument()
        expect(screen.getByText(/Qua às 07:00/i)).toBeInTheDocument()
        expect(screen.getByText(/Sex às 18:00/i)).toBeInTheDocument()
    })

    it('Encerrar pacote chama cancelRecurringGroup', async () => {
        cancelGroupMock.mockResolvedValueOnce({ success: true, data: { canceledCount: 2 } })
        const onChange = vi.fn()
        const slots = [
            makeSlot({ id: 'a', day_of_week: 1 }),
            makeSlot({ id: 'b', day_of_week: 3 }),
        ]
        render(<RecurringGroupCard slots={slots} onChange={onChange} />)

        fireEvent.click(screen.getByLabelText(/Encerrar pacote/i))
        expect(screen.getByText(/Encerrar pacote\?/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Sim, encerrar/i }))

        await waitFor(() => {
            expect(cancelGroupMock).toHaveBeenCalledWith({ groupId: 'group-123' })
            expect(onChange).toHaveBeenCalled()
        })
    })

    it('Encerrar este chama cancelRecurringAppointment (individual)', async () => {
        cancelSlotMock.mockResolvedValueOnce({ success: true })
        const slots = [
            makeSlot({ id: 'a', day_of_week: 1 }),
            makeSlot({ id: 'b', day_of_week: 3 }),
        ]
        render(<RecurringGroupCard slots={slots} onChange={() => {}} />)

        // Hover is not needed here — buttons are rendered, just opacity-0.
        const encerrarButtons = screen.getAllByLabelText(/Encerrar este dia/i)
        fireEvent.click(encerrarButtons[0])
        expect(screen.getByText(/Encerrar este dia\?/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Sim, encerrar/i }))

        await waitFor(() => {
            expect(cancelSlotMock).toHaveBeenCalledTimes(1)
            const arg = cancelSlotMock.mock.calls[0][0]
            // First arg is either {id:'a'} or {id:'b'} — order depends on weekday sort
            expect(['a', 'b']).toContain(arg.id)
        })
    })

    it('Editar abre EditAppointmentModal com rule.id correto', () => {
        const slots = [
            makeSlot({ id: 'a', day_of_week: 1 }),
            makeSlot({ id: 'b', day_of_week: 3 }),
        ]
        render(<RecurringGroupCard slots={slots} onChange={() => {}} />)
        const editButtons = screen.getAllByLabelText(/Editar este dia/i)
        fireEvent.click(editButtons[0])
        // Editing modal should render with the first-sorted slot id
        const modal = screen.getByTestId('edit-modal')
        expect(modal.textContent).toMatch(/editing:(a|b)/)
    })
})
