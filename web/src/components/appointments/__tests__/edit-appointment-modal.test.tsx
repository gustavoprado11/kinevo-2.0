import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import { EditAppointmentModal } from '../edit-appointment-modal'

const updateActionMock = vi.fn()
vi.mock('@/actions/appointments/update-recurring', () => ({
    updateRecurringAppointment: (...args: unknown[]) => updateActionMock(...args),
}))

// Supabase client mock (count de exceptions) — retorna 0.
vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    gte: () =>
                        Promise.resolve({ count: 0, data: [], error: null }),
                }),
            }),
        }),
    }),
}))

function makeRule(overrides: Partial<RecurringAppointment> = {}): RecurringAppointment {
    return {
        id: 'ra-1',
        trainer_id: 't-1',
        student_id: 's-1',
        day_of_week: 5, // Fri (matches 2026-04-24)
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-24',
        ends_on: null,
        status: 'active',
        notes: null,
        group_id: null,
        created_at: '2026-04-20T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
        ...overrides,
    }
}

describe('EditAppointmentModal', () => {
    beforeEach(() => {
        updateActionMock.mockReset()
    })

    it("rotina 'once' abre com dia da semana readonly (desabilitado) e label ajustada", () => {
        const rule = makeRule({ frequency: 'once' })
        render(<EditAppointmentModal isOpen onClose={vi.fn()} rule={rule} />)

        // Botão "Única" deve estar selecionado (aparece no segmented control)
        expect(screen.getByRole('button', { name: /^Única$/i })).toBeInTheDocument()
        // Hint "ajustado automaticamente" aparece quando frequency=once
        expect(screen.getByText(/ajustado automaticamente/i)).toBeInTheDocument()
        // Todos os botões de dia da semana ficam disabled
        for (const d of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) {
            expect(screen.getByRole('button', { name: d })).toBeDisabled()
        }
    })

    it("rotina 'weekly' mantém dia da semana editável (comportamento antigo)", () => {
        const rule = makeRule({ frequency: 'weekly' })
        render(<EditAppointmentModal isOpen onClose={vi.fn()} rule={rule} />)

        expect(screen.queryByText(/ajustado automaticamente/i)).not.toBeInTheDocument()
        // Dia da semana editável
        expect(screen.getByRole('button', { name: 'Seg' })).toBeEnabled()
    })
})
