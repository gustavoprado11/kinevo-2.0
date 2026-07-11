import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { OccurrencePopover } from '../occurrence-popover'

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}))

// Stub child modal so clicking "Remarcar" is observable without rendering
// the whole reschedule form.
vi.mock('../reschedule-occurrence-modal', () => ({
    RescheduleOccurrenceModal: ({
        isOpen,
        onClose,
    }: {
        isOpen: boolean
        onClose: () => void
    }) =>
        isOpen ? (
            <div data-testid="reschedule-modal">
                <button onClick={onClose}>stub-close</button>
            </div>
        ) : null,
}))

const cancelOccurrenceMock = vi.fn()
vi.mock('@/actions/appointments/cancel-occurrence', () => ({
    cancelOccurrence: (...args: unknown[]) => cancelOccurrenceMock(...args),
}))

const cancelRecurringMock = vi.fn()
vi.mock('@/actions/appointments/cancel-recurring', () => ({
    cancelRecurringAppointment: (...args: unknown[]) => cancelRecurringMock(...args),
}))

const markStatusMock = vi.fn()
vi.mock('@/actions/appointments/mark-occurrence-status', () => ({
    markOccurrenceStatus: (...args: unknown[]) => markStatusMock(...args),
}))

function makeOcc(overrides: Partial<AppointmentOccurrence> = {}): AppointmentOccurrence {
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
        ...overrides,
    }
}

describe('OccurrencePopover', () => {
    beforeEach(() => {
        routerPush.mockReset()
        cancelOccurrenceMock.mockReset()
        cancelRecurringMock.mockReset()
        markStatusMock.mockReset()
    })

    it('"Marcar como concluído" chama markOccurrenceStatus e dispara onStatusChanged', async () => {
        markStatusMock.mockResolvedValue({ success: true })
        const onStatusChanged = vi.fn()
        render(
            <OccurrencePopover
                occurrence={makeOcc({ originalDate: '2026-04-22' })}
                studentName="João"
                onStatusChanged={onStatusChanged}
            >
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Marcar como concluído/i }))
        await waitFor(() => {
            expect(markStatusMock).toHaveBeenCalledWith({
                recurringAppointmentId: 'ra-1',
                occurrenceDate: '2026-04-22',
                status: 'completed',
            })
            expect(onStatusChanged).toHaveBeenCalled()
        })
    })

    it('"Marcar falta" envia status no_show', async () => {
        markStatusMock.mockResolvedValue({ success: true })
        render(
            <OccurrencePopover occurrence={makeOcc()} studentName="João">
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Marcar falta/i }))
        await waitFor(() => {
            expect(markStatusMock).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'no_show' }),
            )
        })
    })

    it('ocorrência FUTURA não mostra ações de presença', () => {
        render(
            <OccurrencePopover
                occurrence={makeOcc({ date: '2099-01-01' })}
                studentName="João"
            >
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        expect(
            screen.queryByRole('menuitem', { name: /Marcar como concluído/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole('menuitem', { name: /Marcar falta/i }),
        ).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Remarcar/i })).toBeInTheDocument()
    })

    it('mostra erro inline quando markOccurrenceStatus falha', async () => {
        markStatusMock.mockResolvedValue({ success: false, error: 'Sem permissão' })
        render(
            <OccurrencePopover occurrence={makeOcc()} studentName="João">
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Marcar falta/i }))
        await waitFor(() => {
            expect(screen.getByText('Sem permissão')).toBeInTheDocument()
        })
        // Menu continua aberto pra tentar de novo.
        expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('abre menu com as ações ao clicar no trigger (presença incluída — ocorrência passada)', () => {
        render(
            <OccurrencePopover occurrence={makeOcc()} studentName="João">
                <span>Linha do João</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('Linha do João'))
        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(
            screen.getByRole('menuitem', { name: /Marcar como concluído/i }),
        ).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Marcar falta/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /Remarcar/i })).toBeInTheDocument()
        expect(
            screen.getByRole('menuitem', { name: /Cancelar este treino/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('menuitem', { name: /Encerrar esta rotina/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('menuitem', { name: /Abrir perfil do aluno/i }),
        ).toBeInTheDocument()
    })

    it('"Abrir perfil" navega pra /students/{studentId}', () => {
        render(
            <OccurrencePopover occurrence={makeOcc({ studentId: 'st-xyz' })} studentName="João">
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Abrir perfil do aluno/i }))
        expect(routerPush).toHaveBeenCalledWith('/students/st-xyz')
    })

    it('"Remarcar" abre RescheduleOccurrenceModal', () => {
        render(
            <OccurrencePopover occurrence={makeOcc()} studentName="João">
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Remarcar/i }))
        expect(screen.getByTestId('reschedule-modal')).toBeInTheDocument()
    })

    it('"Cancelar este treino" pede confirmação e depois chama cancelOccurrence', async () => {
        cancelOccurrenceMock.mockResolvedValueOnce({ success: true })
        const onCanceled = vi.fn()

        render(
            <OccurrencePopover
                occurrence={makeOcc({
                    recurringAppointmentId: 'ra-abc',
                    originalDate: '2026-04-24',
                })}
                studentName="João"
                onCanceled={onCanceled}
            >
                <span>trigger</span>
            </OccurrencePopover>,
        )

        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Cancelar este treino/i }))
        // Texto de confirmação aparece
        expect(screen.getByText(/Cancelar este treino\?/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

        await waitFor(() => {
            expect(cancelOccurrenceMock).toHaveBeenCalledWith({
                recurringAppointmentId: 'ra-abc',
                occurrenceDate: '2026-04-24',
            })
            expect(onCanceled).toHaveBeenCalled()
        })
    })

    it('"Encerrar esta rotina" abre diálogo com date picker (default hoje) e chama cancelRecurringAppointment', async () => {
        cancelRecurringMock.mockResolvedValueOnce({ success: true })
        const onCanceled = vi.fn()

        render(
            <OccurrencePopover
                occurrence={makeOcc({ recurringAppointmentId: 'ra-xyz' })}
                studentName="João"
                onCanceled={onCanceled}
            >
                <span>trigger</span>
            </OccurrencePopover>,
        )

        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar esta rotina/i }))

        expect(screen.getByText(/Encerrar esta rotina\?/i)).toBeInTheDocument()
        // Date picker presente
        const dateInput = screen.getByLabelText(/Encerrar a partir de/i)
        expect(dateInput).toBeInTheDocument()
        // default = hoje (YYYY-MM-DD). Apenas checamos formato.
        expect((dateInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        fireEvent.click(screen.getByRole('button', { name: /Encerrar rotina/i }))

        await waitFor(() => {
            expect(cancelRecurringMock).toHaveBeenCalledTimes(1)
            const [args] = cancelRecurringMock.mock.calls[0]
            expect(args.id).toBe('ra-xyz')
            expect(args.endsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(onCanceled).toHaveBeenCalled()
        })
    })

    it('"Encerrar esta rotina" em ocorrência de pacote mostra texto adicional', () => {
        render(
            <OccurrencePopover
                occurrence={makeOcc({ groupId: 'group-1' })}
                studentName="João"
            >
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar esta rotina/i }))
        expect(
            screen.getByText(/Apenas esta linha do pacote será encerrada/i),
        ).toBeInTheDocument()
    })

    it('mostra erro inline quando cancelOccurrence falha', async () => {
        cancelOccurrenceMock.mockResolvedValueOnce({
            success: false,
            error: 'Falhou na gravação',
        })

        render(
            <OccurrencePopover occurrence={makeOcc()} studentName="João">
                <span>trigger</span>
            </OccurrencePopover>,
        )
        fireEvent.click(screen.getByText('trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Cancelar este treino/i }))
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

        await waitFor(() => {
            expect(screen.getByText(/Falhou na gravação/i)).toBeInTheDocument()
        })
    })
})
