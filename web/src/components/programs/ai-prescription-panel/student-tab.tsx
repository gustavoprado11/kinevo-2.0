'use client'

import { useEffect, useRef } from 'react'
import { PrescriptionProfileForm } from '@/components/prescription/prescription-profile-form'
import { GenerationStatus } from '@/components/prescription/generation-status'
import { AgentQuestionsPanel } from '@/components/prescription/agent-questions-panel'
import { QuestionnairePromptCard } from '@/components/prescription/questionnaire-prompt-card'
import { FormSubmissionsCard } from '@/components/prescription/form-submissions-card'
import { QuestionnaireBadge } from '@/components/prescription/questionnaire-badge'
import { PrescriptionStepper } from '@/components/prescription/prescription-stepper'
import { mapQuestionnaireToProfile } from '@/lib/prescription/questionnaire-mapper'
import { Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import type { UsePrescriptionAgentReturn } from './use-prescription-agent'

interface StudentTabProps {
    studentId: string
    studentName: string
    prescriptionData: PrescriptionData
    agent: UsePrescriptionAgentReturn
    onClose: () => void
    onAcceptGeneratedProgram: (generationId: string) => void
    /**
     * True when the panel was opened via deeplink (URL already carried
     * generationId), so pageState='done' was the initial state, not a
     * transition from 'generating'. In that case, auto-navigation would
     * loop — the URL is already correct.
     */
    deeplinkMode?: boolean
}

export function AiPrescriptionPanelStudentTab({
    studentId,
    studentName,
    prescriptionData,
    agent,
    onClose,
    onAcceptGeneratedProgram,
    deeplinkMode = false,
}: StudentTabProps) {
    const {
        pageState,
        profile,
        analysis,
        questions,
        answers,
        selectedFormIds,
        generationId,
        studentDisplayName,
        questionnaireDismissed,
        setProfile,
        setAnswer,
        toggleForm,
        dismissQuestionnaire,
        startAnalysis,
        submitAnswersAndGenerate,
        skipQuestionsAndGenerate,
        sendQuestionnaire,
        reset,
        error,
    } = agent

    const questionnaireData = prescriptionData.questionnaireSubmission && profile
        ? mapQuestionnaireToProfile(
            prescriptionData.questionnaireSubmission.answers_json?.answers || {},
            profile,
            prescriptionData.exercises,
        )
        : null

    const currentStepperStep: 1 | 2 | 3 =
        pageState === 'anamnese' ? 1
            : pageState === 'analyzing' || pageState === 'questions' ? 2
                : 3

    // Auto-navigate the builder to ?source=prescription&generationId=… as soon
    // as the pipeline reports 'done'. This is what triggers the progressive
    // reveal in the canvas — if we wait for the trainer to click "Fechar
    // painel", the reveal animation runs while attention is already on the
    // panel button, not the canvas.
    //
    // Guarded two ways:
    //   1. deeplinkMode — when the panel was opened with pageState='done'
    //      already (URL carried generationId), navigation already happened;
    //      firing it again would create a loop.
    //   2. didAutoNavigateRef — one-shot, so re-renders don't re-trigger.
    const didAutoNavigateRef = useRef(deeplinkMode)
    useEffect(() => {
        if (didAutoNavigateRef.current) return
        if (pageState !== 'done') return
        if (!generationId) return
        didAutoNavigateRef.current = true
        onAcceptGeneratedProgram(generationId)
    }, [pageState, generationId, onAcceptGeneratedProgram])

    return (
        <div className="flex flex-col h-full">
            {/* Scrollable content. The top/bottom mask fades content near the edges
                so the user sees there's more to scroll even without a visible scrollbar. */}
            <div
                className="flex-1 overflow-y-auto px-5 py-5"
                style={{
                    maskImage:
                        'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
                    WebkitMaskImage:
                        'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
                }}
            >
                {(pageState === 'anamnese' || pageState === 'analyzing' || pageState === 'questions' || pageState === 'generating') && (
                    <PrescriptionStepper currentStep={currentStepperStep} className="mb-6" />
                )}

                {error && pageState === 'error' && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {pageState === 'anamnese' && (
                    <div data-onboarding="prescription-profile">
                        {prescriptionData.formSubmissions.length > 0 && (
                            <FormSubmissionsCard
                                submissions={prescriptionData.formSubmissions}
                                selectedIds={selectedFormIds}
                                onToggle={toggleForm}
                            />
                        )}

                        {questionnaireData && prescriptionData.questionnaireSubmission && (
                            <QuestionnaireBadge
                                completedAt={prescriptionData.questionnaireSubmission.submitted_at}
                                divergences={questionnaireData.divergences}
                            />
                        )}

                        {!prescriptionData.questionnaireSubmission && !questionnaireDismissed && profile && selectedFormIds.length === 0 && (
                            <QuestionnairePromptCard
                                studentName={studentName}
                                onSend={sendQuestionnaire}
                                onSkip={dismissQuestionnaire}
                            />
                        )}

                        <PrescriptionProfileForm
                            studentId={studentId}
                            existingProfile={profile}
                            questionnaireData={questionnaireData}
                            onSaved={setProfile}
                            recentSessions={prescriptionData.recentSessions}
                            activeProgram={prescriptionData.activeProgram}
                            previousProgramCount={prescriptionData.previousProgramCount}
                            lastFormSubmissionDate={prescriptionData.lastFormSubmissionDate}
                            onGenerate={startAnalysis}
                            compactMode={selectedFormIds.length > 0}
                        />
                    </div>
                )}

                {pageState === 'analyzing' && (
                    <GenerationStatus studentName={studentDisplayName} phase="analyzing" />
                )}

                {pageState === 'questions' && (
                    <AgentQuestionsPanel
                        questions={questions}
                        analysis={analysis}
                        studentName={studentDisplayName}
                        answers={answers}
                        onAnswerChange={setAnswer}
                        onSubmit={submitAnswersAndGenerate}
                        onSkip={skipQuestionsAndGenerate}
                        isSubmitting={false}
                    />
                )}

                {pageState === 'generating' && (
                    <GenerationStatus studentName={studentDisplayName} phase="generating" />
                )}

                {pageState === 'done' && (
                    <div className="flex flex-col items-center text-center gap-3 py-8">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Check className="w-6 h-6 text-emerald-500" />
                        </div>
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Programa gerado
                        </h3>
                        <p className="text-sm text-k-text-secondary max-w-xs">
                            Revise o programa à esquerda no construtor. Você pode ajustar antes de ativar.
                        </p>
                    </div>
                )}

                {pageState === 'error' && (
                    <div className="flex flex-col items-center text-center gap-3 py-8">
                        <Sparkles className="w-8 h-8 text-red-400" />
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Algo deu errado
                        </h3>
                        <p className="text-sm text-k-text-secondary max-w-xs">
                            {error || 'Não foi possível gerar o programa. Tente novamente.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Sticky footer with contextual CTA */}
            {(pageState === 'done' || pageState === 'error') && (
                <div className="flex-shrink-0 border-t border-k-border-subtle px-5 py-3 bg-white dark:bg-surface-primary">
                    {pageState === 'done' && (
                        <Button
                            onClick={onClose}
                            className="w-full rounded-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-medium"
                        >
                            Fechar painel
                        </Button>
                    )}
                    {pageState === 'error' && (
                        <Button
                            onClick={reset}
                            className="w-full rounded-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-medium"
                        >
                            Tentar de novo
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
