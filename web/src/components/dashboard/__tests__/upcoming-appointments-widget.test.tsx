import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import {
    UpcomingAppointmentsWidget,
    formatOccurrenceWhen,
} from '../upcoming-appointments-widget'

const routerPush = vi.fn()
const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}))

// OccurrencePopover is covered by its own test. Stub it here so clicks on
// the row simulate opening the menu directly.
vi.mock('@/components/appointments/occurrence-popover', () => ({
    OccurrencePopover: ({
        children,
        occurrence,
        studentName,
    }: {
        children: React.ReactNode
        occurrence: AppointmentOccurrence
        studentName: string
    }) => (
        <div data-testid={`popover-${occurrence.recurringAppointmentId}`} data-student={studentName}>
            {children}
        </div>
    ),
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

describe('formatOccurrenceWhen', () => {
    it('formata "Hoje" quando mesma data', () => {
        expect(formatOccurrenceWhen('2026-04-23', '07:00', '2026-04-23')).toBe('Hoje às 07:00')
    })
    it('formata "Amanhã" em +1 dia', () => {
        expect(formatOccurrenceWhen('2026-04-24', '07:00', '2026-04-23')).toBe('Amanhã às 07:00')
    })
    it('usa dia da semana pra +2..+6 dias', () => {
        // 2026-04-23 é quinta. +3 → 2026-04-26 = domingo.
        expect(formatOccurrenceWhen('2026-04-26', '08:30', '2026-04-23')).toBe('Domingo às 08:30')
    })
    it('usa DD/MM pra +7 dias ou mais', () => {
        expect(formatOccurrenceWhen('2026-05-03', '07:00', '2026-04-23')).toBe('03/05 às 07:00')
    })
})

describe('UpcomingAppointmentsWidget', () => {
    beforeEach(() => {
        routerPush.mockReset()
        routerRefresh.mockReset()
    })

    it('renderiza empty state quando sem ocorrências', () => {
        render(<UpcomingAppointmentsWidget appointments={[]} studentsById={{}} />)
        expect(screen.getByText(/Nenhum agendamento marcado/i)).toBeInTheDocument()
        expect(screen.getByText(/Crie uma rotina/i)).toBeInTheDocument()
    })

    it('renderiza múltiplas ocorrências com nome + duração', () => {
        const occ1 = makeOcc({ recurringAppointmentId: 'a', studentId: 'st-1' })
        const occ2 = makeOcc({
            recurringAppointmentId: 'b',
            studentId: 'st-2',
            date: '2026-05-03',
            startTime: '18:00',
            originalDate: '2026-05-03',
        })
        render(
            <UpcomingAppointmentsWidget
                appointments={[occ1, occ2]}
                studentsById={{
                    'st-1': { name: 'João Silva', avatarUrl: null },
                    'st-2': { name: 'Maria Souza', avatarUrl: null },
                }}
            />,
        )
        expect(screen.getByText('João Silva')).toBeInTheDocument()
        expect(screen.getByText('Maria Souza')).toBeInTheDocument()
        expect(screen.getAllByText(/60 min/i).length).toBe(2)
    })

    it('mostra pill "Pacote" quando occurrence.groupId !== null', () => {
        const occ = makeOcc({ groupId: 'g-1' })
        render(
            <UpcomingAppointmentsWidget
                appointments={[occ]}
                studentsById={{ 'st-1': { name: 'João', avatarUrl: null } }}
            />,
        )
        expect(screen.getByText('Pacote')).toBeInTheDocument()
    })

    it('não mostra pill "Pacote" quando groupId é null', () => {
        const occ = makeOcc({ groupId: null })
        render(
            <UpcomingAppointmentsWidget
                appointments={[occ]}
                studentsById={{ 'st-1': { name: 'João', avatarUrl: null } }}
            />,
        )
        expect(screen.queryByText('Pacote')).not.toBeInTheDocument()
    })

    it('cada linha envolve o trigger num OccurrencePopover', () => {
        const occ = makeOcc({ recurringAppointmentId: 'ra-x', studentId: 'st-1' })
        render(
            <UpcomingAppointmentsWidget
                appointments={[occ]}
                studentsById={{ 'st-1': { name: 'João', avatarUrl: null } }}
            />,
        )
        const popover = screen.getByTestId('popover-ra-x')
        expect(popover).toHaveAttribute('data-student', 'João')
    })

    it('fallback "Aluno" quando o aluno não está no map', () => {
        const occ = makeOcc({ studentId: 'st-unknown' })
        render(<UpcomingAppointmentsWidget appointments={[occ]} studentsById={{}} />)
        expect(screen.getByText('Aluno')).toBeInTheDocument()
    })

    // Regressão: o widget antes tinha o label pluralizado errado.
    it('mostra a contagem no badge do header', () => {
        const occs = [
            makeOcc({ recurringAppointmentId: 'a' }),
            makeOcc({ recurringAppointmentId: 'b' }),
            makeOcc({ recurringAppointmentId: 'c' }),
        ]
        render(
            <UpcomingAppointmentsWidget
                appointments={occs}
                studentsById={{ 'st-1': { name: 'João', avatarUrl: null } }}
            />,
        )
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    // Sanity check: click nos filhos da linha não explodem (popover é stub aqui)
    it('click na linha não lança erro', () => {
        const occ = makeOcc({ recurringAppointmentId: 'ra-x', studentId: 'st-1' })
        render(
            <UpcomingAppointmentsWidget
                appointments={[occ]}
                studentsById={{ 'st-1': { name: 'João', avatarUrl: null } }}
            />,
        )
        fireEvent.click(screen.getByText('João'))
        expect(screen.getByText('João')).toBeInTheDocument()
    })
})
