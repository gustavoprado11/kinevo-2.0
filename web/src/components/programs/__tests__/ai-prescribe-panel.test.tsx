import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AiPrescribePanel } from '../ai-prescribe-panel'
import type { Exercise } from '@/types/exercise'
import type { Workout } from '../program-builder-client'
import type { ParseTextResponse } from '@/app/api/prescription/parse-text/types'

// ── Fixtures ──

const mockExercises: Exercise[] = [
    {
        id: 'ex-1',
        name: 'Supino Inclinado com Halteres',
        muscle_groups: [{ id: 'mg-1', name: 'Peito', owner_id: null, created_at: '' }],
        equipment: 'dumbbell',
        video_url: null,
        thumbnail_url: null,
        instructions: null,
        owner_id: null,
        is_archived: false,
        created_at: '',
        updated_at: '',
    },
    {
        id: 'ex-2',
        name: 'Puxada Aberta Barra reta',
        muscle_groups: [{ id: 'mg-2', name: 'Costas', owner_id: null, created_at: '' }],
        equipment: null,
        video_url: null,
        thumbnail_url: null,
        instructions: null,
        owner_id: null,
        is_archived: false,
        created_at: '',
        updated_at: '',
    },
    {
        id: 'ex-3',
        name: 'Agachamento Búlgaro',
        muscle_groups: [{ id: 'mg-3', name: 'Quadríceps', owner_id: null, created_at: '' }],
        equipment: 'bodyweight',
        video_url: null,
        thumbnail_url: null,
        instructions: null,
        owner_id: null,
        is_archived: false,
        created_at: '',
        updated_at: '',
    },
]

const mockWorkouts: Workout[] = [
    { id: 'w-1', name: 'Treino A', order_index: 0, items: [], frequency: [] },
]

const successResponse: ParseTextResponse = {
    workouts: [{
        name: 'Treino A',
        exercises: [
            {
                matched: true,
                exercise_id: 'ex-1',
                catalog_name: 'Supino Inclinado com Halteres',
                original_text: 'supino inclinado halter',
                sets: 4,
                reps: '8-10',
                rest_seconds: 90,
                notes: null,
            },
            {
                matched: false,
                exercise_id: null,
                catalog_name: null,
                original_text: 'Crucifixo Scott',
                sets: 3,
                reps: '12',
                rest_seconds: null,
                notes: null,
            },
        ],
    }],
}

// ── Helpers ──

function createProps(overrides?: Partial<Parameters<typeof AiPrescribePanel>[0]>) {
    return {
        onClose: vi.fn(),
        exercises: mockExercises,
        workouts: mockWorkouts,
        activeWorkoutId: 'w-1',
        onAddExerciseToWorkout: vi.fn(),
        onCreateWorkout: vi.fn(() => 'w-new'),
        ...overrides,
    }
}

function mockFetchSuccess(data: ParseTextResponse) {
    return vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
    })
}

function mockFetchError(status: number, error: string) {
    return vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: () => Promise.resolve({ error }),
    })
}

// ── Tests ──

describe('AiPrescribePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it('renderiza o título "Texto para Treino"', () => {
        render(<AiPrescribePanel {...createProps()} />)
        expect(screen.getByText('Texto para Treino')).toBeInTheDocument()
    })

    it('renderiza o textarea com placeholder', () => {
        render(<AiPrescribePanel {...createProps()} />)
        expect(screen.getByPlaceholderText(/Cole ou digite seu treino aqui/)).toBeInTheDocument()
    })

    it('botão "Gerar Treino" desabilitado quando textarea vazio', () => {
        render(<AiPrescribePanel {...createProps()} />)
        const button = screen.getByRole('button', { name: /Gerar Treino/ })
        expect(button).toBeDisabled()
    })

    it('botão "Gerar Treino" habilitado quando textarea tem texto', () => {
        render(<AiPrescribePanel {...createProps()} />)
        const textarea = screen.getByPlaceholderText(/Cole ou digite seu treino aqui/)
        fireEvent.change(textarea, { target: { value: 'Supino 3x10' } })
        const button = screen.getByRole('button', { name: /Gerar Treino/ })
        expect(button).not.toBeDisabled()
    })

    it('chama onClose ao clicar no botão X', () => {
        const props = createProps()
        render(<AiPrescribePanel {...props} />)
        // The X button is the one in the header — find by its position
        const closeButtons = screen.getAllByRole('button')
        // First button in the header area (X icon)
        const xButton = closeButtons.find(b => !b.textContent?.includes('Gerar Treino'))!
        fireEvent.click(xButton)
        expect(props.onClose).toHaveBeenCalledOnce()
    })

    it('mostra estado de loading ao clicar em Gerar Treino', async () => {
        // Mock fetch that never resolves during test
        const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}))
        vi.stubGlobal('fetch', fetchMock)

        render(<AiPrescribePanel {...createProps()} />)

        const textarea = screen.getByPlaceholderText(/Cole ou digite seu treino aqui/)
        fireEvent.change(textarea, { target: { value: 'Supino 3x10' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Analisando prescrição...')).toBeInTheDocument()
        })
    })

    it('exibe exercícios matched após resposta da API', async () => {
        vi.stubGlobal('fetch', mockFetchSuccess(successResponse))
        const props = createProps()

        render(<AiPrescribePanel {...props} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'supino inclinado halter 4x8-10' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Supino Inclinado com Halteres')).toBeInTheDocument()
            expect(screen.getByText('4x8-10 · 90s')).toBeInTheDocument()
        })

        expect(props.onAddExerciseToWorkout).toHaveBeenCalledWith('w-1', mockExercises[0], {
            sets: 4,
            reps: '8-10',
            rest_seconds: 90,
            notes: null,
        })
    })

    it('exibe exercícios unmatched com warning', async () => {
        vi.stubGlobal('fetch', mockFetchSuccess(successResponse))

        render(<AiPrescribePanel {...createProps()} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Crucifixo Scott')).toBeInTheDocument()
            expect(screen.getByText(/Não encontrado no catálogo/)).toBeInTheDocument()
        })
    })

    it('mostra summary com contagem correta de matched e unmatched', async () => {
        vi.stubGlobal('fetch', mockFetchSuccess(successResponse))

        render(<AiPrescribePanel {...createProps()} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText(/1 exercício/)).toBeInTheDocument()
            expect(screen.getByText(/1 não encontrado/)).toBeInTheDocument()
        })
    })

    it('exibe mensagem de erro quando API falha', async () => {
        vi.stubGlobal('fetch', mockFetchError(500, 'LLM call failed'))

        render(<AiPrescribePanel {...createProps()} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Erro ao processar')).toBeInTheDocument()
            expect(screen.getByText('LLM call failed')).toBeInTheDocument()
            expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
        })
    })

    it('volta ao estado idle ao clicar "Tentar novamente"', async () => {
        vi.stubGlobal('fetch', mockFetchError(500, 'Erro'))

        render(<AiPrescribePanel {...createProps()} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Tentar novamente'))

        expect(screen.getByPlaceholderText(/Cole ou digite/)).toBeInTheDocument()
    })

    it('volta ao estado idle ao clicar "Nova prescrição"', async () => {
        vi.stubGlobal('fetch', mockFetchSuccess(successResponse))

        render(<AiPrescribePanel {...createProps()} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Nova prescrição')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Nova prescrição'))

        const textarea = screen.getByPlaceholderText(/Cole ou digite/)
        expect(textarea).toBeInTheDocument()
        expect(textarea).toHaveValue('')
    })

    it('cria workout novo quando resposta tem múltiplos workouts', async () => {
        const multiWorkoutResponse: ParseTextResponse = {
            workouts: [
                {
                    name: 'Treino A',
                    exercises: [{ matched: true, exercise_id: 'ex-1', catalog_name: 'Supino Inclinado com Halteres', original_text: 'supino', sets: 3, reps: '10', rest_seconds: null, notes: null }],
                },
                {
                    name: 'Treino B',
                    exercises: [{ matched: true, exercise_id: 'ex-2', catalog_name: 'Puxada Aberta Barra reta', original_text: 'puxada', sets: 3, reps: '12', rest_seconds: null, notes: null }],
                },
            ],
        }
        vi.stubGlobal('fetch', mockFetchSuccess(multiWorkoutResponse))

        const props = createProps()
        render(<AiPrescribePanel {...props} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText(/2 exercícios/)).toBeInTheDocument()
        })

        // Treino A exists in workouts, so it should be used directly
        expect(props.onAddExerciseToWorkout).toHaveBeenCalledWith('w-1', mockExercises[0], expect.any(Object))
        // Treino B doesn't exist, so onCreateWorkout should be called
        expect(props.onCreateWorkout).toHaveBeenCalledWith('Treino B')
        expect(props.onAddExerciseToWorkout).toHaveBeenCalledWith('w-new', mockExercises[1], expect.any(Object))
    })

    it('trata erro de rede (fetch rejeita)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

        render(<AiPrescribePanel {...createProps()} />)

        fireEvent.change(screen.getByPlaceholderText(/Cole ou digite/), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: /Gerar Treino/ }))

        await waitFor(() => {
            expect(screen.getByText('Erro ao processar')).toBeInTheDocument()
            expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
        })
    })
})
