import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { RescheduleOccurrenceModal } from '../reschedule-occurrence-modal'

const rescheduleMock = vi.fn()
vi.mock('@/actions/appointments/reschedule-occurrence', () => ({
    rescheduleOccurrence: (...args: unknown[]) => rescheduleMock(...args),
}))

function makeOcc(): AppointmentOccurrence {
    return {
        recurringAppointmentId: 'ra-1',
        groupId: null,
        studentId: 'st-1',
        trainerId: 'tr-1',
        date: '2026-04-24',
        startTime: '07:00',
        durationMinutes: 60,
        originalDate: '2026-04-24',
        status: 'scheduled',
        hasException: false,
        notes: null,
    }
}

describe('RescheduleOccurrenceModal', () => {
    beforeEach(() => {
        rescheduleMock.mockReset()
    })

    it('não renderiza quando isOpen=false', () => {
        const { container } = render(
            <RescheduleOccurrenceModal
                isOpen={false}
                onClose={() => {}}
                occurrence={makeOcc()}
                studentName="João"
            />,
        )
        expect(container.innerHTML).toBe('')
    })

    it('default scope = only_this', () => {
        render(
            <RescheduleOccurrenceModal
                isOpen
                onClose={() => {}}
                occurrence={makeOcc()}
                studentName="João"
            />,
        )
        const onlyThis = screen.getByRole('radio', { name: /Apenas esta/i })
        expect(onlyThis).toBeChecked()
    })

    it('submete com os valores atuais e scope only_this', async () => {
        rescheduleMock.mockResolvedValueOnce({ success: true })
        const onSuccess = vi.fn()

        render(
            <RescheduleOccurrenceModal
                isOpen
                onClose={() => {}}
                occurrence={makeOcc()}
                studentName="João"
                onSuccess={onSuccess}
            />,
        )

        // Muda a data e o horário
        fireEvent.change(screen.getByLabelText(/Nova data/i), {
            target: { value: '2026-04-25' },
        })
        fireEvent.change(screen.getByLabelText(/Novo horário/i), {
            target: { value: '08:30' },
        })

        fireEvent.click(screen.getByRole('button', { name: /^Remarcar$/i }))

        await waitFor(() => {
            expect(rescheduleMock).toHaveBeenCalledWith({
                recurringAppointmentId: 'ra-1',
                originalDate: '2026-04-24',
                newDate: '2026-04-25',
                newStartTime: '08:30',
                scope: 'only_this',
            })
            expect(onSuccess).toHaveBeenCalled()
        })
    })

    it('troca pra scope this_and_future ao clicar no radio', async () => {
        rescheduleMock.mockResolvedValueOnce({ success: true })
        render(
            <RescheduleOccurrenceModal
                isOpen
                onClose={() => {}}
                occurrence={makeOcc()}
                studentName="João"
            />,
        )
        fireEvent.click(screen.getByRole('radio', { name: /Esta e as próximas/i }))
        fireEvent.click(screen.getByRole('button', { name: /^Remarcar$/i }))

        await waitFor(() => {
            const call = rescheduleMock.mock.calls[0][0]
            expect(call.scope).toBe('this_and_future')
        })
    })

    it('exibe erro quando a action falha', async () => {
        rescheduleMock.mockResolvedValueOnce({
            success: false,
            error: 'Não foi possível',
        })
        render(
            <RescheduleOccurrenceModal
                isOpen
                onClose={() => {}}
                occurrence={makeOcc()}
                studentName="João"
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /^Remarcar$/i }))
        await waitFor(() => {
            expect(screen.getByText(/Não foi possível/i)).toBeInTheDocument()
        })
    })
})
