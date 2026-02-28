'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import {
    StudentHeader,
    ActiveProgramDashboard,
    ProgramHistorySection
} from '@/components/students'
import { AssignProgramModal } from '@/components/students/assign-program-modal' // Direct import
import { CompleteProgramModal } from '@/components/students/complete-program-modal' // Direct import
import { StudentModal } from '@/components/student-modal'
import { completeProgram } from './actions/complete-program'
import { deleteStudent } from './actions/student-actions'
import { activateProgram } from './actions/activate-program'
import { deleteProgram } from './actions/delete-program'
import { updateTrainerNotes } from './actions/update-trainer-notes'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection'

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality: 'online' | 'presential'
    avatar_url: string | null
    created_at: string
    is_trainer_profile: boolean | null
    trainer_notes: string | null
}

interface AssignedProgram {
    id: string
    name: string
    description: string | null
    status: 'active' | 'completed' | 'paused' | 'scheduled'
    duration_weeks: number | null
    current_week: number | null
    started_at: string | null
    scheduled_start_date?: string | null
    created_at: string
    assigned_workouts?: Array<{
        id: string
        name: string
        scheduled_days: number[]
    }>
}

interface CompletedProgram {
    id: string
    name: string
    description: string | null
    started_at: string | null
    completed_at: string | null
    duration_weeks: number | null
    workouts_count: number
    sessions_count: number
}

interface HistorySummary {
    totalSessions: number
    lastSessionDate: string | null
    completedThisWeek: number
    expectedPerWeek: number
    streak: number
}

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
    ai_prescriptions_enabled?: boolean
}

interface CalendarSession {
    id: string
    assigned_workout_id: string
    started_at: string
    completed_at: string | null
    status: 'in_progress' | 'completed'
    rpe: number | null
}

interface StudentDetailClientProps {
    trainer: Trainer
    student: Student
    activeProgram: AssignedProgram | null
    scheduledPrograms: AssignedProgram[]
    historySummary: HistorySummary
    completedPrograms: CompletedProgram[]
    recentSessions: any[]
    calendarInitialSessions: CalendarSession[]
    weeklyAdherence?: { week: number; rate: number }[]
    tonnageMap?: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>
}

export function StudentDetailClient({
    trainer,
    student: initialStudent,
    activeProgram,
    scheduledPrograms,
    historySummary,
    recentSessions,
    calendarInitialSessions = [],
    completedPrograms,
    weeklyAdherence = [],
    tonnageMap = {}
}: StudentDetailClientProps) {
    console.log('StudentDetailClient Rendered. Scheduled:', scheduledPrograms) // DEBUG LOG
    const router = useRouter()
    const [student, setStudent] = useState<Student>(initialStudent)
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [assignModalMode, setAssignModalMode] = useState<'immediate' | 'scheduled'>('immediate')
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [trainerNotes, setTrainerNotes] = useState(initialStudent.trainer_notes || '')
    const [notesSaving, setNotesSaving] = useState(false)
    const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleNotesChange = useCallback((value: string) => {
        setTrainerNotes(value)
        if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current)
        notesTimeoutRef.current = setTimeout(async () => {
            setNotesSaving(true)
            await updateTrainerNotes(student.id, value)
            setNotesSaving(false)
        }, 500)
    }, [student.id])

    const handleAssignProgram = () => {
        setAssignModalMode('immediate')
        setIsAssignModalOpen(true)
    }

    const handleAssignScheduled = () => {
        setAssignModalMode('scheduled')
        setIsAssignModalOpen(true)
    }

    const handleCreateScheduled = () => {
        router.push(`/students/${student.id}/program/new?scheduled=true`)
    }

    const handleEditProgram = () => {
        if (activeProgram) {
            router.push(`/students/${student.id}/program/${activeProgram.id}/edit`)
        }
    }

    const handleCompleteProgram = () => {
        setIsCompleteModalOpen(true)
    }

    const handleConfirmComplete = async () => {
        if (!activeProgram) return

        const result = await completeProgram(activeProgram.id, student.id)
        if (result.success) {
            router.refresh()
        } else {
            alert(result.error || 'Erro ao concluir programa')
        }
        setIsCompleteModalOpen(false)
    }

    const handleProgramAssigned = () => {
        router.refresh()
    }

    const handleCreateProgram = () => {
        router.push(`/students/${student.id}/program/new`)
    }

    const handlePrescribeAI = () => {
        router.push(`/students/${student.id}/prescribe`)
    }

    // --- Student Actions ---
    const handleEditStudent = () => {
        setIsEditModalOpen(true)
    }

    const handleStudentUpdated = (updatedStudent: Record<string, any>) => {
        setStudent({ ...student, ...updatedStudent })
        setIsEditModalOpen(false)
        router.refresh()
    }

    const handleDeleteStudent = async () => {
        const result = await deleteStudent(student.id)
        if (result.success) {
            router.push('/students')
        } else {
            alert(result.error || 'Erro ao excluir aluno')
        }
    }

    // --- Scheduled Program Actions ---
    const handleActivateScheduled = async (programId: string) => {
        if (activeProgram) {
            if (!confirm('Ao ativar este programa, o programa atual será encerrado. Deseja continuar?')) return
        } else {
            if (!confirm('Deseja ativar este programa agora?')) return
        }

        setProcessingId(programId)
        try {
            const result = await activateProgram(programId)
            if (!result.success) alert(result.error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeleteScheduled = async (programId: string) => {
        if (!confirm('Tem certeza que deseja remover este programa da fila?')) return

        setProcessingId(programId)
        try {
            const result = await deleteProgram(programId)
            if (!result.success) alert(result.error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleEditScheduled = (programId: string) => {
        router.push(`/students/${student.id}/program/${programId}/edit`)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            <div className="min-h-screen bg-surface-primary -m-8 p-8 space-y-6">
                {/* Student Header */}
                <StudentHeader
                    student={student}
                    onEdit={handleEditStudent}
                    onDelete={handleDeleteStudent}
                >
                    {activeProgram && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-k-text-tertiary">
                            {historySummary.expectedPerWeek > 0 && (
                                <span className={historySummary.completedThisWeek >= historySummary.expectedPerWeek ? 'text-emerald-400' : 'text-yellow-400'}>
                                    {historySummary.completedThisWeek}/{historySummary.expectedPerWeek} esta semana
                                </span>
                            )}

                            {historySummary.streak > 0 && (
                                <>
                                    <span className="text-k-text-quaternary">·</span>
                                    <span>{historySummary.streak} treinos seguidos</span>
                                </>
                            )}

                            {(() => {
                                const rpeValues = recentSessions.map((s: any) => s.rpe).filter((r: any) => r != null && r > 0) as number[]
                                if (rpeValues.length === 0) return null
                                const avg = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
                                return (
                                    <>
                                        <span className="text-k-text-quaternary">·</span>
                                        <span>PSE média: {avg.toFixed(1)}</span>
                                    </>
                                )
                            })()}

                            {(() => {
                                const changes = Object.values(tonnageMap).filter(t => t.percentChange != null)
                                if (changes.length === 0) return null
                                const avgChange = changes.reduce((sum, t) => sum + t.percentChange!, 0) / changes.length
                                if (avgChange === 0) return null
                                return (
                                    <>
                                        <span className="text-k-text-quaternary">·</span>
                                        <span className={avgChange > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            {avgChange > 0 ? '+' : ''}{avgChange.toFixed(1)}% carga
                                        </span>
                                    </>
                                )
                            })()}
                        </div>
                    )}
                </StudentHeader>

                {/* Inactivity Alert */}
                {activeProgram && (() => {
                    const lastDate = historySummary.lastSessionDate
                    if (!lastDate && historySummary.totalSessions === 0) {
                        return (
                            <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-sm font-medium text-amber-400">Ainda não iniciou o programa</span>
                            </div>
                        )
                    }
                    if (lastDate) {
                        const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
                        const isAlert = daysSince >= 6
                        const isWarning = daysSince >= 3
                        if (isWarning) {
                            return (
                                <div className={`flex items-center gap-3 px-5 py-3 rounded-xl ${
                                    isAlert
                                        ? 'bg-red-500/10 border border-red-500/20'
                                        : 'bg-yellow-500/10 border border-yellow-500/20'
                                }`}>
                                    <svg className={`w-4 h-4 shrink-0 ${isAlert ? 'text-red-500' : 'text-yellow-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span className={`text-sm font-medium ${isAlert ? 'text-red-400' : 'text-yellow-400'}`}>
                                        Sem treino há {daysSince} dias
                                        <span className="text-k-text-quaternary ml-1">
                                            (último: {new Date(lastDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')})
                                        </span>
                                    </span>
                                </div>
                            )
                        }
                    }
                    return null
                })()}

                {/* Main Content Grid - New Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Active Program Dashboard */}
                    <div data-onboarding="student-actions">
                        <ActiveProgramDashboard
                            program={activeProgram}
                            summary={historySummary}
                            recentSessions={recentSessions}
                            calendarInitialSessions={calendarInitialSessions}
                            weeklyAdherence={weeklyAdherence}
                            tonnageMap={tonnageMap}
                            onAssignProgram={handleAssignProgram}
                            onEditProgram={handleEditProgram}
                            onCompleteProgram={handleCompleteProgram}
                            onCreateProgram={handleCreateProgram}
                            onPrescribeAI={trainer.ai_prescriptions_enabled ? handlePrescribeAI : undefined}
                            hasActiveProgram={!!activeProgram}
                        />
                    </div>

                    {/* Right Column: Notes → Queue → History */}
                    <div className="space-y-6 lg:col-span-1">
                        {/* Trainer Notes — First (most frequently used) */}
                        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    Observações
                                    <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold uppercase tracking-widest border border-k-border-subtle">
                                        Notas
                                    </span>
                                </h3>
                                {notesSaving && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary animate-pulse">
                                        Salvando...
                                    </span>
                                )}
                            </div>
                            <textarea
                                value={trainerNotes}
                                onChange={(e) => handleNotesChange(e.target.value)}
                                placeholder="Observações sobre o aluno..."
                                className="w-full min-h-[80px] bg-transparent text-sm text-k-text-secondary placeholder-k-text-quaternary resize-y outline-none p-0"
                            />
                        </div>

                        {/* Scheduled Programs — Compact */}
                        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    Próximos Programas
                                    <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold uppercase tracking-widest border border-k-border-subtle">
                                        Fila
                                    </span>
                                </h3>
                                {scheduledPrograms && scheduledPrograms.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleCreateScheduled} className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-lg transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                        <button onClick={handleAssignScheduled} className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-lg transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!scheduledPrograms || scheduledPrograms.length === 0 ? (
                                <div className="text-center py-4">
                                    {(() => {
                                        const programProgress = activeProgram?.started_at && activeProgram?.duration_weeks
                                            ? (getProgramWeek(new Date(), activeProgram.started_at, activeProgram.duration_weeks) ?? 1) / activeProgram.duration_weeks
                                            : 0
                                        const remainingWeeks = activeProgram?.started_at && activeProgram?.duration_weeks
                                            ? Math.max(0, activeProgram.duration_weeks - (getProgramWeek(new Date(), activeProgram.started_at, activeProgram.duration_weeks) ?? 1))
                                            : 0

                                        if (!activeProgram) {
                                            return <p className="text-sm text-k-text-quaternary mb-3">Aluno sem programa ativo.</p>
                                        }
                                        if (programProgress >= 0.75) {
                                            return <p className="text-sm text-yellow-400 mb-3">Programa termina em {remainingWeeks} semana{remainingWeeks !== 1 ? 's' : ''}! Prepare o próximo ciclo.</p>
                                        }
                                        if (programProgress >= 0.5) {
                                            return <p className="text-sm text-k-text-quaternary mb-3">Programa em {Math.round(programProgress * 100)}% — bom momento para planejar o próximo.</p>
                                        }
                                        return <p className="text-sm text-k-text-quaternary mb-3">Nenhum programa na fila.</p>
                                    })()}
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={handleCreateScheduled}
                                            className="px-3 py-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all"
                                        >
                                            + Criar Novo
                                        </button>
                                        <button
                                            onClick={handleAssignScheduled}
                                            className="px-3 py-1.5 text-xs font-bold text-k-text-tertiary hover:text-k-text-primary border border-k-border-subtle rounded-lg transition-all"
                                        >
                                            Atribuir
                                        </button>
                                        {trainer.ai_prescriptions_enabled && (
                                            <button
                                                onClick={handlePrescribeAI}
                                                className="px-3 py-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg transition-all"
                                            >
                                                Novo com IA
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {scheduledPrograms.map(program => (
                                        <div key={program.id} className="bg-glass-bg rounded-xl p-4 border border-k-border-subtle hover:border-violet-500/30 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start">
                                                <div className="relative z-10">
                                                    <h4 className="font-bold text-white text-sm group-hover:text-violet-300 transition-colors">{program.name}</h4>
                                                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary mt-1">
                                                        {program.duration_weeks && <span>{program.duration_weeks} sem</span>}
                                                        {program.scheduled_start_date && (
                                                            <span className="text-violet-400">
                                                                {new Date(program.scheduled_start_date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all relative z-10">
                                                    <button onClick={() => handleActivateScheduled(program.id)} disabled={!!processingId} className="p-1.5 text-violet-400 hover:text-white hover:bg-violet-600 rounded-lg transition-all">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleEditScheduled(program.id)} className="p-1.5 text-k-text-tertiary hover:text-k-text-primary rounded-lg transition-all">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteScheduled(program.id)} disabled={!!processingId} className="p-1.5 text-k-text-tertiary hover:text-red-400 rounded-lg transition-all">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <ProgramHistorySection programs={completedPrograms} />
                    </div>
                </div>
            </div>

            {/* Student Edit Modal */}
            <StudentModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onStudentUpdated={handleStudentUpdated}
                trainerId={trainer.id}
                initialData={student}
            />

            {/* Assign Program Modal */}
            <AssignProgramModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onProgramAssigned={handleProgramAssigned}
                studentId={student.id}
                studentName={student.name}
                initialAssignmentType={assignModalMode}
            />

            {/* Complete Program Modal */}
            <CompleteProgramModal
                isOpen={isCompleteModalOpen}
                onClose={() => setIsCompleteModalOpen(false)}
                onConfirm={handleConfirmComplete}
                programName={activeProgram?.name || ''}
            />

            {/* Tour: Student Detail (auto-start on first visit) */}
            <TourRunner tourId="student_detail" steps={TOUR_STEPS.student_detail} autoStart />
        </AppLayout>
    )
}
