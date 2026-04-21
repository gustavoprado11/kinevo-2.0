import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import {
    fixtureAgentState,
    fixtureAnalysis,
    fixtureProfile,
    fixtureQuestion,
} from '@/lib/prescription/__fixtures__/prescription-output'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'

// ── Mock server actions at the module boundary ──
vi.mock('@/actions/prescription/analyze-context', () => ({
    analyzeStudentContext: vi.fn(),
}))
vi.mock('@/actions/prescription/generate-program', () => ({
    generateProgram: vi.fn(),
}))
vi.mock('@/actions/prescription/questionnaire-actions', () => ({
    sendPrescriptionQuestionnaire: vi.fn(),
}))

import { analyzeStudentContext } from '@/actions/prescription/analyze-context'
import { generateProgram } from '@/actions/prescription/generate-program'
import { sendPrescriptionQuestionnaire } from '@/actions/prescription/questionnaire-actions'
import { usePrescriptionAgent } from '../use-prescription-agent'

const baseData: PrescriptionData = {
    profile: fixtureProfile,
    exercises: [],
    recentSessions: [],
    activeProgram: null,
    aiEnabled: true,
    previousProgramCount: 0,
    lastFormSubmissionDate: null,
    questionnaireSubmission: null,
    questionnaireTemplateId: null,
    formSubmissions: [],
}

describe('usePrescriptionAgent', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('starts in anamnese with profile pre-loaded', () => {
        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Carlos',
                prescriptionData: baseData,
            }),
        )
        expect(result.current.pageState).toBe('anamnese')
        expect(result.current.profile).toEqual(fixtureProfile)
        expect(result.current.generationId).toBeNull()
    })

    it('happy path: analysis returns questions → submit → generate → done', async () => {
        vi.mocked(analyzeStudentContext).mockResolvedValue({
            success: true,
            analysis: fixtureAnalysis,
            questions: [fixtureQuestion],
            agentState: fixtureAgentState,
            studentName: 'Carlos',
        })
        vi.mocked(generateProgram).mockResolvedValue({
            success: true,
            generationId: 'gen-123',
            source: 'agent',
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Carlos',
                prescriptionData: baseData,
            }),
        )

        await act(async () => {
            await result.current.startAnalysis()
        })
        expect(result.current.pageState).toBe('questions')
        expect(result.current.questions).toHaveLength(1)

        act(() => {
            result.current.setAnswer('equipment', 'Academia completa')
        })
        expect(result.current.answers.equipment).toBe('Academia completa')

        await act(async () => {
            await result.current.submitAnswersAndGenerate()
        })

        expect(result.current.pageState).toBe('done')
        expect(result.current.generationId).toBe('gen-123')
        expect(vi.mocked(generateProgram)).toHaveBeenCalledWith(
            's1',
            expect.objectContaining({ phase: 'generating' }),
            [],
        )
    })

    it('skips questions path', async () => {
        vi.mocked(analyzeStudentContext).mockResolvedValue({
            success: true,
            analysis: fixtureAnalysis,
            questions: [fixtureQuestion],
            agentState: fixtureAgentState,
        })
        vi.mocked(generateProgram).mockResolvedValue({
            success: true,
            generationId: 'gen-abc',
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
            }),
        )

        await act(async () => {
            await result.current.startAnalysis()
        })
        await act(async () => {
            await result.current.skipQuestionsAndGenerate()
        })

        expect(result.current.pageState).toBe('done')
    })

    it('analysis without questions proceeds straight to generation', async () => {
        vi.mocked(analyzeStudentContext).mockResolvedValue({
            success: true,
            analysis: fixtureAnalysis,
            questions: [],
            agentState: undefined,
        })
        vi.mocked(generateProgram).mockResolvedValue({
            success: true,
            generationId: 'gen-xyz',
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
            }),
        )

        await act(async () => {
            await result.current.startAnalysis()
        })

        await waitFor(() => expect(result.current.pageState).toBe('done'))
        expect(result.current.generationId).toBe('gen-xyz')
    })

    it('analysis failure → error state with message', async () => {
        vi.mocked(analyzeStudentContext).mockResolvedValue({
            success: false,
            error: 'Perfil não encontrado',
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
            }),
        )

        await act(async () => {
            await result.current.startAnalysis()
        })

        expect(result.current.pageState).toBe('error')
        expect(result.current.error).toBe('Perfil não encontrado')
    })

    it('generation failure → error state', async () => {
        vi.mocked(analyzeStudentContext).mockResolvedValue({
            success: true,
            analysis: fixtureAnalysis,
            questions: [],
            agentState: null as unknown as undefined,
        })
        vi.mocked(generateProgram).mockResolvedValue({
            success: false,
            error: 'LLM timeout',
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
            }),
        )

        await act(async () => {
            await result.current.startAnalysis()
        })

        await waitFor(() => expect(result.current.pageState).toBe('error'))
        expect(result.current.error).toBe('LLM timeout')
    })

    it('reset() returns to anamnese preserving profile', async () => {
        vi.mocked(analyzeStudentContext).mockResolvedValue({
            success: true,
            questions: [fixtureQuestion],
            agentState: fixtureAgentState,
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
            }),
        )

        await act(async () => {
            await result.current.startAnalysis()
        })
        expect(result.current.pageState).toBe('questions')

        act(() => {
            result.current.reset()
        })

        expect(result.current.pageState).toBe('anamnese')
        expect(result.current.profile).toEqual(fixtureProfile)
        expect(result.current.questions).toHaveLength(0)
        expect(result.current.generationId).toBeNull()
    })

    it('toggleForm adds/removes form ids', () => {
        const data: PrescriptionData = {
            ...baseData,
            formSubmissions: [
                {
                    id: 'f1',
                    form_template_id: 't1',
                    template_title: 'Test',
                    template_category: 'survey',
                    system_key: null,
                    submitted_at: '',
                    answers_json: {},
                    schema_snapshot_json: {},
                },
            ],
        }
        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: data,
            }),
        )

        expect(result.current.selectedFormIds).toEqual(['f1'])
        act(() => result.current.toggleForm('f1'))
        expect(result.current.selectedFormIds).toEqual([])
        act(() => result.current.toggleForm('f1'))
        expect(result.current.selectedFormIds).toEqual(['f1'])
    })

    it('initialPageState=done + initialGenerationId seeds deeplink state', () => {
        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
                initialPageState: 'done',
                initialGenerationId: 'seeded-id',
            }),
        )

        expect(result.current.pageState).toBe('done')
        expect(result.current.generationId).toBe('seeded-id')
    })

    it('sendQuestionnaire throws on failure', async () => {
        vi.mocked(sendPrescriptionQuestionnaire).mockResolvedValue({
            success: false,
            error: 'Template not found',
        })

        const { result } = renderHook(() =>
            usePrescriptionAgent({
                studentId: 's1',
                studentName: 'Aluno',
                prescriptionData: baseData,
            }),
        )

        await expect(result.current.sendQuestionnaire()).rejects.toThrow(
            'Template not found',
        )
    })
})
