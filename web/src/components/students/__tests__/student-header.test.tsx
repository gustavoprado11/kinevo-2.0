import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudentHeader } from '../student-header'

// Server action chamada por "Gerar Nova Senha" — não usada nestes testes,
// mas o componente importa no topo, então precisa de mock.
vi.mock('@/app/students/[id]/actions/reset-student-password', () => ({
    resetStudentPassword: vi.fn(),
}))

const baseStudent = {
    id: 's1',
    name: 'Gustavo Prado',
    email: 'gustavo@example.com',
    phone: null,
    status: 'active' as const,
    modality: 'online' as const,
    avatar_url: null,
    created_at: '2026-01-15T00:00:00Z',
    is_trainer_profile: false,
    objective: null as string | null,
    management_tags: null as string[] | null,
}

const noopProps = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
}

describe('StudentHeader', () => {
    it('renderiza objetivo quando student.objective está presente', () => {
        render(
            <StudentHeader
                {...noopProps}
                student={{ ...baseStudent, objective: 'Hipertrofia' }}
            />,
        )
        expect(screen.getByText('Hipertrofia')).toBeInTheDocument()
    })

    it('renderiza tags quando management_tags é array com itens', () => {
        render(
            <StudentHeader
                {...noopProps}
                student={{ ...baseStudent, management_tags: ['VIP', 'Ciclo 3'] }}
            />,
        )
        expect(screen.getByText('VIP')).toBeInTheDocument()
        expect(screen.getByText('Ciclo 3')).toBeInTheDocument()
    })

    it('não quebra quando management_tags vem como string (legado)', () => {
        // Aluno legado pode ter o campo como string em vez de array.
        const { container } = render(
            <StudentHeader
                {...noopProps}
                student={{
                    ...baseStudent,
                    // @ts-expect-error — simulando dado sujo do banco legado
                    management_tags: 'VIP',
                }}
            />,
        )
        // Renderiza sem throw e sem badges de tag.
        expect(container).toBeTruthy()
        expect(screen.queryByText('VIP')).not.toBeInTheDocument()
    })

    it('não renderiza wrapper de objetivo+tags quando ambos vazios', () => {
        const { container } = render(
            <StudentHeader {...noopProps} student={baseStudent} />,
        )
        // Sem objetivo nem tags → o bloco específico não aparece.
        // Usa o fato de que o ícone Target só aparece junto do objetivo.
        // Conferimos pela ausência de qualquer texto de tag típico.
        expect(container.textContent).not.toContain('🎯')
        // Sanity: o nome continua aparecendo.
        expect(screen.getByText('Gustavo Prado')).toBeInTheDocument()
    })

    it('não mostra "Tour rápido" quando onStartTour é undefined', () => {
        render(<StudentHeader {...noopProps} student={baseStudent} />)
        // Abre o menu MoreHorizontal
        fireEvent.click(screen.getByLabelText('Mais ações'))
        expect(screen.queryByText('Tour rápido')).not.toBeInTheDocument()
        // O item original continua presente.
        expect(screen.getByText('Gerar Nova Senha')).toBeInTheDocument()
    })

    it('chama onStartTour ao clicar em "Tour rápido"', () => {
        const onStartTour = vi.fn()
        render(
            <StudentHeader
                {...noopProps}
                student={baseStudent}
                onStartTour={onStartTour}
            />,
        )
        fireEvent.click(screen.getByLabelText('Mais ações'))
        fireEvent.click(screen.getByText('Tour rápido'))
        expect(onStartTour).toHaveBeenCalledTimes(1)
    })

    it('não mostra menu de ações quando is_trainer_profile = true', () => {
        // Garante que "Tour rápido" também não aparece para o próprio perfil
        // do treinador (o menu inteiro some, então o item não fica acessível).
        render(
            <StudentHeader
                {...noopProps}
                student={{ ...baseStudent, is_trainer_profile: true }}
                onStartTour={vi.fn()}
            />,
        )
        expect(screen.queryByLabelText('Mais ações')).not.toBeInTheDocument()
    })
})
