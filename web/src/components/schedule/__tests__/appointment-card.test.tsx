import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { AppointmentCard } from '../appointment-card'

// OccurrencePopover é testado separadamente; stub aqui pra focar no render
// do card.
vi.mock('@/components/appointments/occurrence-popover', () => ({
    OccurrencePopover: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="popover-wrapper">{children}</div>
    ),
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

function wrap(children: React.ReactNode) {
    return <DndContext>{children}</DndContext>
}

describe('AppointmentCard', () => {
    it('mostra nome do aluno e intervalo HH:MM–HH:MM', () => {
        render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc({ startTime: '07:00', durationMinutes: 60 })}
                    student={{ name: 'João Silva', avatarUrl: null }}
                />,
            ),
        )
        expect(screen.getByText('João Silva')).toBeInTheDocument()
        expect(screen.getByText(/07:00 – 08:00/)).toBeInTheDocument()
    })

    it('mostra hora de fim calculada corretamente com 90 min', () => {
        render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc({ startTime: '18:30', durationMinutes: 90 })}
                    student={{ name: 'Maria', avatarUrl: null }}
                />,
            ),
        )
        expect(screen.getByText(/18:30 – 20:00/)).toBeInTheDocument()
    })

    it('mostra label "Remarcado" quando status=rescheduled', () => {
        render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc({ status: 'rescheduled' })}
                    student={{ name: 'João', avatarUrl: null }}
                />,
            ),
        )
        expect(screen.getByText(/Remarcado/i)).toBeInTheDocument()
    })

    it('mostra label "Faltou" quando status=no_show', () => {
        render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc({ status: 'no_show' })}
                    student={{ name: 'João', avatarUrl: null }}
                />,
            ),
        )
        expect(screen.getByText(/Faltou/i)).toBeInTheDocument()
    })

    it('renderiza ícone de pacote quando groupId !== null', () => {
        render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc({ groupId: 'group-1' })}
                    student={{ name: 'João', avatarUrl: null }}
                />,
            ),
        )
        expect(screen.getByLabelText(/pacote multi-dia/i)).toBeInTheDocument()
    })

    it('NÃO renderiza ícone de pacote quando groupId é null', () => {
        render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc({ groupId: null })}
                    student={{ name: 'João', avatarUrl: null }}
                />,
            ),
        )
        expect(screen.queryByLabelText(/pacote multi-dia/i)).not.toBeInTheDocument()
    })

    it('aplica outline de conflito quando isConflicting=true', () => {
        const { container } = render(
            wrap(
                <AppointmentCard
                    occurrence={makeOcc()}
                    student={{ name: 'João', avatarUrl: null }}
                    isConflicting
                />,
            ),
        )
        // Outline usa cor Apple #FF3B30 (pode aparecer com escape no HTML).
        expect(container.innerHTML).toMatch(/outline-\[#FF3B30\]/)
    })
})
