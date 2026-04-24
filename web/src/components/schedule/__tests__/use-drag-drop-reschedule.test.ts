import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { DragEndEvent } from '@dnd-kit/core'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { useDragDropReschedule } from '../use-drag-drop-reschedule'

const rescheduleMock = vi.fn()
vi.mock('@/actions/appointments/reschedule-occurrence', () => ({
    rescheduleOccurrence: (...args: unknown[]) => rescheduleMock(...args),
}))

function makeOcc(overrides: Partial<AppointmentOccurrence> = {}): AppointmentOccurrence {
    return {
        recurringAppointmentId: 'ra-1',
        groupId: null,
        studentId: 's-1',
        trainerId: 't-1',
        date: '2026-04-14',
        startTime: '07:00',
        durationMinutes: 60,
        originalDate: '2026-04-14',
        status: 'scheduled',
        hasException: false,
        notes: null,
        ...overrides,
    }
}

function makeEvent(args: {
    occurrence: AppointmentOccurrence
    overDate: string
    deltaY: number
}): DragEndEvent {
    return {
        active: {
            id: `${args.occurrence.recurringAppointmentId}::${args.occurrence.originalDate}`,
            data: {
                current: {
                    recurringAppointmentId: args.occurrence.recurringAppointmentId,
                    originalDate: args.occurrence.originalDate,
                    occurrence: args.occurrence,
                },
            },
            rect: { current: { initial: null, translated: null } },
        },
        over: {
            id: `day::${args.overDate}`,
            data: { current: { date: args.overDate } },
            rect: {} as DOMRect,
            disabled: false,
        },
        delta: { x: 0, y: args.deltaY },
        collisions: null,
        activatorEvent: {} as Event,
    } as unknown as DragEndEvent
}

describe('useDragDropReschedule', () => {
    beforeEach(() => {
        rescheduleMock.mockReset()
    })

    it('drop em slot válido chama rescheduleOccurrence com scope=only_this', async () => {
        rescheduleMock.mockResolvedValueOnce({ success: true })
        const onRescheduled = vi.fn()
        const { result } = renderHook(() =>
            useDragDropReschedule({ onRescheduled }),
        )

        const occ = makeOcc({
            recurringAppointmentId: 'ra-X',
            originalDate: '2026-04-14',
            date: '2026-04-14',
            startTime: '07:00',
        })

        // Drop na quinta (2026-04-16), sem mover Y → hora igual
        act(() => {
            result.current.handleDragEnd(
                makeEvent({ occurrence: occ, overDate: '2026-04-16', deltaY: 0 }),
            )
        })

        await waitFor(() => {
            expect(rescheduleMock).toHaveBeenCalledTimes(1)
        })
        const callArgs = rescheduleMock.mock.calls[0][0]
        expect(callArgs.scope).toBe('only_this')
        expect(callArgs.recurringAppointmentId).toBe('ra-X')
        expect(callArgs.originalDate).toBe('2026-04-14')
        expect(callArgs.newDate).toBe('2026-04-16')
        expect(callArgs.newStartTime).toBe('07:00')
        await waitFor(() => {
            expect(onRescheduled).toHaveBeenCalled()
        })
    })

    it('drop no mesmo slot é no-op', async () => {
        const { result } = renderHook(() => useDragDropReschedule({}))
        const occ = makeOcc()
        act(() => {
            result.current.handleDragEnd(
                makeEvent({
                    occurrence: occ,
                    overDate: occ.date,
                    deltaY: 0,
                }),
            )
        })
        // Não deve chamar a action
        await new Promise((r) => setTimeout(r, 10))
        expect(rescheduleMock).not.toHaveBeenCalled()
    })

    it('drop sem "over" é no-op (soltou fora do grid)', () => {
        const { result } = renderHook(() => useDragDropReschedule({}))
        const event = {
            active: {
                id: 'x',
                data: {
                    current: {
                        recurringAppointmentId: 'x',
                        originalDate: '2026-04-14',
                        occurrence: makeOcc(),
                    },
                },
                rect: {},
            },
            over: null,
            delta: { x: 0, y: 0 },
            collisions: null,
            activatorEvent: {},
        } as unknown as DragEndEvent
        act(() => {
            result.current.handleDragEnd(event)
        })
        expect(rescheduleMock).not.toHaveBeenCalled()
    })

    it('erro do action aparece em result.error', async () => {
        rescheduleMock.mockResolvedValueOnce({
            success: false,
            error: 'Sem permissão',
        })
        const { result } = renderHook(() => useDragDropReschedule({}))
        const occ = makeOcc()

        act(() => {
            result.current.handleDragEnd(
                makeEvent({ occurrence: occ, overDate: '2026-04-16', deltaY: 0 }),
            )
        })

        await waitFor(() => {
            expect(result.current.error).toBe('Sem permissão')
        })
    })

    it('clearError reseta o erro', async () => {
        rescheduleMock.mockResolvedValueOnce({
            success: false,
            error: 'Ops',
        })
        const { result } = renderHook(() => useDragDropReschedule({}))
        const occ = makeOcc()

        act(() => {
            result.current.handleDragEnd(
                makeEvent({ occurrence: occ, overDate: '2026-04-16', deltaY: 0 }),
            )
        })
        await waitFor(() => expect(result.current.error).toBe('Ops'))

        act(() => {
            result.current.clearError()
        })
        expect(result.current.error).toBeNull()
    })
})
