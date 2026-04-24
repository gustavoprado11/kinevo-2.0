import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateAppointmentModal } from '../create-appointment-modal'

const createActionMock = vi.fn()
const createGroupActionMock = vi.fn()
vi.mock('@/actions/appointments/create-recurring', () => ({
    createRecurringAppointment: (...args: unknown[]) => createActionMock(...args),
}))
vi.mock('@/actions/appointments/create-recurring-group', () => ({
    createRecurringAppointmentGroup: (...args: unknown[]) =>
        createGroupActionMock(...args),
}))

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    preselectedStudentId: '11111111-1111-1111-1111-111111111111',
    preselectedStudentName: 'João Silva',
}

describe('CreateAppointmentModal', () => {
    beforeEach(() => {
        createActionMock.mockReset()
        createGroupActionMock.mockReset()
        baseProps.onClose = vi.fn()
    })

    it('renderiza os campos principais e o nome do aluno', () => {
        render(<CreateAppointmentModal {...baseProps} />)
        expect(screen.getByText('Novo agendamento')).toBeInTheDocument()
        expect(screen.getByText('Aluno: João Silva')).toBeInTheDocument()
        expect(screen.getByLabelText(/Horário do dia 1/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Data de início/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Notas/i)).toBeInTheDocument()
        // Add-day button exists and is enabled in weekly mode
        expect(screen.getByRole('button', { name: /Adicionar dia/i })).toBeEnabled()
    })

    it('quando frequência = Mensal, desabilita Adicionar dia e força 1 slot', () => {
        render(<CreateAppointmentModal {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: /^Mensal$/i }))
        expect(screen.getByRole('button', { name: /Adicionar dia/i })).toBeDisabled()
        // Day-of-week buttons in the single slot become disabled too
        const terca = screen.getByRole('button', { name: /Ter — dia 1/i })
        expect(terca).toBeDisabled()
    })

    it('renderiza 4° botão "Única" no segmented control de frequência', () => {
        render(<CreateAppointmentModal {...baseProps} />)
        expect(screen.getByRole('button', { name: /^Única$/i })).toBeInTheDocument()
    })

    it('selecionar "Única" desabilita Adicionar dia e dia da semana', () => {
        render(<CreateAppointmentModal {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: /^Única$/i }))
        expect(screen.getByRole('button', { name: /Adicionar dia/i })).toBeDisabled()
        const terca = screen.getByRole('button', { name: /Ter — dia 1/i })
        expect(terca).toBeDisabled()
        expect(screen.getByText(/^Horário$/i)).toBeInTheDocument()
    })

    it('trocar de Semanal com múltiplos slots para "Única" reduz pra 1 slot', () => {
        render(<CreateAppointmentModal {...baseProps} />)
        // Adiciona 2 slots extras (total 3)
        fireEvent.click(screen.getByRole('button', { name: /Adicionar dia/i }))
        fireEvent.click(screen.getByRole('button', { name: /Adicionar dia/i }))
        expect(screen.getAllByText(/^Dia \d/i)).toHaveLength(3)

        fireEvent.click(screen.getByRole('button', { name: /^Única$/i }))
        // Agora só 1 "Dia 1"
        expect(screen.getAllByText(/^Dia \d/i)).toHaveLength(1)
        expect(screen.getByText(/^Dia 1$/i)).toBeInTheDocument()
    })

    it('submit com frequência "Única" envia frequency: once', async () => {
        createActionMock.mockResolvedValueOnce({
            success: true,
            data: { id: 'ra-once', conflicts: [] },
        })
        render(<CreateAppointmentModal {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: /^Única$/i }))
        fireEvent.click(screen.getByRole('button', { name: /Criar agendamento/i }))

        await waitFor(() => {
            expect(createActionMock).toHaveBeenCalledTimes(1)
        })
        const [input] = createActionMock.mock.calls[0]
        expect(input.frequency).toBe('once')
    })

    it('chama createRecurringAppointment ao submeter', async () => {
        createActionMock.mockResolvedValueOnce({
            success: true,
            data: { id: 'ra-new', conflicts: [] },
        })
        render(<CreateAppointmentModal {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: /Criar agendamento/i }))

        await waitFor(() => {
            expect(createActionMock).toHaveBeenCalledTimes(1)
        })
        const [input] = createActionMock.mock.calls[0]
        expect(input.studentId).toBe(baseProps.preselectedStudentId)
        expect(input.frequency).toBe('weekly')
    })

    it('fecha o modal em sucesso e chama onSuccess com recurringId', async () => {
        const onClose = vi.fn()
        const onSuccess = vi.fn()
        createActionMock.mockResolvedValueOnce({
            success: true,
            data: { id: 'ra-created', conflicts: [] },
        })

        render(
            <CreateAppointmentModal {...baseProps} onClose={onClose} onSuccess={onSuccess} />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Criar agendamento/i }))

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith({ recurringId: 'ra-created' })
            expect(onClose).toHaveBeenCalled()
        })
    })

    it('com 2 slots chama createRecurringAppointmentGroup', async () => {
        createGroupActionMock.mockResolvedValueOnce({
            success: true,
            data: { groupId: 'group-1', appointmentIds: ['ra-a', 'ra-b'] },
        })

        const onSuccess = vi.fn()
        render(<CreateAppointmentModal {...baseProps} onSuccess={onSuccess} />)

        fireEvent.click(screen.getByRole('button', { name: /Adicionar dia/i }))
        // Submit button label should now say "Criar pacote"
        fireEvent.click(screen.getByRole('button', { name: /Criar pacote/i }))

        await waitFor(() => {
            expect(createGroupActionMock).toHaveBeenCalledTimes(1)
        })
        const [input] = createGroupActionMock.mock.calls[0]
        expect(input.slots).toHaveLength(2)
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith({ groupId: 'group-1' })
        })
    })

    it('sem preselectedStudentId + com students, renderiza autocomplete e submit começa desabilitado', () => {
        const students = [
            { id: 's-1', name: 'Ana Costa', avatarUrl: null },
            { id: 's-2', name: 'Bruno Lima', avatarUrl: null },
        ]
        render(
            <CreateAppointmentModal
                isOpen
                onClose={vi.fn()}
                students={students}
            />,
        )
        expect(screen.getByPlaceholderText(/Buscar aluno/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Criar agendamento/i })).toBeDisabled()
    })

    it('autocomplete filtra por nome e habilita submit ao selecionar', async () => {
        createActionMock.mockResolvedValueOnce({
            success: true,
            data: { id: 'ra-xyz', conflicts: [] },
        })
        const students = [
            { id: 's-1', name: 'Ana Costa', avatarUrl: null },
            { id: 's-2', name: 'Bruno Lima', avatarUrl: null },
            { id: 's-3', name: 'Carla Dias', avatarUrl: null },
        ]
        render(
            <CreateAppointmentModal
                isOpen
                onClose={vi.fn()}
                students={students}
            />,
        )

        const input = screen.getByPlaceholderText(/Buscar aluno/i)
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'bru' } })

        // Só Bruno aparece
        expect(screen.getByRole('option', { name: /Bruno Lima/i })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: /Ana Costa/i })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('option', { name: /Bruno Lima/i }))

        // Chip com o nome aparece e submit fica habilitado
        expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
        const submit = screen.getByRole('button', { name: /Criar agendamento/i })
        expect(submit).toBeEnabled()

        fireEvent.click(submit)
        await waitFor(() => {
            expect(createActionMock).toHaveBeenCalledTimes(1)
        })
        const [payload] = createActionMock.mock.calls[0]
        expect(payload.studentId).toBe('s-2')
    })

    it('sem preselectedStudentId + sem students mostra fallback "Nenhum aluno disponível"', () => {
        render(<CreateAppointmentModal isOpen onClose={vi.fn()} />)
        expect(
            screen.getByText(/Nenhum aluno disponível/i),
        ).toBeInTheDocument()
        expect(screen.queryByPlaceholderText(/Buscar aluno/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Criar agendamento/i })).toBeDisabled()
    })

    it('com preselectedStudentId, NÃO renderiza campo de busca (preserva comportamento antigo)', () => {
        render(<CreateAppointmentModal {...baseProps} />)
        expect(screen.queryByPlaceholderText(/Buscar aluno/i)).not.toBeInTheDocument()
        // Nome do aluno aparece no header, não como chip do picker
        expect(screen.getByText(/Aluno: João Silva/i)).toBeInTheDocument()
    })

    it('mostra erro ao tentar criar com slots duplicados', async () => {
        render(<CreateAppointmentModal {...baseProps} />)
        // Adiciona um segundo slot; por default vem num dia diferente. Vou forçar duplicata:
        fireEvent.click(screen.getByRole('button', { name: /Adicionar dia/i }))
        // Slot 2 começa com Seg ou outro dia — clicar em Ter do slot 2 pra duplicar com slot 1 default
        const tercaSlot2 = screen.getByRole('button', { name: /Ter — dia 2/i })
        fireEvent.click(tercaSlot2)
        expect(screen.getByText(/duplicados/i)).toBeInTheDocument()
        // Submit should be disabled enquanto há duplicata
        expect(screen.getByRole('button', { name: /Criar pacote/i })).toBeDisabled()
    })
})
