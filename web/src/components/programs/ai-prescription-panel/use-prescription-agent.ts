'use client'

import { useCallback, useState } from 'react'
import type {
    StudentPrescriptionProfile,
    PrescriptionAgentState,
    PrescriptionAgentQuestion,
    PrescriptionContextAnalysis,
} from '@kinevo/shared/types/prescription'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import { analyzeStudentContext } from '@/actions/prescription/analyze-context'
import { generateProgram } from '@/actions/prescription/generate-program'
import { sendPrescriptionQuestionnaire } from '@/actions/prescription/questionnaire-actions'

export type PrescriptionAgentPageState =
    | 'anamnese'
    | 'analyzing'
    | 'questions'
    | 'generating'
    | 'done'
    | 'error'

export interface UsePrescriptionAgentArgs {
    studentId: string
    studentName: string
    prescriptionData: PrescriptionData
    /** Optional initial state — used when panel opens after a generation (deeplink). */
    initialPageState?: PrescriptionAgentPageState
    /** If opening directly in `done`, pass the generationId that was produced. */
    initialGenerationId?: string
}

export interface UsePrescriptionAgentReturn {
    pageState: PrescriptionAgentPageState
    profile: StudentPrescriptionProfile | null
    agentState: PrescriptionAgentState | null
    analysis: PrescriptionContextAnalysis | null
    questions: PrescriptionAgentQuestion[]
    answers: Record<string, string>
    selectedFormIds: string[]
    error: string | null
    generationId: string | null
    studentDisplayName: string
    questionnaireDismissed: boolean

    setProfile: (profile: StudentPrescriptionProfile | null) => void
    setAnswers: (updater: (prev: Record<string, string>) => Record<string, string>) => void
    setAnswer: (questionId: string, answer: string) => void
    toggleForm: (id: string) => void
    dismissQuestionnaire: () => void

    startAnalysis: () => Promise<void>
    submitAnswersAndGenerate: () => Promise<void>
    skipQuestionsAndGenerate: () => Promise<void>
    sendQuestionnaire: () => Promise<void>
    reset: () => void
}

export function usePrescriptionAgent(
    args: UsePrescriptionAgentArgs,
): UsePrescriptionAgentReturn {
    const { studentId, studentName, prescriptionData } = args

    const [profile, setProfile] = useState<StudentPrescriptionProfile | null>(
        prescriptionData.profile,
    )
    const [pageState, setPageState] = useState<PrescriptionAgentPageState>(
        args.initialPageState ?? 'anamnese',
    )
    const [error, setError] = useState<string | null>(null)

    const [agentState, setAgentState] = useState<PrescriptionAgentState | null>(null)
    const [analysis, setAnalysis] = useState<PrescriptionContextAnalysis | null>(null)
    const [questions, setQuestions] = useState<PrescriptionAgentQuestion[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [generationId, setGenerationId] = useState<string | null>(
        args.initialGenerationId ?? null,
    )
    const [studentDisplayName, setStudentDisplayName] = useState(studentName)

    const [selectedFormIds, setSelectedFormIds] = useState<string[]>(
        () => prescriptionData.formSubmissions.map(s => s.id),
    )
    const [questionnaireDismissed, setQuestionnaireDismissed] = useState(false)

    const toggleForm = useCallback((id: string) => {
        setSelectedFormIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
        )
    }, [])

    const setAnswer = useCallback((questionId: string, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }))
    }, [])

    const dismissQuestionnaire = useCallback(() => {
        setQuestionnaireDismissed(true)
    }, [])

    const sendQuestionnaire = useCallback(async () => {
        const result = await sendPrescriptionQuestionnaire(studentId)
        if (!result.success) {
            throw new Error(result.error || 'Erro ao enviar questionário')
        }
    }, [studentId])

    const executeGeneration = useCallback(
        async (state: PrescriptionAgentState | null) => {
            const result = await generateProgram(studentId, state, selectedFormIds)
            if (!result.success || !result.generationId) {
                setError(result.error || 'Erro ao gerar programa.')
                setPageState('error')
                return
            }
            setGenerationId(result.generationId)
            setPageState('done')
        },
        [studentId, selectedFormIds],
    )

    const startAnalysis = useCallback(async () => {
        setPageState('analyzing')
        setError(null)

        const analysisResult = await analyzeStudentContext(studentId, selectedFormIds)

        if (!analysisResult.success) {
            setError(analysisResult.error || 'Erro na análise.')
            setPageState('error')
            return
        }

        if (analysisResult.studentName) {
            setStudentDisplayName(analysisResult.studentName)
        }

        setAnalysis(analysisResult.analysis || null)
        setAgentState(analysisResult.agentState || null)

        if (analysisResult.questions && analysisResult.questions.length > 0) {
            setQuestions(analysisResult.questions)
            setPageState('questions')
            return
        }

        setPageState('generating')
        await executeGeneration(analysisResult.agentState || null)
    }, [studentId, selectedFormIds, executeGeneration])

    const submitAnswersAndGenerate = useCallback(async () => {
        if (!agentState) return

        const answersArray = questions.map(q => ({
            question_id: q.id,
            answer: answers[q.id] || '',
        }))

        const updatedState: PrescriptionAgentState = {
            ...agentState,
            answers: answersArray,
            phase: 'generating',
        }

        setAgentState(updatedState)
        setPageState('generating')
        await executeGeneration(updatedState)
    }, [agentState, questions, answers, executeGeneration])

    const skipQuestionsAndGenerate = useCallback(async () => {
        const stateForGeneration = agentState
            ? { ...agentState, answers: [], phase: 'generating' as const }
            : null

        setAgentState(stateForGeneration)
        setPageState('generating')
        await executeGeneration(stateForGeneration)
    }, [agentState, executeGeneration])

    const reset = useCallback(() => {
        setPageState('anamnese')
        setError(null)
        setAgentState(null)
        setAnalysis(null)
        setQuestions([])
        setAnswers({})
        setGenerationId(null)
    }, [])

    return {
        pageState,
        profile,
        agentState,
        analysis,
        questions,
        answers,
        selectedFormIds,
        error,
        generationId,
        studentDisplayName,
        questionnaireDismissed,

        setProfile,
        setAnswers,
        setAnswer,
        toggleForm,
        dismissQuestionnaire,

        startAnalysis,
        submitAnswersAndGenerate,
        skipQuestionsAndGenerate,
        sendQuestionnaire,
        reset,
    }
}
