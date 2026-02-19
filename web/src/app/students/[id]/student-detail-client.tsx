'use client'

import { useState } from 'react'
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

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality: 'online' | 'presential'
    avatar_url: string | null
    created_at: string
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
}

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system'
}

interface CalendarSession {
    id: string
    assigned_workout_id: string
    started_at: string
    completed_at: string | null
    status: 'in_progress' | 'completed'
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
}

export function StudentDetailClient({
    trainer,
    student: initialStudent,
    activeProgram,
    scheduledPrograms,
    historySummary,
    recentSessions,
    calendarInitialSessions = [],
    completedPrograms
}: StudentDetailClientProps) {
    console.log('StudentDetailClient Rendered. Scheduled:', scheduledPrograms) // DEBUG LOG
    const router = useRouter()
    const [student, setStudent] = useState<Student>(initialStudent)
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [assignModalMode, setAssignModalMode] = useState<'immediate' | 'scheduled'>('immediate')
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)

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

    // --- Student Actions ---
    const handleEditStudent = () => {
        setIsEditModalOpen(true)
    }

    const handleStudentUpdated = (updatedStudent: Student) => {
        setStudent(updatedStudent)
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
            trainerTheme={trainer.theme}
        >
            <div className="min-h-screen bg-surface-primary -m-8 p-8 space-y-6">
                {/* Student Header */}
                <StudentHeader
                    student={student}
                    onEdit={handleEditStudent}
                    onDelete={handleDeleteStudent}
                />

                {/* Main Content Grid - New Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Active Program Dashboard */}
                    <div>
                        <ActiveProgramDashboard
                            program={activeProgram}
                            summary={historySummary}
                            recentSessions={recentSessions}
                            calendarInitialSessions={calendarInitialSessions}
                            onAssignProgram={handleAssignProgram}
                            onEditProgram={handleEditProgram}
                            onCompleteProgram={handleCompleteProgram}
                            onCreateProgram={handleCreateProgram}
                        />
                    </div>

                    {/* Right Column: Queue & History (Span 1) */}
                    <div className="space-y-6 lg:col-span-1">
                        {/* Scheduled Programs Section - Platter Style */}
                        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                        Próximos Programas
                                        <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold uppercase tracking-widest border border-k-border-subtle">
                                            Fila
                                        </span>
                                    </h3>
                                    <p className="text-sm text-k-text-tertiary mt-1">Programas agendados para o aluno.</p>
                                </div>
                                {/* Header Actions (Visible when list is NOT empty) */}
                                {scheduledPrograms && scheduledPrograms.length > 0 && (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleCreateScheduled}
                                            className="p-2 text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all border border-transparent hover:border-k-border-primary"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleAssignScheduled}
                                            className="p-2 text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all border border-transparent hover:border-k-border-primary"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!scheduledPrograms || scheduledPrograms.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-k-border-primary rounded-2xl">
                                    <div className="w-16 h-16 rounded-full bg-glass-bg flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-8 h-8 text-k-text-quaternary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-k-text-tertiary font-medium mb-8">Nenhum programa agendado na fila.</p>

                                    <div className="flex items-center justify-center gap-4">
                                        <button
                                            onClick={handleCreateScheduled}
                                            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Criar Novo
                                        </button>
                                        <button
                                            onClick={handleAssignScheduled}
                                            className="px-6 py-3 bg-transparent hover:bg-glass-bg text-k-text-secondary hover:text-k-text-primary text-[11px] font-black uppercase tracking-widest rounded-xl transition-all border border-k-border-primary flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            Atribuir
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {scheduledPrograms.map(program => (
                                        <div key={program.id} className="bg-glass-bg rounded-2xl p-5 border border-k-border-subtle hover:border-violet-500/30 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start">
                                                <div className="relative z-10">
                                                    <h4 className="font-black text-white text-lg tracking-tight group-hover:text-violet-300 transition-colors">{program.name}</h4>
                                                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-k-text-tertiary mt-2">
                                                        {program.duration_weeks && (
                                                            <span className="flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                {program.duration_weeks} semanas
                                                            </span>
                                                        )}
                                                        {program.scheduled_start_date && (
                                                            <span className="flex items-center gap-1.5 text-violet-400">
                                                                <svg className="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {new Date(program.scheduled_start_date).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 relative z-10">
                                                    <button
                                                        onClick={() => handleActivateScheduled(program.id)}
                                                        disabled={!!processingId}
                                                        className="p-2 text-violet-400 hover:text-white hover:bg-violet-600 rounded-xl transition-all"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditScheduled(program.id)}
                                                        className="p-2 text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active rounded-xl transition-all"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Subtle gradient background on hover */}
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
        </AppLayout>
    )
}
