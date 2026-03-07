'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { ChevronLeft, Sparkles } from 'lucide-react'

import { PrescriptionProfileForm } from '@/components/prescription/prescription-profile-form'
import { GenerationStatus } from '@/components/prescription/generation-status'
import { AgentQuestionsPanel } from '@/components/prescription/agent-questions-panel'
import { QuestionnairePromptCard } from '@/components/prescription/questionnaire-prompt-card'
import { QuestionnaireBadge } from '@/components/prescription/questionnaire-badge'

import { generateProgram } from '@/actions/prescription/generate-program'
import { analyzeStudentContext } from '@/actions/prescription/analyze-context'
import { sendPrescriptionQuestionnaire } from '@/actions/prescription/questionnaire-actions'
import { mapQuestionnaireToProfile } from '@/lib/prescription/questionnaire-mapper'

import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import type {
    StudentPrescriptionProfile,
    PrescriptionAgentState,
    PrescriptionAgentQuestion,
    PrescriptionContextAnalysis,
} from '@kinevo/shared/types/prescription'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

// ============================================================================
// Types
// ============================================================================

interface Student {
    id: string
    name: string
    email: string
    avatar_url: string | null
}

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
}

type PageState = 'anamnese' | 'analyzing' | 'questions' | 'generating'

// ============================================================================
// Component
// ============================================================================

interface PrescribeClientProps {
    trainer: Trainer
    student: Student
    prescriptionData: PrescriptionData
}

export function PrescribeClient({ trainer, student, prescriptionData }: PrescribeClientProps) {
    const router = useRouter()
    const [profile, setProfile] = useState<StudentPrescriptionProfile | null>(prescriptionData.profile)
    const [pageState, setPageState] = useState<PageState>('anamnese')
    const [error, setError] = useState<string | null>(null)

    // Agent state
    const [agentState, setAgentState] = useState<PrescriptionAgentState | null>(null)
    const [analysis, setAnalysis] = useState<PrescriptionContextAnalysis | null>(null)
    const [questions, setQuestions] = useState<PrescriptionAgentQuestion[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [studentDisplayName, setStudentDisplayName] = useState(student.name)

    // Questionnaire state
    const questionnaireData = prescriptionData.questionnaireSubmission && profile
        ? mapQuestionnaireToProfile(
            prescriptionData.questionnaireSubmission.answers_json?.answers || {},
            profile,
            prescriptionData.exercises,
        )
        : null

    const [questionnaireDismissed, setQuestionnaireDismissed] = useState(false)

    const handleSendQuestionnaire = useCallback(async () => {
        const result = await sendPrescriptionQuestionnaire(student.id)
        if (!result.success) {
            throw new Error(result.error || 'Erro ao enviar')
        }
    }, [student.id])

    // ── Profile Save ──
    const handleProfileSaved = useCallback((savedProfile: StudentPrescriptionProfile) => {
        setProfile(savedProfile)
        setError(null)
    }, [])

    // ── Execute generation (shared by both paths) ──
    const executeGeneration = useCallback(async (state: PrescriptionAgentState | null) => {
        const result = await generateProgram(student.id, state)

        if (!result.success || !result.generationId) {
            setError(result.error || 'Erro ao gerar programa.')
            setPageState('anamnese')
            return
        }

        router.push(
            `/students/${student.id}/program/new?source=prescription&generationId=${result.generationId}`
        )
    }, [student.id, router])

    // ── Generate Program: Phase 1 (analyze) → Phase 2 (questions or generate) ──
    const handleGenerate = useCallback(async () => {
        setPageState('analyzing')
        setError(null)

        // Phase 1: Analyze context with Claude agent
        const analysisResult = await analyzeStudentContext(student.id)

        if (!analysisResult.success) {
            setError(analysisResult.error || 'Erro na análise.')
            setPageState('anamnese')
            return
        }

        if (analysisResult.studentName) {
            setStudentDisplayName(analysisResult.studentName)
        }

        setAnalysis(analysisResult.analysis || null)
        setAgentState(analysisResult.agentState || null)

        // If agent has questions, show them
        if (analysisResult.questions && analysisResult.questions.length > 0) {
            setQuestions(analysisResult.questions)
            setPageState('questions')
            return
        }

        // No questions needed — proceed to generation
        setPageState('generating')
        await executeGeneration(analysisResult.agentState || null)
    }, [student.id, executeGeneration])

    // ── Answer questions and generate ──
    const handleAnswersSubmit = useCallback(async () => {
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

    // ── Skip questions and generate without answers ──
    const handleSkipQuestions = useCallback(async () => {
        const stateForGeneration = agentState
            ? { ...agentState, answers: [], phase: 'generating' as const }
            : null

        setAgentState(stateForGeneration)
        setPageState('generating')
        await executeGeneration(stateForGeneration)
    }, [agentState, executeGeneration])

    // ── Answer change handler ──
    const handleAnswerChange = useCallback((questionId: string, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }))
    }, [])

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push(`/students/${student.id}`)}
                        className="p-2 rounded-xl bg-glass-bg hover:bg-glass-bg-hover transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-k-text-tertiary" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-black text-k-text-primary tracking-tight flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-violet-500" />
                            Prescrição com Copiloto
                        </h1>
                        <p className="text-sm text-k-text-secondary mt-0.5">
                            {student.name}
                        </p>
                    </div>
                    {!prescriptionData.aiEnabled && (
                        <span className="px-3 py-1.5 text-[10px] font-bold rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            IA desabilitada
                        </span>
                    )}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="ml-3 underline text-red-300 hover:text-red-200"
                        >
                            Fechar
                        </button>
                    </div>
                )}

                {/* State 1: Anamnese / Form */}
                {pageState === 'anamnese' && (
                    <div data-onboarding="prescription-profile">
                        {/* Questionnaire badge (if answered) */}
                        {questionnaireData && prescriptionData.questionnaireSubmission && (
                            <QuestionnaireBadge
                                completedAt={prescriptionData.questionnaireSubmission.submitted_at}
                                divergences={questionnaireData.divergences}
                            />
                        )}

                        {/* Questionnaire prompt card (if not answered and not dismissed) */}
                        {!prescriptionData.questionnaireSubmission && !questionnaireDismissed && profile && (
                            <QuestionnairePromptCard
                                studentName={student.name}
                                onSend={handleSendQuestionnaire}
                                onSkip={() => setQuestionnaireDismissed(true)}
                            />
                        )}

                        <PrescriptionProfileForm
                            studentId={student.id}
                            existingProfile={profile}
                            onSaved={handleProfileSaved}
                            recentSessions={prescriptionData.recentSessions}
                            activeProgram={prescriptionData.activeProgram}
                            previousProgramCount={prescriptionData.previousProgramCount}
                            lastFormSubmissionDate={prescriptionData.lastFormSubmissionDate}
                            onGenerate={handleGenerate}
                        />
                    </div>
                )}

                {/* State 2: Analyzing (agent context analysis) */}
                {pageState === 'analyzing' && (
                    <GenerationStatus studentName={studentDisplayName} phase="analyzing" />
                )}

                {/* State 3: Questions (agent needs clarification) */}
                {pageState === 'questions' && (
                    <AgentQuestionsPanel
                        questions={questions}
                        analysis={analysis}
                        studentName={studentDisplayName}
                        answers={answers}
                        onAnswerChange={handleAnswerChange}
                        onSubmit={handleAnswersSubmit}
                        onSkip={handleSkipQuestions}
                        isSubmitting={false}
                    />
                )}

                {/* State 4: Generating (animated steps → redirect) */}
                {pageState === 'generating' && (
                    <GenerationStatus studentName={studentDisplayName} phase="generating" />
                )}
            </div>

            {/* Tour: Prescribe (auto-start on first visit) */}
            <TourRunner tourId="prescribe" steps={TOUR_STEPS.prescribe} autoStart />
        </AppLayout>
    )
}
