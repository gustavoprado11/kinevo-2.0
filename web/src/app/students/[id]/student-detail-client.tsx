'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AppLayout } from '@/components/layout'
import {
    StudentHeader,
    ActiveProgramDashboard,
    ProgramHistorySection
} from '@/components/students'
import { completeProgram } from './actions/complete-program'
import { extendProgram } from './actions/extend-program'
import { startConsultoria } from '@/actions/consultoria/start-consultoria'
import { deleteStudent } from './actions/student-actions'
import { activateProgram } from './actions/activate-program'
import { deleteProgram } from './actions/delete-program'
import { rejectProgram } from '@/actions/prescription/reject-program'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection'
import { formatBrDate } from '@kinevo/shared/utils/format-br-date'
import { FinancialSidebarCard } from '@/components/students/financial-sidebar-card'
import { HealthMetricsCard } from '@/components/students/health-metrics-card'
import { SmartBanner } from '@/components/students/smart-banner'
import { pickBanner, type BannerContext } from '@/components/students/smart-banner-rules'
import { AlertCircle, Dumbbell, Clock, FileText, Sparkles, Play, Pencil, Trash2 } from 'lucide-react'
import { QuickMessageCard } from '@/components/students/quick-message-card'
import { StudentInsightsCard } from '@/components/students/student-insights-card'
import { ProgramDraftEntry } from '@/components/students/program-draft-entry'
import { buildDraftKey, readDraftSummary, removeBuilderDraft, type BuilderDraftSummary } from '@/components/programs/helpers/use-builder-draft'
import { KeyboardShortcuts } from '@/components/students/keyboard-shortcuts'
import { StudentStatusBar } from '@/components/students/student-status-bar'
import { useToast } from '@/components/ui/toast'
import { useStudioState } from '@/hooks/use-studio-state'
import { useCommunicationStore } from '@/stores/communication-store'
import type { InsightItem } from '@/actions/insights'
import type { DisplayStatus } from '@/types/financial'

// Modals — only rendered when opened by user. Kept out of the initial bundle.
const AssignProgramModal = dynamic(
    () => import('@/components/students/assign-program-modal').then(m => m.AssignProgramModal),
    { ssr: false, loading: () => null },
)
const CompleteProgramModal = dynamic(
    () => import('@/components/students/complete-program-modal').then(m => m.CompleteProgramModal),
    { ssr: false, loading: () => null },
)
const StudentModal = dynamic(
    () => import('@/components/student-modal').then(m => m.StudentModal),
    { ssr: false, loading: () => null },
)
const CreateAppointmentModal = dynamic(
    () => import('@/components/appointments/create-appointment-modal').then(m => m.CreateAppointmentModal),
    { ssr: false, loading: () => null },
)
const StudentScheduleSection = dynamic(
    () => import('@/components/appointments/student-schedule-section').then(m => m.StudentScheduleSection),
    { ssr: false, loading: () => null },
)

// Below-the-fold charts — don't block FCP.
const LoadProgressionChart = dynamic(
    () => import('@/components/students/load-progression-chart').then(m => m.LoadProgressionChart),
    { ssr: false, loading: () => null },
)
const ProgramComparisonCard = dynamic(
    () => import('@/components/students/program-comparison-card').then(m => m.ProgramComparisonCard),
    { ssr: false, loading: () => null },
)

function getTodayInSaoPaulo(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function getScheduledActivationLabel(date: string | null | undefined): string {
    if (!date) return 'Ativação automática pendente'

    const today = getTodayInSaoPaulo()
    if (date < today) return `Ativação automática atrasada desde ${formatBrDate(date)}`
    if (date === today) return 'Ativação automática hoje'
    return `Ativação automática em ${formatBrDate(date)}`
}

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
    objective: string | null
    management_tags: string[] | null
    /** Estúdios: responsável pelo aluno (CTAs pessoais só para o dono). */
    coach_id?: string | null
    is_private?: boolean | null
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
    /** Beta fechado da Consultoria IA (migration 251). */
    consultoria_enabled?: boolean
}

interface CalendarSession {
    id: string
    assigned_workout_id: string
    started_at: string
    completed_at: string | null
    status: 'in_progress' | 'completed'
    rpe: number | null
    assigned_program_id?: string | null
}

interface StudentDetailClientProps {
    trainer: Trainer
    student: Student
    activeProgram: AssignedProgram | null
    scheduledPrograms: AssignedProgram[]
    /** Rascunhos persistidos no banco (criados fora do builder, ex.: assistente via MCP). */
    draftPrograms?: Array<{
        id: string
        name: string
        assigned_workouts?: Array<{ id: string; name: string; scheduled_days: number[] }>
    }>
    /** Rascunhos gerados pela IA (geração pendente de revisão) — abrir/editar no builder. */
    aiDrafts?: Array<{ id: string; createdAt: string }>
    historySummary: HistorySummary
    completedPrograms: CompletedProgram[]
    recentSessions: any[]
    calendarInitialSessions: CalendarSession[]
    weeklyAdherence?: { week: number; rate: number }[]
    tonnageMap?: Record<string, { tonnage: number; previousTonnage: number | null; percentChange: number | null }>
    sidebarContract: {
        id: string
        billing_type: string
        amount: number | null
        current_period_end: string | null
        cancel_at_period_end: boolean | null
        plan_title: string | null
        plan_interval: string | null
    } | null
    displayStatus: DisplayStatus
    lastSubmission: {
        id: string
        templateTitle: string
        templateCategory: string
        submittedAt: string
    } | null
    pendingForms: {
        id: string
        title: string
        status: string
        createdAt: string
    }[]
    bodyMetrics: {
        weight: string | null
        bodyFat: string | null
        updatedAt: string | null
    } | null
    formTemplates: { id: string; title: string; category: string }[]
    formSchedules?: any[]
    studentInsights?: InsightItem[]
    bodyMetricsHistory?: { weight: number | null; bodyFat: number | null; date: string }[]
    latestPresencialSession?: import('@kinevo/shared/types/assessments').AssessmentSessionListItem | null
}

export function StudentDetailClient({
    trainer,
    student: initialStudent,
    activeProgram,
    scheduledPrograms,
    draftPrograms = [],
    aiDrafts = [],
    historySummary,
    recentSessions,
    calendarInitialSessions = [],
    completedPrograms,
    weeklyAdherence = [],
    tonnageMap = {},
    sidebarContract,
    displayStatus,
    lastSubmission,
    pendingForms,
    bodyMetrics,
    formTemplates,
    formSchedules = [],
    studentInsights = [],
    bodyMetricsHistory = [],
    latestPresencialSession = null,
}: StudentDetailClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    // Estúdio não usa o módulo Financeiro — o card do perfil some.
    const { isStudioAccount } = useStudioState()
    const openPanel = useCommunicationStore(s => s.openPanel)
    const openConversation = useCommunicationStore(s => s.openConversation)

    /**
     * Abre o painel lateral de mensagens já posicionado na thread deste aluno.
     * Substitui a navegação full-page antiga para `/messages?student=...`:
     * o usuário continua na página do aluno e pode fechar o painel (X no
     * header do painel, backdrop ou botão de voltar) sem perder contexto.
     */
    // Estúdios: agenda e mensagens são PESSOAIS do responsável (decisão de
    // produto) — para aluno de colega os CTAs somem em vez de falhar com
    // 'Sem permissão'/thread vazia.
    const isOwnStudent = !initialStudent.coach_id || initialStudent.coach_id === trainer.id

    const handleOpenMessages = useCallback(() => {
        openPanel('messages')
        openConversation(initialStudent.id)
    }, [openPanel, openConversation, initialStudent.id])

    /**
     * Inicia a Consultoria IA para este aluno: com anamnese recente o pedido
     * já nasce triado; senão a Avaliação Inicial é enviada ao app do aluno.
     * O acompanhamento (gerar rascunho → validar) acontece em /consultoria.
     */
    const handleStartConsultoria = useCallback(async () => {
        const result = await startConsultoria(initialStudent.id)
        if (result.success) {
            toast({
                message: result.status === 'awaiting_anamnese'
                    ? 'Anamnese enviada ao aluno! Acompanhe em Consultoria IA.'
                    : 'Consultoria criada com a anamnese recente do aluno.',
                type: 'success',
            })
            router.push('/consultoria')
        } else {
            toast({ message: result.error ?? 'Erro ao iniciar a consultoria.', type: 'error' })
        }
    }, [initialStudent.id, router, toast])

    const [student, setStudent] = useState<Student>(initialStudent)

    // Rascunho de programa deste aluno (autosave do builder, localStorage).
    // Lido após o mount para não quebrar a hidratação.
    const [studentDraft, setStudentDraft] = useState<BuilderDraftSummary | null>(null)
    useEffect(() => {
        const key = buildDraftKey({
            trainerId: trainer.id,
            isEditing: false,
            isStudentContext: true,
            studentId: initialStudent.id,
        })
        setStudentDraft(key ? readDraftSummary(key, trainer.id) : null)
    }, [trainer.id, initialStudent.id])
    const discardStudentDraft = useCallback(() => {
        setStudentDraft(prev => {
            if (prev) removeBuilderDraft(prev.key)
            return null
        })
    }, [])

    // "Criar Novo" colide com um rascunho existente (mesmo slot por aluno).
    // Quando há rascunho, perguntamos: continuar o rascunho ou começar do zero
    // (descartando-o). `createChoice.freshUrl` guarda a rota do "começar do zero"
    // (agendado ou imediato).
    const [createChoice, setCreateChoice] = useState<{ freshUrl: string } | null>(null)
    const startNewProgram = useCallback((scheduled: boolean) => {
        const freshUrl = scheduled
            ? `/students/${initialStudent.id}/program/new?scheduled=true`
            : `/students/${initialStudent.id}/program/new`
        if (studentDraft) {
            setCreateChoice({ freshUrl })
            return
        }
        router.push(freshUrl)
    }, [initialStudent.id, studentDraft, router])
    const continueDraftFromChoice = useCallback(() => {
        setCreateChoice(null)
        if (studentDraft) router.push(studentDraft.route)
    }, [studentDraft, router])
    const startFreshFromChoice = useCallback(() => {
        const url = createChoice?.freshUrl
        discardStudentDraft()
        setCreateChoice(null)
        if (url) router.push(url)
    }, [createChoice, discardStudentDraft, router])

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [assignModalMode, setAssignModalMode] = useState<'immediate' | 'scheduled'>('immediate')
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [activationBlock, setActivationBlock] = useState<{ workoutNames: string[] } | null>(null)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0)
    // null = ainda carregando; 0 = sem rotinas (esconder); >0 = mostrar.
    const [scheduleCount, setScheduleCount] = useState<number | null>(null)

    const handleAssignProgram = () => {
        setAssignModalMode('immediate')
        setIsAssignModalOpen(true)
    }

    const handleAssignScheduled = () => {
        setAssignModalMode('scheduled')
        setIsAssignModalOpen(true)
    }

    const handleCreateScheduled = () => {
        startNewProgram(true)
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
            toast({ message: result.error || 'Erro ao concluir programa', type: 'error' })
        }
        setIsCompleteModalOpen(false)
    }

    const handleExtendProgram = async () => {
        if (!activeProgram) return
        const weeksStr = prompt('Quantas semanas deseja prorrogar? (1-12)')
        if (!weeksStr) return
        const weeks = parseInt(weeksStr, 10)
        if (isNaN(weeks) || weeks < 1 || weeks > 12) {
            toast({ message: 'Informe um número entre 1 e 12.', type: 'error' })
            return
        }
        const result = await extendProgram(activeProgram.id, student.id, weeks)
        if (result.success) {
            router.refresh()
        } else {
            toast({ message: result.error || 'Erro ao prorrogar programa', type: 'error' })
        }
    }

    const handleProgramAssigned = () => {
        router.refresh()
    }

    const handleCreateProgram = () => {
        startNewProgram(false)
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
            toast({ message: result.error || 'Erro ao excluir aluno', type: 'error' })
        }
    }

    // --- Scheduled Program Actions ---
    const handleActivateScheduled = async (programId: string) => {
        // Validate all workouts have scheduled days before activation
        const program = scheduledPrograms.find(p => p.id === programId)
        if (program?.assigned_workouts) {
            const missing = program.assigned_workouts.filter(w => !w.scheduled_days || w.scheduled_days.length === 0)
            if (missing.length > 0) {
                setActivationBlock({ workoutNames: missing.map(w => w.name) })
                return
            }
        }

        if (activeProgram) {
            if (!confirm('Ao ativar este programa, o programa atual será encerrado. Deseja continuar?')) return
        } else {
            if (!confirm('Deseja ativar este programa agora?')) return
        }

        setProcessingId(programId)
        try {
            const result = await activateProgram(programId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeleteScheduled = async (programId: string) => {
        if (!confirm('Tem certeza que deseja remover este programa da fila?')) return

        setProcessingId(programId)
        try {
            const result = await deleteProgram(programId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    const handleEditScheduled = (programId: string) => {
        router.push(`/students/${student.id}/program/${programId}/edit`)
    }

    // ── Rascunhos no banco (criados fora do builder, ex.: assistente via MCP) ──
    const handleActivateDraft = async (programId: string) => {
        // Mesma validação dos agendados: todo treino precisa de dia marcado.
        const program = draftPrograms.find(p => p.id === programId)
        if (program?.assigned_workouts) {
            const missing = program.assigned_workouts.filter(w => !w.scheduled_days || w.scheduled_days.length === 0)
            if (missing.length > 0) {
                setActivationBlock({ workoutNames: missing.map(w => w.name) })
                return
            }
        }

        if (activeProgram) {
            if (!confirm('Ao ativar este programa, o programa atual será encerrado. Deseja continuar?')) return
        } else {
            if (!confirm('Deseja ativar este programa agora?')) return
        }

        setProcessingId(programId)
        try {
            const result = await activateProgram(programId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeleteDraft = async (programId: string) => {
        if (!confirm('Tem certeza que deseja descartar este rascunho?')) return

        setProcessingId(programId)
        try {
            const result = await deleteProgram(programId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    // ── Geração de IA pendente de revisão (prescription_generations) ──
    // Descartar usa o mesmo rejectProgram do fluxo de prescrição: troca o
    // status para 'rejected' (reversível, NÃO apaga) e revalida a rota, então
    // o card sai da fila sozinho. Artefato distinto do draftProgram acima.
    const handleRejectGeneration = async (generationId: string) => {
        if (!confirm('Tem certeza que deseja descartar este rascunho gerado pela IA?')) return

        setProcessingId(generationId)
        try {
            const result = await rejectProgram(generationId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    // ── Onda 3 — SmartBanner ────────────────────────────────────────────
    // Calculamos o banner aqui (função pura, custo zero) pra coordenar o
    // estado entre o componente e o HealthMetricsCard (que esconde o
    // próprio banner de reavaliação quando o SmartBanner já cobre).
    const daysUntilReassessment = (() => {
        if (!formSchedules || formSchedules.length === 0) return null
        const dueDates = formSchedules
            .filter((s: any) => s?.is_active !== false && s?.next_due_at)
            .map((s: any) => new Date(s.next_due_at).getTime())
            .filter((t) => Number.isFinite(t))
        if (dueDates.length === 0) return null
        const earliest = Math.min(...dueDates)
        return Math.ceil((earliest - Date.now()) / (24 * 60 * 60 * 1000))
    })()

    const bannerContext: BannerContext = {
        studentName: student.name,
        studentPhone: student.phone,
        activeProgram: activeProgram
            ? {
                status: activeProgram.status,
                started_at: activeProgram.started_at,
                duration_weeks: activeProgram.duration_weeks,
            }
            : null,
        historySummary: {
            totalSessions: historySummary.totalSessions,
            lastSessionDate: historySummary.lastSessionDate,
            completedThisWeek: historySummary.completedThisWeek,
            expectedPerWeek: historySummary.expectedPerWeek,
            streak: historySummary.streak,
        },
        recentSessions: recentSessions.map((s: any) => ({
            id: s?.id,
            rpe: typeof s?.rpe === 'number' ? s.rpe : null,
        })),
        tonnageMap,
        weeklyAdherence,
        financialStatus: displayStatus,
        hasPendingForms: pendingForms.length > 0,
        daysUntilReassessment,
    }

    const activeBanner = pickBanner(bannerContext)

    const handleBannerAction = (actionId: string) => {
        switch (actionId) {
            case 'send_message':
                handleOpenMessages()
                break
            case 'open_whatsapp':
                if (student.phone) {
                    const digits = student.phone.replace(/\D/g, '')
                    if (digits) window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer')
                }
                break
            case 'extend_program':
                handleExtendProgram()
                break
            case 'complete_program':
                handleCompleteProgram()
                break
            case 'assign_program':
                handleAssignProgram()
                break
            case 'adjust_load': {
                // Foca/scrolla o card do programa ativo (onde fica a tonelagem
                // por workout e o sparkline). Refinement futuro: expor um
                // imperativo no ActiveProgramDashboard pra abrir o gráfico.
                const el = document.querySelector('[data-onboarding="student-actions"]')
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                break
            }
            case 'send_reassessment': {
                // Ver follow-up: expor handle imperativo no HealthMetricsCard
                // pra abrir o dropdown de envio de form direto.
                const el = document.querySelector('[data-onboarding="assessments"]')
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                break
            }
            case 'view_finance':
                router.push(`/financial?student=${student.id}`)
                break
        }
    }

    // Atalhos extras só fazem sentido com programa ativo + callback truthy.
    const adjustLoadShortcut = activeProgram
        ? () => handleBannerAction('adjust_load')
        : undefined
    const planNextShortcut = activeProgram ? handleAssignProgram : undefined

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            <div className="min-h-screen bg-surface-primary -m-8 p-8 space-y-6">
                {/* Student Header — com barra de status consolidada dentro.
                    Antes havia 3 faixas horizontais empilhadas abaixo do header
                    (pontos de atenção, "Sem treino há N dias", ContextualAlerts)
                    que cortavam a tela antes do dashboard começar. Tudo isso foi
                    consolidado dentro do StudentStatusBar, passado como children
                    do header para virar uma única barra horizontal no rodapé
                    dele. */}
                <StudentHeader
                    student={student}
                    onEdit={handleEditStudent}
                    onDelete={handleDeleteStudent}
                    onSchedule={student.is_trainer_profile || !isOwnStudent ? undefined : () => setIsScheduleModalOpen(true)}
                    onStartTour={student.is_trainer_profile ? undefined : () => useOnboardingStore.getState().startTour('student_detail')}
                    onConsultoria={
                        // Beta fechado (migration 251): sem o flag, o item nem aparece no menu.
                        student.is_trainer_profile || trainer.consultoria_enabled !== true
                            ? undefined
                            : handleStartConsultoria
                    }
                >
                    <StudentStatusBar
                        historySummary={historySummary}
                        recentSessions={recentSessions}
                        tonnageMap={tonnageMap}
                        weeklyAdherence={weeklyAdherence}
                        activeProgram={activeProgram}
                        financialStatus={displayStatus}
                        hasPendingForms={pendingForms.length > 0}
                        studentName={student.name}
                        studentPhone={student.phone}
                        onSendMessage={isOwnStudent ? handleOpenMessages : undefined}
                        mode="compact"
                    />
                </StudentHeader>

                {/* Onda 3 — SmartBanner: 1 banner dominante baseado no estado
                    do aluno (critical/high/info). Substitui os chips de alerta
                    que viviam dentro da StudentStatusBar (agora em modo compact). */}
                {activeBanner && (
                    <SmartBanner
                        studentId={student.id}
                        context={bannerContext}
                        onAction={handleBannerAction}
                    />
                )}

                {/* Main Content Grid - New Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Active Program Dashboard + Load Chart */}
                    <div className="space-y-6" data-onboarding="student-actions">
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
                            onExtendProgram={handleExtendProgram}
                            onCreateProgram={handleCreateProgram}
                            onAssignScheduled={handleAssignScheduled}
                            onCreateScheduled={handleCreateScheduled}
                            onViewReport={activeProgram ? () => window.open(`/reports/program/${activeProgram.id}`, '_blank') : undefined}
                            hasActiveProgram={!!activeProgram}
                            studentId={student.id}
                        />

                        {/* Load Progression Chart — per workout */}
                        {activeProgram && (
                            <LoadProgressionChart programId={activeProgram.id} />
                        )}

                        {/* Program Comparison — Onda 2: strip compact com 1 card de
                            Volume + link pra modal com a versão detalhada por grupo
                            muscular. */}
                        {activeProgram && completedPrograms.length > 0 && (
                            <ProgramComparisonCard
                                currentProgramId={activeProgram.id}
                                currentProgramName={activeProgram.name}
                                previousProgramId={completedPrograms[0].id}
                                previousProgramName={completedPrograms[0].name}
                                compact
                            />
                        )}
                    </div>

                    {/* Right Column: Próximos Programas (prioridade) → Mensagem → Insights → Avaliações → Financeiro → Histórico */}
                    <div className="space-y-6 lg:col-span-1">
                        {/* Scheduled Programs — FIRST: ação mais recorrente quando o ciclo termina.
                            Card só aparece quando o treinador realmente precisa olhar a fila:
                            - há programas agendados, OU
                            - não há programa ativo (precisa criar o primeiro), OU
                            - o programa ativo expirou, OU
                            - o programa ativo passou de 75% (hora de planejar o próximo).
                            Caso contrário (programa em <75% e fila vazia) o card é omitido
                            para não competir com o calendário do programa ativo. */}
                        {(() => {
                            const programProgress = activeProgram?.started_at && activeProgram?.duration_weeks
                                ? (getProgramWeek(new Date(), activeProgram.started_at, activeProgram.duration_weeks) ?? activeProgram.duration_weeks) / activeProgram.duration_weeks
                                : 0
                            const shouldShow =
                                !!studentDraft ||
                                (draftPrograms && draftPrograms.length > 0) ||
                                (scheduledPrograms && scheduledPrograms.length > 0) ||
                                !activeProgram ||
                                (activeProgram.status as string) === 'expired' ||
                                programProgress >= 0.75
                            if (!shouldShow) return null
                            return (
                        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                                    Próximos Programas
                                    <span className="px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold border border-k-border-subtle">
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

                            {studentDraft && (
                                <div className="mb-3">
                                    <ProgramDraftEntry draft={studentDraft} onDiscard={discardStudentDraft} />
                                </div>
                            )}

                            {/* Rascunhos salvos no banco (criados fora do builder, ex.: assistente via MCP).
                                Diferente do studentDraft acima (rascunho do builder no localStorage):
                                estes já são programas persistidos e só precisam ser revisados/ativados. */}
                            {draftPrograms.length > 0 && (
                                <div className="space-y-3 mb-3">
                                    {draftPrograms.map(program => {
                                        const workoutCount = program.assigned_workouts?.length ?? 0
                                        return (
                                            <div key={program.id} className="rounded-xl border border-amber-300/60 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                    <h4 className="font-bold text-[#1C1C1E] dark:text-white text-sm truncate flex-1">{program.name}</h4>
                                                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">
                                                        Rascunho
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-medium text-amber-700/70 dark:text-amber-300/70 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" />
                                                    {workoutCount > 0 && `${workoutCount} ${workoutCount === 1 ? 'treino' : 'treinos'} · `}
                                                    criado pelo assistente · não ativado
                                                </p>
                                                <div className="flex items-center gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleActivateDraft(program.id)}
                                                        disabled={!!processingId}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        <Play className="w-3.5 h-3.5" /> Ativar
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditScheduled(program.id)}
                                                        aria-label="Revisar rascunho"
                                                        className="p-2 text-amber-700/70 dark:text-amber-400/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-amber-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDraft(program.id)}
                                                        disabled={!!processingId}
                                                        aria-label="Descartar rascunho"
                                                        className="p-2 text-amber-700/60 dark:text-amber-400/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Rascunhos gerados pela IA (geração pendente de revisão) — abrir no builder. */}
                            {aiDrafts.length > 0 && (
                                <div className="space-y-3 mb-3">
                                    {aiDrafts.map(draft => (
                                        <div key={draft.id} className="rounded-xl border border-violet-300/60 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5 p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
                                                <h4 className="font-bold text-[#1C1C1E] dark:text-white text-sm truncate flex-1">Rascunho gerado pela IA</h4>
                                                <span className="px-2 py-0.5 rounded bg-violet-500/15 text-[10px] text-violet-600 dark:text-violet-400 font-bold flex-shrink-0">
                                                    Rascunho
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
                                                Gerado pelo assistente · pendente de revisão
                                            </p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <button
                                                    onClick={() => router.push(`/students/${student.id}/program/new?generationId=${draft.id}`)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-bold rounded-control transition-colors"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Revisar no builder
                                                </button>
                                                <button
                                                    onClick={() => handleRejectGeneration(draft.id)}
                                                    disabled={!!processingId}
                                                    aria-label="Descartar rascunho gerado pela IA"
                                                    className="p-2 text-violet-700/60 dark:text-violet-400/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!scheduledPrograms || scheduledPrograms.length === 0 ? (
                                <div className="text-center py-4">
                                    {(() => {
                                        if (!activeProgram) {
                                            return (
                                                <div className="rounded-xl border-2 border-dashed border-[#D2D2D7] dark:border-k-border-subtle p-4 mb-3">
                                                    <div className="w-10 h-10 bg-violet-50 dark:bg-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                                        <Dumbbell className="w-5 h-5 text-violet-500" />
                                                    </div>
                                                    <p className="text-sm font-medium text-[#1C1C1E] dark:text-k-text-secondary">Sem programa ativo</p>
                                                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5">Crie o primeiro programa para {student.name.split(' ')[0]}</p>
                                                </div>
                                            )
                                        }
                                        if ((activeProgram.status as string) === 'expired') {
                                            return (
                                                <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4 mb-3">
                                                    <div className="flex items-center gap-2 justify-center mb-1">
                                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Programa expirado!</span>
                                                    </div>
                                                    <p className="text-xs text-red-500/80 dark:text-red-400/60">Conclua, prorrogue ou atribua um novo programa.</p>
                                                </div>
                                            )
                                        }
                                        const programProgress = activeProgram?.started_at && activeProgram?.duration_weeks
                                            ? (getProgramWeek(new Date(), activeProgram.started_at, activeProgram.duration_weeks) ?? activeProgram.duration_weeks) / activeProgram.duration_weeks
                                            : 0
                                        const remainingWeeks = activeProgram?.started_at && activeProgram?.duration_weeks
                                            ? Math.max(0, activeProgram.duration_weeks - (getProgramWeek(new Date(), activeProgram.started_at, activeProgram.duration_weeks) ?? activeProgram.duration_weeks))
                                            : 0
                                        if (programProgress >= 0.75) {
                                            return (
                                                <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4 mb-3">
                                                    <div className="flex items-center gap-2 justify-center mb-1">
                                                        <Clock className="w-4 h-4 text-amber-500" />
                                                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{remainingWeeks === 0 ? 'Última semana!' : `Faltam ${remainingWeeks} semana${remainingWeeks !== 1 ? 's' : ''}!`}</span>
                                                    </div>
                                                    <p className="text-xs text-amber-600/70 dark:text-amber-400/60">Prepare o próximo ciclo de treinamento.</p>
                                                </div>
                                            )
                                        }
                                        if (programProgress >= 0.5) {
                                            return (
                                                <div className="rounded-xl border border-[#D2D2D7] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-white/3 p-4 mb-3">
                                                    <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary">Programa em {Math.round(programProgress * 100)}%</p>
                                                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5">Bom momento para planejar o próximo.</p>
                                                </div>
                                            )
                                        }
                                        return (
                                            <div className="rounded-xl border-2 border-dashed border-[#D2D2D7] dark:border-k-border-subtle p-4 mb-3">
                                                <p className="text-sm text-[#86868B] dark:text-k-text-quaternary">Nenhum programa na fila.</p>
                                            </div>
                                        )
                                    })()}
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={handleCreateScheduled}
                                            className="px-3 py-1.5 text-xs font-bold bg-primary hover:opacity-90 text-primary-foreground rounded-control transition-all"
                                        >
                                            + Criar Novo
                                        </button>
                                        <button
                                            onClick={handleAssignScheduled}
                                            className="px-3 py-1.5 text-xs font-bold text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary border border-[#D2D2D7] dark:border-k-border-subtle rounded-lg transition-all"
                                        >
                                            Atribuir
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/5 p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="w-4 h-4 text-violet-500" />
                                            <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                                                {getScheduledActivationLabel(scheduledPrograms[0]?.scheduled_start_date)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-violet-700/70 dark:text-violet-300/70">
                                            O programa mais antigo elegível na fila será ativado automaticamente nessa data.
                                        </p>
                                    </div>

                                    {scheduledPrograms.map(program => (
                                        <div key={program.id} className="bg-glass-bg rounded-xl p-4 border border-k-border-subtle hover:border-violet-500/30 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start">
                                                <div className="relative z-sticky">
                                                    <h4 className="font-bold text-[#1C1C1E] dark:text-white text-sm group-hover:text-violet-300 transition-colors">{program.name}</h4>
                                                    <div className="flex items-center gap-3 text-[10px] font-bold text-k-text-quaternary mt-1">
                                                        {program.duration_weeks && <span>{program.duration_weeks} sem</span>}
                                                        {program.scheduled_start_date && (
                                                            <span className="text-violet-400">
                                                                {formatBrDate(program.scheduled_start_date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-2 text-[11px] font-medium text-violet-600/80 dark:text-violet-300/80">
                                                        {getScheduledActivationLabel(program.scheduled_start_date)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all relative z-sticky">
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
                            )
                        })()}

                        {/* Recurring appointments rotina atual.
                            Escondemos via CSS (sem desmontar) quando o aluno não tem rotinas:
                            mantém o componente montado pra preservar estado interno e
                            permitir re-fetch quando uma nova rotina é criada. Estado inicial
                            null mantém o card visível durante o load. */}
                        {!student.is_trainer_profile && (
                            <div className={scheduleCount === 0 ? 'hidden' : ''}>
                                <StudentScheduleSection
                                    studentId={student.id}
                                    refreshKey={scheduleRefreshKey}
                                    onLoadedCount={setScheduleCount}
                                />
                            </div>
                        )}

                        {/* Quick Message with context-aware suggestions */}
                        {/* data-onboarding acts as a scroll anchor for inline insight CTAs ("Enviar mensagem"). */}
                        {/* Estúdios: mensagens são do responsável — card some p/ aluno de colega. */}
                        {isOwnStudent && (
                        <div data-onboarding="quick-message">
                        <QuickMessageCard
                            studentId={student.id}
                            studentName={student.name}
                            onOpenThread={handleOpenMessages}
                            suggestions={(() => {
                                const s: { emoji: string; label: string; message: string }[] = []
                                const firstName = student.name.split(' ')[0]
                                if (historySummary.completedThisWeek >= historySummary.expectedPerWeek && historySummary.expectedPerWeek > 0) {
                                    s.push({ emoji: '🎉', label: 'Parabenizar', message: `Parabéns ${firstName}! Atingiu a meta da semana, excelente dedicação!` })
                                }
                                if (historySummary.streak >= 3) {
                                    s.push({ emoji: '🔥', label: 'Sequência', message: `${firstName}, ${historySummary.streak} treinos seguidos! Continue assim, o resultado vem!` })
                                }
                                if (historySummary.lastSessionDate) {
                                    const daysSince = Math.floor((Date.now() - new Date(historySummary.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
                                    if (daysSince >= 3) {
                                        s.push({ emoji: '💪', label: 'Motivar', message: `E aí ${firstName}, tudo bem? Bora voltar aos treinos, estou te esperando!` })
                                    }
                                }
                                if (s.length === 0) {
                                    s.push({ emoji: '👋', label: 'Check-in', message: `Oi ${firstName}, como está se sentindo com os treinos?` })
                                }
                                return s
                            })()}
                        />
                        </div>
                        )}

                        {/* Unified Insights & Pinned Notes */}
                        <StudentInsightsCard
                            studentId={student.id}
                            insights={studentInsights}
                        />

                        {/* Saúde & métricas — Onda 2 unificou AssessmentSidebarCard +
                            BodyMetricsTrend num só card. AssessmentSidebarCard segue
                            existindo (marcado @deprecated) até a Onda 3 remover. */}
                        {/* data-onboarding acts as a scroll anchor for inline insight CTAs ("Ver avaliação", "Ver check-in"). */}
                        <div data-onboarding="assessments">
                        <HealthMetricsCard
                            studentId={student.id}
                            lastSubmission={lastSubmission}
                            pendingForms={pendingForms}
                            bodyMetrics={bodyMetrics}
                            bodyMetricsHistory={bodyMetricsHistory}
                            formTemplates={formTemplates}
                            formSchedules={formSchedules}
                            latestPresencialSession={latestPresencialSession}
                            hideReassessmentBanner={activeBanner?.key === 'reassessment_due'}
                        />
                        </div>

                        {/* Financial Card — oculto para contas de estúdio */}
                        {!isStudioAccount && (
                            <FinancialSidebarCard
                                studentId={student.id}
                                contract={sidebarContract}
                                displayStatus={displayStatus}
                                onViewHistory={() => router.push(`/financial?student=${student.id}`)}
                            />
                        )}

                        <ProgramHistorySection
                            programs={completedPrograms}
                            onViewReport={(programId) => window.open(`/reports/program/${programId}`, '_blank')}
                        />
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

            {/* Create Recurring Appointment Modal */}
            <CreateAppointmentModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                preselectedStudentId={student.id}
                preselectedStudentName={student.name}
                onSuccess={() => setScheduleRefreshKey((k) => k + 1)}
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

            {/* Activation blocked — workouts without scheduled days */}
            {activationBlock && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivationBlock(null)} />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <AlertCircle className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Treinos sem dia agendado</h3>
                        <p className="text-sm text-k-text-tertiary text-center mb-1">
                            {activationBlock.workoutNames.length === 1
                                ? `O treino "${activationBlock.workoutNames[0]}" não possui dias da semana atribuídos.`
                                : `Os seguintes treinos não possuem dias da semana atribuídos: ${activationBlock.workoutNames.map(n => `"${n}"`).join(', ')}.`
                            }
                        </p>
                        <p className="text-xs text-amber-400/80 text-center mb-6">
                            Atribua pelo menos um dia a cada treino antes de ativar o programa.
                        </p>
                        <button
                            onClick={() => setActivationBlock(null)}
                            className="w-full py-3 bg-primary hover:opacity-90 text-primary-foreground text-sm font-bold rounded-control transition-colors"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}

            {/* Criar Novo com rascunho existente — continuar ou começar do zero */}
            {createChoice && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreateChoice(null)} />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <FileText className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Há um rascunho em andamento</h3>
                        <p className="text-sm text-k-text-tertiary text-center mb-6">
                            Você tem um rascunho não salvo deste aluno{studentDraft?.name?.trim() ? ` ("${studentDraft.name.trim()}")` : ''}. Deseja continuar de onde parou ou começar um novo programa do zero?
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={continueDraftFromChoice}
                                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-full transition-colors"
                            >
                                Continuar rascunho
                            </button>
                            <button
                                onClick={startFreshFromChoice}
                                className="w-full py-3 bg-transparent hover:bg-[#FF3B30]/10 text-[#FF3B30] dark:text-red-400 text-sm font-bold rounded-full transition-colors border border-[#FF3B30]/20 dark:border-red-500/20"
                            >
                                Começar do zero (descarta o rascunho)
                            </button>
                            <button
                                onClick={() => setCreateChoice(null)}
                                className="w-full py-3 bg-transparent hover:bg-glass-bg-active text-k-text-tertiary text-sm font-bold rounded-full transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts */}
            <KeyboardShortcuts
                onEditProgram={activeProgram ? handleEditProgram : undefined}
                onCompleteProgram={activeProgram ? handleCompleteProgram : undefined}
                onAssignProgram={handleAssignProgram}
                onEditStudent={handleEditStudent}
                onNavigateMessages={handleOpenMessages}
                hasActiveProgram={!!activeProgram}
                onAdjustLoad={adjustLoadShortcut}
                onPlanNextProgram={planNextShortcut}
            />

            {/* Tour: Student Detail (opt-in via "Tour rápido" no menu do header) */}
            <TourRunner tourId="student_detail" steps={TOUR_STEPS.student_detail} autoStart={false} />
        </AppLayout>
    )
}
