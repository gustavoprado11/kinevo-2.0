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
import { AlertCircle, FileText, Play, Pencil, Trash2 } from 'lucide-react'
import { QuickMessageCard } from '@/components/students/quick-message-card'
import { StudentInsightsCard } from '@/components/students/student-insights-card'
import { ProgramDraftEntry } from '@/components/students/program-draft-entry'
import { buildDraftKey, readDraftSummary, removeBuilderDraft, type BuilderDraftSummary } from '@/components/programs/helpers/use-builder-draft'
import { KeyboardShortcuts } from '@/components/students/keyboard-shortcuts'
import { StudentKpiRuler } from '@/components/students/student-kpi-ruler'
import { useToast } from '@/components/ui/toast'
import { useStudioState } from '@/hooks/use-studio-state'
import { useCommunicationStore } from '@/stores/communication-store'
import type { InsightItem } from '@/actions/insights'
import type { DisplayStatus } from '@/types/financial'
import { AssistantMark } from '@/components/assistant/assistant-mark'

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
    /** FCmáx (bpm) — zonas da prescrição aeróbia. */
    max_heart_rate_bpm?: number | null
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

    // Confirmação genérica no padrão do app — substitui os confirm() nativos
    // do browser (ativar/remover programas da fila, descartar rascunhos).
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string
        message: string
        confirmLabel: string
        danger?: boolean
        onConfirm: () => void
    } | null>(null)

    // Prorrogar programa — substitui o prompt() nativo por um dialog com input.
    const [isExtendOpen, setIsExtendOpen] = useState(false)
    const [extendWeeks, setExtendWeeks] = useState('4')
    const [extendError, setExtendError] = useState<string | null>(null)
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

    const handleExtendProgram = () => {
        if (!activeProgram) return
        setExtendWeeks('4')
        setExtendError(null)
        setIsExtendOpen(true)
    }

    const handleConfirmExtend = async () => {
        if (!activeProgram) return
        const weeks = parseInt(extendWeeks, 10)
        if (isNaN(weeks) || weeks < 1 || weeks > 12) {
            setExtendError('Informe um número entre 1 e 12.')
            return
        }
        setIsExtendOpen(false)
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
    // Execução compartilhada por agendados e rascunhos do banco.
    const runActivateProgram = async (programId: string) => {
        setProcessingId(programId)
        try {
            const result = await activateProgram(programId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    const runDeleteProgram = async (programId: string) => {
        setProcessingId(programId)
        try {
            const result = await deleteProgram(programId)
            if (!result.success) toast({ message: result.error ?? '', type: 'error' })
        } finally {
            setProcessingId(null)
        }
    }

    // Valida dias agendados e pede confirmação no padrão do app.
    const confirmActivation = (
        programId: string,
        programs: Array<{ id: string; assigned_workouts?: Array<{ name: string; scheduled_days: number[] }> }>,
    ) => {
        const program = programs.find(p => p.id === programId)
        if (program?.assigned_workouts) {
            const missing = program.assigned_workouts.filter(w => !w.scheduled_days || w.scheduled_days.length === 0)
            if (missing.length > 0) {
                setActivationBlock({ workoutNames: missing.map(w => w.name) })
                return
            }
        }

        setConfirmDialog({
            title: 'Ativar programa agora?',
            message: activeProgram
                ? 'Ao ativar este programa, o programa atual será encerrado.'
                : 'O programa passa a valer imediatamente para o aluno.',
            confirmLabel: 'Ativar',
            onConfirm: () => void runActivateProgram(programId),
        })
    }

    const handleActivateScheduled = (programId: string) => {
        confirmActivation(programId, scheduledPrograms)
    }

    const handleDeleteScheduled = (programId: string) => {
        setConfirmDialog({
            title: 'Remover da fila?',
            message: 'O programa agendado será removido da fila deste aluno.',
            confirmLabel: 'Remover',
            danger: true,
            onConfirm: () => void runDeleteProgram(programId),
        })
    }

    const handleEditScheduled = (programId: string) => {
        router.push(`/students/${student.id}/program/${programId}/edit`)
    }

    // ── Rascunhos no banco (criados fora do builder, ex.: assistente via MCP) ──
    const handleActivateDraft = (programId: string) => {
        // Mesma validação dos agendados: todo treino precisa de dia marcado.
        confirmActivation(programId, draftPrograms)
    }

    const handleDeleteDraft = (programId: string) => {
        setConfirmDialog({
            title: 'Descartar rascunho?',
            message: 'O rascunho criado pelo assistente será excluído.',
            confirmLabel: 'Descartar',
            danger: true,
            onConfirm: () => void runDeleteProgram(programId),
        })
    }

    // ── Geração de IA pendente de revisão (prescription_generations) ──
    // Descartar usa o mesmo rejectProgram do fluxo de prescrição: troca o
    // status para 'rejected' (reversível, NÃO apaga) e revalida a rota, então
    // o card sai da fila sozinho. Artefato distinto do draftProgram acima.
    const handleRejectGeneration = (generationId: string) => {
        setConfirmDialog({
            title: 'Descartar rascunho da IA?',
            message: 'A geração volta para o histórico de prescrições e sai da fila. Você pode gerar outra quando quiser.',
            confirmLabel: 'Descartar',
            danger: true,
            onConfirm: () => {
                void (async () => {
                    setProcessingId(generationId)
                    try {
                        const result = await rejectProgram(generationId)
                        if (!result.success) toast({ message: result.error ?? '', type: 'error' })
                    } finally {
                        setProcessingId(null)
                    }
                })()
            },
        })
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
                {/* Student Header — cabeçalho de página (sem card). Os stats
                    operacionais que viviam na StudentStatusBar (e duplicados
                    nos hero-stats do card de programa) foram consolidados na
                    régua de sinais vitais logo abaixo. */}
                <StudentHeader
                    student={student}
                    onEdit={handleEditStudent}
                    onDelete={handleDeleteStudent}
                    onSchedule={student.is_trainer_profile || !isOwnStudent ? undefined : () => setIsScheduleModalOpen(true)}
                    onMessage={student.is_trainer_profile || !isOwnStudent ? undefined : handleOpenMessages}
                    onStartTour={student.is_trainer_profile ? undefined : () => useOnboardingStore.getState().startTour('student_detail', 'manual')}
                    onConsultoria={
                        // Beta fechado (migration 251): sem o flag, o item nem aparece no menu.
                        student.is_trainer_profile || trainer.consultoria_enabled !== true
                            ? undefined
                            : handleStartConsultoria
                    }
                />

                {/* Régua de sinais vitais — padrão da régua do dashboard.
                    Carrega a âncora do tour "student-history-summary". */}
                <StudentKpiRuler
                    historySummary={historySummary}
                    recentSessions={recentSessions}
                    weeklyAdherence={weeklyAdherence}
                    activeProgram={activeProgram}
                />

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

                {/* Main Content Grid — programa protagonista em 2/3 da largura,
                    rail de apoio em 1/3 (redesign "ferramenta profissional") */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                    {/* Left Column: Active Program Dashboard + Load Chart */}
                    <div className="space-y-6 xl:col-span-2" data-onboarding="student-actions">
                        <ActiveProgramDashboard
                            program={activeProgram}
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

                    {/* Right Column: Próximo ciclo (prioridade) → Mensagem → Insights → Avaliações → Financeiro → Histórico */}
                    <div className="space-y-4">
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
                        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
                            {/* Fila unificada "Próximo ciclo": rascunho do builder,
                                rascunhos do assistente e agendados viram linhas de
                                UMA lista — ponto de status + rótulo mono no lugar
                                dos 3 estilos de card colorido. */}
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                                    Próximo ciclo
                                </span>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleCreateScheduled} className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity">
                                        + Criar
                                    </button>
                                    <button onClick={handleAssignScheduled} className="text-[11px] font-medium text-k-text-tertiary hover:text-k-text-primary transition-colors">
                                        Atribuir
                                    </button>
                                </div>
                            </div>

                            {studentDraft && (
                                <div className="border-b border-k-border-subtle last:border-b-0">
                                    <ProgramDraftEntry draft={studentDraft} onDiscard={discardStudentDraft} />
                                </div>
                            )}

                            {/* Rascunhos salvos no banco (criados fora do builder, ex.: assistente via MCP).
                                Diferente do studentDraft acima (rascunho do builder no localStorage):
                                estes já são programas persistidos e só precisam ser revisados/ativados. */}
                            {draftPrograms.length > 0 && draftPrograms.map(program => {
                                const workoutCount = program.assigned_workouts?.length ?? 0
                                return (
                                    <div key={program.id} className="flex items-center gap-2.5 py-2.5 border-b border-k-border-subtle last:border-b-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-none" aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12.5px] font-semibold text-k-text-primary truncate">{program.name}</p>
                                            <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-k-text-tertiary truncate">
                                                Rascunho · assistente
                                                {workoutCount > 0 && ` · ${workoutCount} ${workoutCount === 1 ? 'treino' : 'treinos'}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleActivateDraft(program.id)}
                                            disabled={!!processingId}
                                            aria-label="Ativar rascunho"
                                            title="Ativar"
                                            className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors disabled:opacity-50 flex-none"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleEditScheduled(program.id)}
                                            aria-label="Revisar rascunho"
                                            title="Revisar"
                                            className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors flex-none"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDraft(program.id)}
                                            disabled={!!processingId}
                                            aria-label="Descartar rascunho"
                                            title="Descartar"
                                            className="p-1.5 text-k-text-quaternary hover:text-red-500 hover:bg-red-500/10 rounded-control transition-colors disabled:opacity-50 flex-none"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )
                            })}

                            {/* Rascunhos gerados pela IA (geração pendente de revisão) — abrir no builder. */}
                            {aiDrafts.length > 0 && aiDrafts.map(draft => (
                                <div key={draft.id} className="flex items-center gap-2.5 py-2.5 border-b border-k-border-subtle last:border-b-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-none" aria-hidden="true" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] font-semibold text-k-text-primary truncate flex items-center gap-1.5">
                                            <AssistantMark className="w-3 h-3 text-k-text-tertiary flex-none" aria-hidden="true" />
                                            Rascunho gerado pela IA
                                        </p>
                                        <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-k-text-tertiary truncate">
                                            Rascunho · IA · pendente de revisão
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/students/${student.id}/program/new?generationId=${draft.id}`)}
                                        className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity flex-none"
                                    >
                                        Revisar
                                    </button>
                                    <button
                                        onClick={() => handleRejectGeneration(draft.id)}
                                        disabled={!!processingId}
                                        aria-label="Descartar rascunho gerado pela IA"
                                        title="Descartar"
                                        className="p-1.5 text-k-text-quaternary hover:text-red-500 hover:bg-red-500/10 rounded-control transition-colors disabled:opacity-50 flex-none"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}

                            {!scheduledPrograms || scheduledPrograms.length === 0 ? (
                                (() => {
                                    if (!activeProgram) {
                                        return (
                                            <div className="flex items-center gap-2.5 py-3">
                                                <span className="w-1.5 h-1.5 rounded-full bg-k-text-quaternary flex-none" aria-hidden="true" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12.5px] font-medium text-k-text-secondary">Sem programa ativo</p>
                                                    <p className="text-[11px] text-k-text-quaternary">Crie o primeiro programa para {student.name.split(' ')[0]}.</p>
                                                </div>
                                            </div>
                                        )
                                    }
                                    if ((activeProgram.status as string) === 'expired') {
                                        return (
                                            <div className="flex items-center gap-2.5 py-3">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-none" aria-hidden="true" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12.5px] font-medium text-red-600 dark:text-red-400">Programa expirado</p>
                                                    <p className="text-[11px] text-k-text-quaternary">Conclua, prorrogue ou atribua um novo programa.</p>
                                                </div>
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
                                            <div className="flex items-center gap-2.5 py-3">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-none" aria-hidden="true" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12.5px] font-medium text-amber-600 dark:text-amber-400">
                                                        {remainingWeeks === 0 ? 'Última semana' : `Faltam ${remainingWeeks} semana${remainingWeeks !== 1 ? 's' : ''}`}
                                                    </p>
                                                    <p className="text-[11px] text-k-text-quaternary">Prepare o próximo ciclo de treinamento.</p>
                                                </div>
                                            </div>
                                        )
                                    }
                                    if (programProgress >= 0.5) {
                                        return (
                                            <div className="flex items-center gap-2.5 py-3">
                                                <span className="w-1.5 h-1.5 rounded-full bg-k-text-quaternary flex-none" aria-hidden="true" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12.5px] font-medium text-k-text-secondary tabular-nums">Programa em {Math.round(programProgress * 100)}%</p>
                                                    <p className="text-[11px] text-k-text-quaternary">Bom momento para planejar o próximo.</p>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return (
                                        <p className="py-3 text-[12.5px] text-k-text-quaternary">Nenhum programa na fila.</p>
                                    )
                                })()
                            ) : (
                                <div>
                                    {scheduledPrograms.map(program => (
                                        <div key={program.id} className="flex items-center gap-2.5 py-2.5 border-b border-k-border-subtle last:border-b-0 group">
                                            <span className="w-1.5 h-1.5 rounded-full bg-k-text-quaternary flex-none" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12.5px] font-semibold text-k-text-primary truncate">{program.name}</p>
                                                <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-k-text-tertiary truncate">
                                                    {getScheduledActivationLabel(program.scheduled_start_date)}
                                                </p>
                                            </div>
                                            {program.duration_weeks && (
                                                <span className="font-mono text-[10px] text-k-text-quaternary tabular-nums flex-none group-hover:hidden">
                                                    {program.duration_weeks} sem
                                                </span>
                                            )}
                                            <div className="hidden group-hover:flex items-center flex-none">
                                                <button onClick={() => handleActivateScheduled(program.id)} disabled={!!processingId} aria-label="Ativar agora" title="Ativar agora" className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors disabled:opacity-50">
                                                    <Play className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleEditScheduled(program.id)} aria-label="Editar programa agendado" title="Editar" className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteScheduled(program.id)} disabled={!!processingId} aria-label="Remover da fila" title="Remover" className="p-1.5 text-k-text-quaternary hover:text-red-500 hover:bg-red-500/10 rounded-control transition-colors disabled:opacity-50">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <p className="mt-2 text-[10.5px] text-k-text-quaternary">
                                        O programa mais antigo elegível na fila será ativado automaticamente na data agendada.
                                    </p>
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
                                const s: { label: string; message: string }[] = []
                                const firstName = student.name.split(' ')[0]
                                if (historySummary.completedThisWeek >= historySummary.expectedPerWeek && historySummary.expectedPerWeek > 0) {
                                    s.push({ label: 'Parabenizar', message: `Parabéns ${firstName}! Atingiu a meta da semana, excelente dedicação!` })
                                }
                                if (historySummary.streak >= 3) {
                                    s.push({ label: 'Sequência', message: `${firstName}, ${historySummary.streak} treinos seguidos! Continue assim, o resultado vem!` })
                                }
                                if (historySummary.lastSessionDate) {
                                    const daysSince = Math.floor((Date.now() - new Date(historySummary.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
                                    if (daysSince >= 3) {
                                        s.push({ label: 'Motivar', message: `E aí ${firstName}, tudo bem? Bora voltar aos treinos, estou te esperando!` })
                                    }
                                }
                                if (s.length === 0) {
                                    s.push({ label: 'Check-in', message: `Oi ${firstName}, como está se sentindo com os treinos?` })
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
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-lg font-bold text-k-text-primary mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Treinos sem dia agendado
                        </h3>
                        <p className="text-sm text-k-text-secondary mb-1">
                            {activationBlock.workoutNames.length === 1
                                ? `O treino "${activationBlock.workoutNames[0]}" não possui dias da semana atribuídos.`
                                : `Os seguintes treinos não possuem dias da semana atribuídos: ${activationBlock.workoutNames.map(n => `"${n}"`).join(', ')}.`
                            }
                        </p>
                        <p className="text-xs text-k-text-tertiary mb-6">
                            Atribua pelo menos um dia a cada treino antes de ativar o programa.
                        </p>
                        <button
                            onClick={() => setActivationBlock(null)}
                            className="w-full py-2.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmação genérica — substitui os confirm() nativos */}
            {confirmDialog && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDialog(null)} />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-lg font-bold text-k-text-primary mb-2">{confirmDialog.title}</h3>
                        <p className="text-sm text-k-text-secondary mb-6">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="flex-1 px-4 py-2.5 bg-surface-inset hover:bg-surface-inset/70 text-k-text-primary text-sm font-semibold rounded-control transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const action = confirmDialog.onConfirm
                                    setConfirmDialog(null)
                                    action()
                                }}
                                className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-control transition-colors ${
                                    confirmDialog.danger
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-primary hover:opacity-90 text-primary-foreground transition-opacity'
                                }`}
                            >
                                {confirmDialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prorrogar programa — substitui o prompt() nativo */}
            {isExtendOpen && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsExtendOpen(false)} />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-lg font-bold text-k-text-primary mb-2">Prorrogar programa</h3>
                        <p className="text-sm text-k-text-secondary mb-4">
                            Por quantas semanas o programa atual deve ser prorrogado?
                        </p>
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={extendWeeks}
                            onChange={(e) => { setExtendWeeks(e.target.value); setExtendError(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') void handleConfirmExtend() }}
                            autoFocus
                            className="w-full font-mono text-sm text-k-text-primary bg-surface-inset border border-k-border-subtle rounded-control px-3.5 py-2.5 outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 tabular-nums"
                            aria-label="Semanas de prorrogação (1 a 12)"
                        />
                        {extendError && (
                            <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400">{extendError}</p>
                        )}
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => setIsExtendOpen(false)}
                                className="flex-1 px-4 py-2.5 bg-surface-inset hover:bg-surface-inset/70 text-k-text-primary text-sm font-semibold rounded-control transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => void handleConfirmExtend()}
                                className="flex-1 px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity"
                            >
                                Prorrogar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Criar Novo com rascunho existente — continuar ou começar do zero */}
            {createChoice && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreateChoice(null)} />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-lg font-bold text-k-text-primary mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-500" />
                            Há um rascunho em andamento
                        </h3>
                        <p className="text-sm text-k-text-secondary mb-6">
                            Você tem um rascunho não salvo deste aluno{studentDraft?.name?.trim() ? ` ("${studentDraft.name.trim()}")` : ''}. Deseja continuar de onde parou ou começar um novo programa do zero?
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={continueDraftFromChoice}
                                className="w-full py-2.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity"
                            >
                                Continuar rascunho
                            </button>
                            <button
                                onClick={startFreshFromChoice}
                                className="w-full py-2.5 bg-transparent hover:bg-red-500/10 text-red-500 dark:text-red-400 text-sm font-semibold rounded-control transition-colors border border-red-500/20"
                            >
                                Começar do zero (descarta o rascunho)
                            </button>
                            <button
                                onClick={() => setCreateChoice(null)}
                                className="w-full py-2.5 bg-transparent hover:bg-surface-inset text-k-text-tertiary text-sm font-semibold rounded-control transition-colors"
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
