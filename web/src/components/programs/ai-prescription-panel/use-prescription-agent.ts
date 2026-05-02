'use client'

import { useCallback, useState } from 'react'
import type {
    AgentAnswerEntry,
    StudentPrescriptionProfile,
    PrescriptionAgentState,
    PrescriptionAgentQuestion,
    PrescriptionContextAnalysis,
} from '@kinevo/shared/types/prescription'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import { analyzeStudentContext } from '@/actions/prescription/analyze-context'
import { generateProgram } from '@/actions/prescription/generate-program'
import { sendPrescriptionQuestionnaire } from '@/actions/prescription/questionnaire-actions'
import { savePrescriptionProfile } from '@/actions/prescription/save-prescription-profile'

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
    /**
     * Structured form of the trainer's current answers — used for persistence
     * (profile.agent_answers) and as the initial state for the next visit.
     */
    structuredAnswers: Record<string, AgentAnswerEntry>
    /** Last persisted answers loaded from the profile, used to pre-fill the panel. */
    initialStructuredAnswers: Record<string, AgentAnswerEntry>
    selectedFormIds: string[]
    error: string | null
    generationId: string | null
    studentDisplayName: string
    questionnaireDismissed: boolean

    setProfile: (profile: StudentPrescriptionProfile | null) => void
    setAnswers: (updater: (prev: Record<string, string>) => Record<string, string>) => void
    setAnswer: (questionId: string, answer: string) => void
    setStructuredAnswer: (questionId: string, structured: AgentAnswerEntry) => void
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
    // Structured form of answers — kept in lockstep with `answers`. The panel
    // sends both via onAnswerChange + onStructuredChange. Persisted on submit
    // so the next generation cycle can pre-fill the same questions.
    const [structuredAnswers, setStructuredAnswersState] = useState<Record<string, AgentAnswerEntry>>({})
    // Initial structured answers from the previously-saved profile. Loaded
    // once at mount so the panel can seed its UI state from prior decisions.
    const initialStructuredAnswers = useState<Record<string, AgentAnswerEntry>>(
        () => prescriptionData.profile?.agent_answers ?? {},
    )[0]
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

    const setStructuredAnswer = useCallback(
        (questionId: string, structured: AgentAnswerEntry) => {
            setStructuredAnswersState(prev => ({ ...prev, [questionId]: structured }))
        },
        [],
    )

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

        // Persist trainer's structured answers back to the profile so the
        // next generation cycle pre-fills them. We do this in parallel with
        // generation — failure to save is non-blocking (we'd just lose the
        // pre-fill benefit, not the program itself).
        if (profile && Object.keys(structuredAnswers).length > 0) {
            void savePrescriptionProfile({
                student_id: profile.student_id,
                training_level: profile.training_level,
                goal: profile.goal,
                available_days: profile.available_days,
                session_duration_minutes: profile.session_duration_minutes,
                available_equipment: profile.available_equipment,
                favorite_exercise_ids: profile.favorite_exercise_ids,
                disliked_exercise_ids: profile.disliked_exercise_ids,
                medical_restrictions: profile.medical_restrictions,
                ai_mode: profile.ai_mode,
                cycle_observation: profile.cycle_observation ?? undefined,
                volume_overrides: profile.volume_overrides as
                    | Record<string, { min: number; max: number }>
                    | undefined,
                agent_answers: structuredAnswers,
            }).catch(err => {
                // Soft-fail: log but don't disrupt generation.
                console.warn('[use-prescription-agent] failed to persist agent_answers:', err)
            })
        }

        await executeGeneration(updatedState)
    }, [agentState, questions, answers, structuredAnswers, profile, executeGeneration])

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
        setStructuredAnswersState({})
        setGenerationId(null)
    }, [])

    return {
        pageState,
        profile,
        agentState,
        analysis,
        questions,
        answers,
        structuredAnswers,
        initialStructuredAnswers,
        selectedFormIds,
        error,
        generationId,
        studentDisplayName,
        questionnaireDismissed,

        setProfile,
        setAnswers,
        setAnswer,
        setStructuredAnswer,
        toggleForm,
        dismissQuestionnaire,

        startAnalysis,
        submitAnswersAndGenerate,
        skipQuestionsAndGenerate,
        sendQuestionnaire,
        reset,
    }
}
