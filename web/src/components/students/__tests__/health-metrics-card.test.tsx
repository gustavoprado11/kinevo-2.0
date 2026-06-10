import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HealthMetricsCard } from '../health-metrics-card'

const assignFormMock = vi.fn()
vi.mock('@/actions/forms/assign-form', () => ({
    assignFormToStudents: (...args: unknown[]) => assignFormMock(...args),
}))

// O componente consome useToast(); o mock evita montar o ToastProvider
// (framer-motion) só para satisfazer o contexto.
vi.mock('@/components/ui/toast', () => ({
    useToast: () => ({ toast: vi.fn() }),
}))

// Actions de avaliação são mockadas: o módulo real importa push-notifications →
// supabase-admin, que exige SUPABASE_SERVICE_ROLE_KEY (ausente nos testes).
const getSubmissionResponsesMock = vi.fn()
vi.mock('@/actions/forms/get-submission-responses', () => ({
    getSubmissionResponses: (...args: unknown[]) => getSubmissionResponsesMock(...args),
}))
const sendFormFeedbackMock = vi.fn()
vi.mock('@/actions/forms/send-form-feedback', () => ({
    sendFormFeedback: (...args: unknown[]) => sendFormFeedbackMock(...args),
}))

// ActiveSchedulesList renderiza tabela complexa — mock minimalista pra não
// importar a árvore inteira nestes testes.
vi.mock('../active-schedules-list', () => ({
    ActiveSchedulesList: ({ schedules }: { schedules: { id: string }[] }) => (
        <div data-testid="active-schedules-list">schedules:{schedules.length}</div>
    ),
}))

const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        prefetch: vi.fn(),
        refresh: refreshMock,
    }),
    usePathname: () => '/students/abc',
    useSearchParams: () => new URLSearchParams(),
}))

const baseProps = {
    studentId: 'student-1',
    lastSubmission: null,
    pendingForms: [] as { id: string; title: string; status: string; createdAt: string }[],
    bodyMetrics: null as { weight: string | null; bodyFat: string | null; updatedAt: string | null } | null,
    bodyMetricsHistory: [],
    formTemplates: [
        { id: 't1', title: 'Anamnese padrão', category: 'anamnese' },
    ],
    formSchedules: [],
    latestPresencialSession: null,
}

beforeEach(() => {
    assignFormMock.mockReset()
    refreshMock.mockReset()
})

describe('HealthMetricsCard', () => {
    it('renderiza Peso e Gordura quando há bodyMetrics', () => {
        render(
            <HealthMetricsCard
                {...baseProps}
                bodyMetrics={{ weight: '78', bodyFat: '21', updatedAt: '2026-04-01T00:00:00Z' }}
            />,
        )
        expect(screen.getByText(/78 kg/)).toBeInTheDocument()
        expect(screen.getByText(/21%/)).toBeInTheDocument()
    })

    it('renderiza banner de "Reavaliação pendente" quando há pendingForms', () => {
        render(
            <HealthMetricsCard
                {...baseProps}
                pendingForms={[
                    { id: 'f1', title: 'Check-in semanal', status: 'pending', createdAt: '2026-04-01' },
                ]}
            />,
        )
        const banner = screen.getByTestId('reassessment-banner')
        expect(banner).toBeInTheDocument()
        expect(banner.textContent).toMatch(/Reavaliação periódica/i)
        expect(banner.textContent).toMatch(/pendente/i)
    })

    it('renderiza banner quando há formSchedules vencendo em ≤7 dias', () => {
        const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        render(
            <HealthMetricsCard
                {...baseProps}
                formSchedules={[
                    {
                        id: 's1',
                        student_id: 'student-1',
                        form_template_id: 't1',
                        frequency: 'weekly',
                        is_active: true,
                        next_due_at: dueSoon,
                        last_sent_at: null,
                        created_at: '2026-04-01T00:00:00Z',
                    },
                ]}
            />,
        )
        expect(screen.getByTestId('reassessment-banner')).toBeInTheDocument()
    })

    it('marca o banner como "vencida" quando next_due_at está no passado', () => {
        const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        render(
            <HealthMetricsCard
                {...baseProps}
                formSchedules={[
                    {
                        id: 's1',
                        student_id: 'student-1',
                        form_template_id: 't1',
                        frequency: 'weekly',
                        is_active: true,
                        next_due_at: past,
                        last_sent_at: null,
                        created_at: '2026-04-01T00:00:00Z',
                    },
                ]}
            />,
        )
        const banner = screen.getByTestId('reassessment-banner')
        expect(banner.textContent).toMatch(/vencida/i)
    })

    it('NÃO mostra banner quando não há pendência nem schedule iminente', () => {
        const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        render(
            <HealthMetricsCard
                {...baseProps}
                bodyMetrics={{ weight: '78', bodyFat: null, updatedAt: '2026-04-01T00:00:00Z' }}
                formSchedules={[
                    {
                        id: 's1',
                        student_id: 'student-1',
                        form_template_id: 't1',
                        frequency: 'monthly',
                        is_active: true,
                        next_due_at: farFuture,
                        last_sent_at: null,
                        created_at: '2026-04-01T00:00:00Z',
                    },
                ]}
            />,
        )
        expect(screen.queryByTestId('reassessment-banner')).not.toBeInTheDocument()
    })

    it('dispara assignFormToStudents ao clicar num template do dropdown "Enviar reavaliação"', async () => {
        assignFormMock.mockResolvedValueOnce({ success: true })
        render(
            <HealthMetricsCard
                {...baseProps}
                bodyMetrics={{ weight: '78', bodyFat: '21', updatedAt: '2026-04-01T00:00:00Z' }}
            />,
        )

        // Abre dropdown
        fireEvent.click(screen.getByText(/Enviar reavaliação/i))
        const templateButton = await screen.findByText('Anamnese padrão')
        fireEvent.click(templateButton)

        await waitFor(() => {
            expect(assignFormMock).toHaveBeenCalledWith({
                formTemplateId: 't1',
                studentIds: ['student-1'],
            })
        })
    })

    it('mostra empty state quando não há nenhum dado', () => {
        render(<HealthMetricsCard {...baseProps} />)
        expect(screen.getByText(/Sem avaliações/i)).toBeInTheDocument()
        expect(screen.getByText(/Envie um formulário/i)).toBeInTheDocument()
    })
})
