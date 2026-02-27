'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { PrescriptionProfileForm } from '@/components/prescription/prescription-profile-form'
import { GenerationStatus } from '@/components/prescription/generation-status'

import { generateProgram } from '@/actions/prescription/generate-program'

import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import type { StudentPrescriptionProfile } from '@kinevo/shared/types/prescription'
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

type PageState = 'anamnese' | 'generating'

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

    // ── Profile Save ──
    const handleProfileSaved = useCallback((savedProfile: StudentPrescriptionProfile) => {
        setProfile(savedProfile)
        setError(null)
    }, [])

    // ── Generate Program → redirect to builder ──
    const handleGenerate = useCallback(async () => {
        setPageState('generating')
        setError(null)

        const result = await generateProgram(student.id)

        if (!result.success || !result.generationId) {
            setError(result.error || 'Erro ao gerar programa.')
            setPageState('anamnese')
            return
        }

        // Redirect directly to the program builder with the generation data
        router.push(
            `/students/${student.id}/program/new?source=prescription&generationId=${result.generationId}`
        )
    }, [student.id, router])

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
                            Prescrição Inteligente
                        </h1>
                        <p className="text-sm text-k-text-tertiary mt-0.5">
                            {student.name}
                        </p>
                    </div>
                    {!prescriptionData.aiEnabled && (
                        <span className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
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

                {/* State 1: Anamnese */}
                {pageState === 'anamnese' && (
                    <div className="space-y-6">
                        <div data-onboarding="prescription-profile">
                            <PrescriptionProfileForm
                                studentId={student.id}
                                existingProfile={profile}
                                onSaved={handleProfileSaved}
                            />
                        </div>

                        {/* Generate button — only shows when profile exists */}
                        {profile && (
                            <div data-onboarding="prescription-generate" className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-k-text-primary">Gerar Programa</h3>
                                        <p className="text-sm text-k-text-tertiary mt-1">
                                            A IA vai criar um programa personalizado com base no perfil acima.
                                            Você poderá editar livremente antes de publicar.
                                            {prescriptionData.activeProgram && (
                                                <span className="text-amber-400 ml-1">
                                                    O programa ativo atual ({prescriptionData.activeProgram.name}) será finalizado ao publicar.
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleGenerate}
                                        className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Gerar Programa
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* State 2: Generating (animated steps → redirect) */}
                {pageState === 'generating' && (
                    <GenerationStatus studentName={student.name} />
                )}
            </div>

            {/* Tour: Prescribe (auto-start on first visit) */}
            <TourRunner tourId="prescribe" steps={TOUR_STEPS.prescribe} autoStart />
        </AppLayout>
    )
}
