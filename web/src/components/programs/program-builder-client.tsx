'use client'

import { useState, useCallback, useId, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { WorkoutPanel } from './workout-panel'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableWorkoutTab } from './sortable-workout-tab'
import { ExerciseLibrarySkeleton } from './exercise-library-panel-skeleton'
import { VolumeSummary } from './volume-summary'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Loader2, Calendar, AlertCircle, Smartphone, GitCompareArrows, X, ListChecks, FileText, Sparkles, Settings } from 'lucide-react'
import { KINEVO_DEFAULT_PREFERENCES, type PrescriptionPreferences } from '@/types/prescription-preferences'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import { PreferencesBanner } from './preferences/preferences-banner'
import { track } from '@/lib/analytics'

import dynamic from 'next/dynamic'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { useOnboardingStore } from '@/stores/onboarding-store'
import type { Exercise } from '@/types/exercise'
import { assignProgram } from '@/app/students/[id]/actions/assign-program'
import { ProgramFormTriggers, type TriggerSelection, type InitialTrigger } from './program-form-triggers'
import { saveProgramFormTriggers } from '@/actions/programs/save-program-form-triggers'
import { useToast } from '@/components/ui/toast'
import type { FormTemplateOption } from '@/actions/programs/get-form-templates-for-triggers'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import { usePrescriptionGenerationStream } from '@/hooks/use-prescription-generation-stream'
import { consumePrescriptionAnimateFlag, setPrescriptionAnimateFlag } from './helpers/prescription-animate-flag'
import { useBuilderDraft, buildDraftKey } from './helpers/use-builder-draft'
import { WorkoutCardKebab } from './workout-card/WorkoutCardKebab'

// Code-split the heaviest on-demand panels: each only renders for a specific
// builder mode (preview / ai_prescribe / compare) or when the AI feature is
// enabled. Deferring their JS until needed shaves significant bytes from the
// initial chunk (~7.2s LCP route per Vercel Speed Insights).
const PrescriptionRationalePanel = dynamic(
    () => import('./prescription-rationale-panel').then(m => ({ default: m.PrescriptionRationalePanel })),
    { ssr: false }
)
const WorkoutExecutionPreview = dynamic(
    () => import('./workout-preview/workout-execution-preview').then(m => ({ default: m.WorkoutExecutionPreview })),
    { ssr: false }
)
const AiPrescribePanel = dynamic(
    () => import('./ai-prescribe-panel').then(m => ({ default: m.AiPrescribePanel })),
    { ssr: false }
)
const AiPrescriptionPanel = dynamic(
    () => import('./ai-prescription-panel').then(m => ({ default: m.AiPrescriptionPanel })),
    { ssr: false }
)
const AiCanvasChatPanel = dynamic(
    () => import('./ai-canvas-chat/ai-canvas-chat-panel').then(m => ({ default: m.AiCanvasChatPanel })),
    { ssr: false }
)
const ProgramSelector = dynamic(
    () => import('@/components/builder/context-panel/program-selector').then(m => ({ default: m.ProgramSelector })),
    { ssr: false }
)

// Biblioteca de exercícios: rail lateral que renderiza centenas a milhares de
// linhas (não é o elemento de LCP — esse é o canvas central). Defer com
// ssr:false tira esse HTML enorme do payload do SSR (LCP central paga mais
// cedo) e do chunk de hidratação inicial. O skeleton ocupa a mesma caixa de
// 320px → sem CLS. É a rota mais pesada do app (Speed Insights: RES 45).
const ExerciseLibraryPanel = dynamic(
    () => import('./exercise-library-panel').then(m => ({ default: m.ExerciseLibraryPanel })),
    { ssr: false, loading: () => <ExerciseLibrarySkeleton /> }
)
// Drawers de preferências: overlays que só abrem em interação e arrastam
// framer-motion. Defer tira a engine de animação do chunk inicial do builder.
const PreferencesDrawer = dynamic(
    () => import('./preferences/preferences-drawer').then(m => ({ default: m.PreferencesDrawer })),
    { ssr: false }
)
const PreferencesWizard = dynamic(
    () => import('./preferences/preferences-wizard').then(m => ({ default: m.PreferencesWizard })),
    { ssr: false }
)

// Tipos canônicos do modelo agora moram em ./builder-model. O re-export
// preserva os ~20 importadores existentes (workout-panel, workout-card/*,
// preview, hooks) sem churn.
export type { BuilderViewMode, Workout, WorkoutItem } from './builder-model'

interface ProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workout_templates?: Array<{
        id: string
        name: string
        order_index: number
        frequency?: string[] | null
        workout_item_templates?: Array<{
            id: string
            item_type: string
            order_index: number
            parent_item_id: string | null
            exercise_id: string | null
            substitute_exercise_ids?: string[] | null
            sets: number | null
            reps: string | null
            rest_seconds: number | null
            notes: string | null
            exercise_function?: string | null
            // Shape cru do banco: jsonb e set_type sem narrowing. A hidratação
            // em initializeWorkouts converte pros tipos internos do builder.
            item_config?: import('@kinevo/shared/types/database').Json | Record<string, unknown>
            method_key?: string | null
            rounds?: number | null
            workout_item_set_templates?: Array<
                Omit<import('@kinevo/shared/types/prescription').WorkoutSet, 'set_type'> & { set_type: string }
            > | null
        }>
    }>
}

type ProgramTemplateInsert =
    import('@kinevo/shared/types/database').Database['public']['Tables']['program_templates']['Insert']


interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
    ai_prescriptions_enabled?: boolean
}

interface StudentContext {
    id: string
    name: string
    activeProgramName?: string | null
}

interface ProgramBuilderClientProps {
    trainer: Trainer
    program: ProgramData | null
    exercises: Exercise[]
    studentContext?: StudentContext
    initialAssignmentType?: 'immediate' | 'scheduled'
    /** When present, the program was generated by the AI prescription engine */
    prescriptionGenerationId?: string
    /** Extended reasoning from the AI agent (shown in collapsible panel) */
    prescriptionReasoning?: import('@kinevo/shared/types/prescription').PrescriptionReasoningExtended | null
    /** Available form templates for trigger configuration */
    formTriggerTemplates?: FormTemplateOption[]
    /** Pre-loaded triggers when editing an existing program */
    initialFormTriggers?: {
        preWorkout: InitialTrigger | null
        postWorkout: InitialTrigger | null
    }
    /** Prescription data for the AI panel (Fase 1). Fetched only when trainer.ai_prescriptions_enabled. */
    prescriptionData?: PrescriptionData | null
    /**
     * Preferências de prescrição do treinador. Quando ausente, a engrenagem
     * e o drawer não são renderizados (call sites legados ainda não hidratam).
     */
    prescriptionPreferences?: PrescriptionPreferences
}


// ── Núcleo compartilhado: tipos, helpers per-set e mutações puras ──
import {
    aggregatesFromItem,
    asItemConfig,
    buildSetSchemeRows,
    effectiveMethodKey,
    effectiveRoundsForItem,
    generateWorkoutName,
    hydrateSetScheme,
    makeCardioItem,
    makeExerciseItem,
    makeNoteItem,
    makeWarmupItem,
    parseSetsCount,
    tempId,
    type BuilderViewMode,
    type Workout,
    type WorkoutItem,
} from './builder-model'
import { useWorkoutModel } from './helpers/use-workout-model'
import { useCompareMode } from './helpers/use-compare-mode'
import { useProgramSchedule } from './helpers/use-program-schedule'
import { useCanvasDnd } from './helpers/use-canvas-dnd'
import { useBuilderChrome } from './helpers/use-builder-chrome'
import type { MethodKey, WorkoutSet } from '@kinevo/shared/types/prescription'

/** Persist the materialized children rows for a saved workout_item_template.
 *  A expansão por rounds vive em buildSetSchemeRows (núcleo compartilhado);
 *  aqui só entra a coluna FK desta tabela. */
async function insertSetSchemeRows(
    supabase: ReturnType<typeof createClient>,
    workoutItemTemplateId: string,
    scheme: WorkoutSet[] | null | undefined,
    rounds: number,
): Promise<void> {
    const rows = buildSetSchemeRows(scheme, rounds).map(r => ({
        workout_item_template_id: workoutItemTemplateId,
        ...r,
    }))
    if (rows.length === 0) return
    const { error } = await supabase.from('workout_item_set_templates').insert(rows)
    if (error) throw error
}

export function ProgramBuilderClient({ trainer, program, exercises, studentContext, initialAssignmentType = 'immediate', prescriptionGenerationId, prescriptionReasoning, formTriggerTemplates = [], initialFormTriggers, prescriptionData, prescriptionPreferences }: ProgramBuilderClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tabDndId = useId()
    const { toast } = useToast()
    const isEditing = !!program && !!program.id && !program.id.startsWith('temp_')
    const isStudentContext = !!studentContext

    // Local exercises state to support inline creation
    const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises)

    // Program state
    const [name, setName] = useState(program?.name || '')
    const [description, setDescription] = useState(program?.description || '')
    const [assignmentType] = useState<'immediate' | 'scheduled'>(initialAssignmentType)
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
    const [builderViewMode, setBuilderViewMode] = useState<BuilderViewMode>(
        prescriptionPreferences?.visualization.default_view ?? 'preview',
    )

    // Preferências de prescrição — hidratação one-shot do espelho client-side.
    const preferencesGearButtonRef = useRef<HTMLButtonElement | null>(null)
    const openPreferencesDrawerStore = usePrescriptionPreferencesStore((s) => s.openDrawer)
    const openPreferencesDrawer = useCallback(() => {
        track('prescription_preferences_drawer_opened')
        openPreferencesDrawerStore()
    }, [openPreferencesDrawerStore])
    useEffect(() => {
        if (!prescriptionPreferences) return
        usePrescriptionPreferencesStore.getState().setPreferences(prescriptionPreferences)
        // Auto-abre o wizard se o treinador ainda não passou pela onboarding.
        if (!prescriptionPreferences.wizard_completed && !prescriptionPreferences.wizard_dismissed) {
            track('prescription_preferences_wizard_started', { source: 'auto_open' })
            usePrescriptionPreferencesStore.getState().openWizard()
        }
        // Intencional: hidrata uma vez só na montagem. Incluir prescriptionPreferences
        // nas deps re-hidrataria o estado em qualquer re-render do pai, sobrescrevendo
        // edits otimistas em andamento.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])


    const [showActivateConfirm, setShowActivateConfirm] = useState(false)
    const [showTemplateDialog, setShowTemplateDialog] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [alsoActivate, setAlsoActivate] = useState(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [frequencyWarning, setFrequencyWarning] = useState<{ workoutNames: string[], onConfirm: () => void } | null>(null)
    // Soft warning: workout(s) being assigned to a student without any prescribed
    // exercise. The student would open an empty training day. Mirrors the
    // frequencyWarning pattern — warns, but lets the trainer proceed on purpose.
    const [emptyWorkoutWarning, setEmptyWorkoutWarning] = useState<{ workoutNames: string[], onConfirm: () => void } | null>(null)
    const [activationBlock, setActivationBlock] = useState<{ workoutNames: string[] } | null>(null)

    // Início ↔ semanas ↔ fim (sync bidirecional) — hook compartilhado.
    const {
        startDate,
        endDate,
        durationWeeks,
        setDurationWeeks,
        isEndDateFixed,
        handleWeeksChange,
        handleEndDateChange,
        handleStartDateChange,
    } = useProgramSchedule({
        initialStartDate: new Date().toISOString().split('T')[0],
        initialWeeks: program?.duration_weeks?.toString()
            ?? prescriptionPreferences?.program_structure.default_weeks?.toString()
            ?? '4',
    })

    // ── Compare mode (hook compartilhado) ──────────────────────────────────
    const enterCompareView = useCallback(() => setBuilderViewMode('compare'), [])
    const exitCompareView = useCallback(() => setBuilderViewMode('normal'), [])
    const {
        compareProgramsList,
        compareProgramsLoading,
        compareSelectedProgramId,
        compareProgramData,
        compareProgramLoading,
        compareWorkouts,
        compareActiveWorkoutId,
        setCompareActiveWorkoutId,
        compareActiveWorkout,
        handleEnterCompare,
        handleSelectCompareProgram,
        handleExitCompare,
    } = useCompareMode({
        studentId: studentContext?.id ?? null,
        exercises: localExercises,
        onEnter: enterCompareView,
        onExit: exitCompareView,
    })

    const handleEnterPreview = useCallback(() => {
        setBuilderViewMode('preview')
    }, [])

    const handleExitPreview = useCallback(() => {
        setBuilderViewMode('normal')
    }, [])

    // ── AI Prescription Panel (Fase 1) ──
    const aiPanelAvailable = trainer.ai_prescriptions_enabled === true
        && !!studentContext
        && !!prescriptionData
    const [aiPanelOpen, setAiPanelOpen] = useState(false)
    // Painel de chat "Gerar com IA" ao vivo (feature nova). O botão abre ESTE;
    // o wizard de formulário (aiPanelOpen) fica como fallback ("usar formulário").
    const [chatPanelOpen, setChatPanelOpen] = useState(false)
    const aiPanelAutoOpenedRef = useRef(false)

    // ── AI Panel lifecycle ──
    // Auto-open once on mount APENAS com ?mode=ai (intenção explícita de usar o
    // painel). NÃO auto-abre por deeplink de geração (?generationId=) — ao "Revisar
    // no builder" o treinador quer ver o construtor, não o painel cobrindo a direita
    // (o card do Assistente já avisou que o programa foi gerado). O painel segue
    // acessível pelo botão de toggle.
    useEffect(() => {
        if (!aiPanelAvailable || aiPanelAutoOpenedRef.current) return
        const modeAi = searchParams?.get('mode') === 'ai'
        if (modeAi) {
            setAiPanelOpen(true)
            aiPanelAutoOpenedRef.current = true
        }
    }, [aiPanelAvailable, searchParams])

    const toggleAiPanel = useCallback(() => {
        setAiPanelOpen(prev => !prev)
    }, [])

    const closeAiPanel = useCallback(() => {
        setAiPanelOpen(false)
    }, [])

    const handleAcceptGeneratedProgram = useCallback((generationId: string) => {
        if (!studentContext) return
        // Arm the animate flag BEFORE navigation. The new mount consumes it
        // to trigger the reveal. Refresh = no flag = full program at once.
        setPrescriptionAnimateFlag(generationId)
        // Re-render the Server Component with the new generation, which triggers
        // the existing SSR hydration path (program/new/page.tsx loads output_snapshot).
        const qs = new URLSearchParams()
        qs.set('source', 'prescription')
        qs.set('generationId', generationId)
        if (assignmentType === 'scheduled') qs.set('scheduled', 'true')
        router.replace(`/students/${studentContext.id}/program/new?${qs.toString()}`)
    }, [router, studentContext, assignmentType])

    const handleEnterAiPrescribe = useCallback(() => {
        setBuilderViewMode('ai_prescribe')
    }, [])

    const handleExitAiPrescribe = useCallback(() => {
        setBuilderViewMode('normal')
    }, [])

    // Initialize workouts helper
    const initializeWorkouts = (): Workout[] => {
        if (!program?.workout_templates || program.workout_templates.length === 0) {
            // Programa novo: seeda N workouts conforme prefs do treinador.
            // Programas existentes (program !== null) preservam tudo.
            const programStructure = prescriptionPreferences?.program_structure
                ?? KINEVO_DEFAULT_PREFERENCES.program_structure
            const count = Math.max(1, programStructure.default_workout_count)
            return Array.from({ length: count }, (_, i): Workout => ({
                id: tempId(),
                name: generateWorkoutName(i, programStructure.naming_convention),
                order_index: i,
                items: [],
                frequency: [],
            }))
        }

        return program.workout_templates
            .sort((a, b) => a.order_index - b.order_index)
            .map(wt => {
                const rawItems = wt.workout_item_templates || []
                const parents = rawItems.filter(i => !i.parent_item_id)
                const children = rawItems.filter(i => i.parent_item_id)

                const items: WorkoutItem[] = parents
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(p => {
                        const itemChildren = children
                            .filter(c => c.parent_item_id === p.id)
                            .sort((a, b) => a.order_index - b.order_index)
                            .map(c => {
                                // CHECK constraint (migration 111) garante a union de set_type
                                const childHydrated = hydrateSetScheme(c.workout_item_set_templates as WorkoutSet[] | null | undefined, c.rounds ?? 1)
                                return {
                                    id: c.id,
                                    item_type: c.item_type as WorkoutItem['item_type'],
                                    order_index: c.order_index,
                                    parent_item_id: c.parent_item_id,
                                    exercise_id: c.exercise_id,
                                    substitute_exercise_ids: c.substitute_exercise_ids || [],
                                    exercise: c.exercise_id ? exercises.find(e => e.id === c.exercise_id) : undefined,
                                    sets: c.sets,
                                    reps: c.reps,
                                    rest_seconds: c.rest_seconds,
                                    notes: c.notes,
                                    exercise_function: c.exercise_function || null,
                                    item_config: asItemConfig(c.item_config),
                                    set_scheme: childHydrated.scheme,
                                    method_key: (c.method_key as WorkoutItem['method_key']) ?? null,
                                    rounds: childHydrated.rounds,
                                }
                            })

                        const parentHydrated = hydrateSetScheme(p.workout_item_set_templates as WorkoutSet[] | null | undefined, p.rounds ?? 1)
                        return {
                            id: p.id,
                            item_type: p.item_type as WorkoutItem['item_type'],
                            order_index: p.order_index,
                            parent_item_id: p.parent_item_id,
                            exercise_id: p.exercise_id,
                            substitute_exercise_ids: p.substitute_exercise_ids || [],
                            exercise: p.exercise_id ? exercises.find(e => e.id === p.exercise_id) : undefined,
                            sets: p.sets,
                            reps: p.reps,
                            rest_seconds: p.rest_seconds,
                            notes: p.notes,
                            exercise_function: p.exercise_function || null,
                            item_config: asItemConfig(p.item_config),
                            set_scheme: parentHydrated.scheme,
                            method_key: (p.method_key as WorkoutItem['method_key']) ?? null,
                            rounds: parentHydrated.rounds,
                            children: itemChildren
                        }
                    })

                return {
                    id: wt.id,
                    name: wt.name,
                    order_index: wt.order_index,
                    frequency: wt.frequency || [],
                    items
                }
            })
    }

    const workoutNamingConvention = prescriptionPreferences?.program_structure.naming_convention
        ?? KINEVO_DEFAULT_PREFERENCES.program_structure.naming_convention
    const {
        workouts,
        setWorkouts,
        activeWorkoutId,
        setActiveWorkoutId,
        activeWorkout,
        workoutsWithoutDays,
        occupiedDays,
        addWorkout,
        createWorkoutWithName,
        updateWorkoutName,
        updateWorkoutFrequency,
        deleteWorkout,
        duplicateWorkout,
        handleWorkoutDragEnd,
        cleanupEmptyPlaceholders,
        appendItemsWith,
        updateItem,
        deleteItem,
        duplicateItem,
        moveItem,
        handleReorderItem,
        createSupersetWithNext,
        addToExistingSuperset,
        removeFromSuperset,
        dissolveSuperset,
    } = useWorkoutModel({
        initialWorkouts: initializeWorkouts,
        workoutName: (index) => generateWorkoutName(index, workoutNamingConvention),
    })

    // ── Fase 1.5 progressive reveal ──
    // Read the sessionStorage flag once on mount. The flag is set by the AI
    // panel right before it navigates here with ?generationId=…; if present,
    // we animate workouts appearing one by one. Absent = full reveal
    // (refresh, deeplink, shared URL).
    // Pure read: we only *check* if the flag exists during initial render.
    // The consume (which has the side effect of removing the key) happens in a
    // one-shot useEffect below. This keeps the useState initializer pure, so
    // React StrictMode's double-invoke doesn't burn the flag on the first
    // shadow render.
    const [streamAnimate] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false
        if (!prescriptionGenerationId) return false
        return window.sessionStorage.getItem(`prescription:animate:${prescriptionGenerationId}`) === '1'
    })
    const streamHandoffDoneRef = useRef(false)
    const streamClearedRef = useRef(false)
    const streamFlagConsumedRef = useRef(false)

    // Consume (delete) the flag exactly once post-mount, so a real remount with
    // the same generationId (shouldn't happen in practice, but StrictMode in
    // dev does mount → unmount → mount) doesn't double-trigger the reveal.
    useEffect(() => {
        if (!streamAnimate) return
        if (!prescriptionGenerationId) return
        if (streamFlagConsumedRef.current) return
        streamFlagConsumedRef.current = true
        consumePrescriptionAnimateFlag(prescriptionGenerationId)
    }, [streamAnimate, prescriptionGenerationId])
    const stream = usePrescriptionGenerationStream({
        generationId: streamAnimate ? (prescriptionGenerationId ?? null) : null,
        exercises: localExercises,
        revealIntervalMs: 450,
    })

    // When animation is active, clear whatever SSR hydrated (via initializeWorkouts)
    // so the reveal starts from an empty canvas. Done once per mount, post-hydration
    // to avoid an SSR mismatch.
    useEffect(() => {
        if (!streamAnimate) return
        if (streamClearedRef.current) return
        streamClearedRef.current = true
        setWorkouts([])
        setActiveWorkoutId(null)
    }, [streamAnimate, setWorkouts, setActiveWorkoutId])

    // Mirror the hook's growing workouts list into local state while streaming.
    // Once `isDone`, we stop copying — local state becomes soberano so the
    // trainer can edit freely without the hook snapping it back.
    useEffect(() => {
        if (!streamAnimate) return
        if (streamHandoffDoneRef.current) return
        // Keep local state in sync while the reveal progresses.
        setWorkouts(stream.workouts)
        if (stream.workouts.length > 0) {
            setActiveWorkoutId(prev => prev ?? stream.workouts[0].id)
        }
        if (stream.isDone) {
            streamHandoffDoneRef.current = true
        }
    }, [streamAnimate, stream.workouts, stream.isDone, setWorkouts, setActiveWorkoutId])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [nameShake, setNameShake] = useState(false)
    // Chrome da tela (header auto-hide, preview scale, biblioteca) — hook compartilhado.
    const {
        canvasScrollRef,
        isCanvasScrolled,
        isHeaderHidden,
        handleCanvasScroll,
        previewScale,
        isLibraryCollapsed,
        toggleLibrary,
    } = useBuilderChrome({
        initialLibraryCollapsed: prescriptionPreferences
            ? !prescriptionPreferences.visualization.library_open_on_enter
            : false,
    })
    const [formTriggers, setFormTriggers] = useState<TriggerSelection>({
        preWorkout: initialFormTriggers?.preWorkout?.formTemplateId ?? null,
        postWorkout: initialFormTriggers?.postWorkout?.formTemplateId ?? null,
    })
    const [checkinExpanded, setCheckinExpanded] = useState(false)
    const formTriggerCount = (formTriggers.preWorkout ? 1 : 0) + (formTriggers.postWorkout ? 1 : 0)

    // ── Rascunho local (anti-perda de trabalho) ──
    // Persiste o programa em construção em localStorage para que refresh,
    // sessão expirada, erro ou fechamento de aba não apaguem o treino.
    const draftStorageKey = useMemo(() => buildDraftKey({
        trainerId: trainer.id,
        isEditing,
        programId: program?.id,
        isStudentContext,
        studentId: studentContext?.id,
    }), [trainer.id, isEditing, program?.id, isStudentContext, studentContext])

    const draftSnapshot = useMemo(() => ({
        name,
        description,
        durationWeeks,
        activeWorkoutId,
        workouts,
        formTriggers,
    }), [name, description, durationWeeks, activeWorkoutId, workouts, formTriggers])

    const isDraftMeaningful = useCallback(
        (s: typeof draftSnapshot) =>
            s.name.trim() !== '' || s.workouts.some(w => (w.items?.length ?? 0) > 0),
        [],
    )

    // Não salvar/avisar enquanto a animação de revelação da IA roda (antes do
    // handoff para edição manual); aí o stream é a fonte da verdade.
    const draftEnabled = !streamAnimate || stream.isDone

    const { pendingDraft, dismissPending, clearDraft, isDirty, flush, markPristine } = useBuilderDraft({
        storageKey: draftStorageKey,
        snapshot: draftSnapshot,
        enabled: draftEnabled,
        isMeaningful: isDraftMeaningful,
    })

    // Rota de "voltar" do header, resolvida pelo contexto.
    const backRoute = isStudentContext && studentContext
        ? `/students/${studentContext.id}`
        : '/programs'
    const [showExitConfirm, setShowExitConfirm] = useState(false)

    // "Salvar como rascunho": garante a escrita e sai.
    const saveDraftAndLeave = useCallback(() => {
        flush()
        router.push(backRoute)
    }, [flush, router, backRoute])

    // "Descartar": apaga o rascunho autosalvo e sai.
    const discardAndLeave = useCallback(() => {
        clearDraft()
        router.push(backRoute)
    }, [clearDraft, router, backRoute])

    const handleBack = useCallback(() => {
        if (isDirty) {
            setShowExitConfirm(true)
            return
        }
        router.push(backRoute)
    }, [isDirty, router, backRoute])

    // Auto-restaura o rascunho assim que o builder monta — sem banner. O
    // conteúdo restaurado vira o estado "limpo" (markPristine), então sair sem
    // editar não dispara aviso. Suprimido durante a animação de IA.
    const autoRestoredRef = useRef(false)
    useEffect(() => {
        if (autoRestoredRef.current) return
        if (streamAnimate) return
        if (!pendingDraft) return
        autoRestoredRef.current = true
        const d = pendingDraft.data
        setName(d.name)
        setDescription(d.description)
        setDurationWeeks(d.durationWeeks)
        setWorkouts(d.workouts)
        setActiveWorkoutId(d.activeWorkoutId ?? d.workouts[0]?.id ?? null)
        setFormTriggers(d.formTriggers)
        markPristine(d)
        dismissPending()
    }, [pendingDraft, streamAnimate, markPristine, dismissPending, setDurationWeeks, setWorkouts, setActiveWorkoutId])
    // Sensors for tab drag-and-drop (distance constraint allows click without triggering drag)
    const tabSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor),
    )


    // ── Adders: prefs do treinador resolvidas aqui; mutações no hook ────────
    const addExerciseToWorkout = useCallback((
        workoutId: string,
        exercise: Exercise,
        options?: {
            sets?: number
            reps?: string
            rest_seconds?: number | null
            notes?: string | null
            method_key?: MethodKey | null
            set_scheme?: WorkoutSet[] | null
            rounds?: number | null
        },
    ) => {
        const setDefaults = prescriptionPreferences?.set_defaults ?? KINEVO_DEFAULT_PREFERENCES.set_defaults
        const addCfg = prescriptionPreferences?.add_exercise ?? KINEVO_DEFAULT_PREFERENCES.add_exercise
        appendItemsWith(workoutId, (w) => {
            // TODO v2: client model has single rest_seconds; pref.rest_isolation_seconds
            // is persisted but not consumed. See PRD_preferencias_prescricao_LIMITACOES_V1.md.
            const newItem = makeExerciseItem(exercise, {
                setsCount: options?.sets ?? parseSetsCount(setDefaults.sets),
                reps: options?.reps ?? setDefaults.reps,
                restSeconds: options?.rest_seconds ?? setDefaults.rest_compound_seconds,
                notes: options?.notes ?? null,
                setScheme: options?.set_scheme,
                seedSetEditor: addCfg.open_mode === 'set_editor',
                methodKey: options?.method_key ?? null,
                rounds: options?.rounds ?? 1,
            })
            // Heurística auto_warmup: injeta um aquecimento ANTES do exercício
            // quando a pref está ligada E é a primeira adição neste workout.
            // Não duplica em workouts já populados.
            return addCfg.auto_warmup && w.items.length === 0
                ? [makeWarmupItem(), newItem]
                : [newItem]
        })
    }, [appendItemsWith, prescriptionPreferences])

    const addExerciseFromLibrary = useCallback((exercise: Exercise, options?: { sets?: number; reps?: string; rest_seconds?: number | null; notes?: string | null }) => {
        if (!activeWorkoutId) return
        addExerciseToWorkout(activeWorkoutId, exercise, options)
    }, [activeWorkoutId, addExerciseToWorkout])

    const handleExerciseCreated = useCallback((newExercise: Exercise) => {
        setLocalExercises(prev => [newExercise, ...prev])
    }, [])

    // Drag-and-drop biblioteca → canvas
    const { isDraggingOver, handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop } = useCanvasDnd({
        exercises: localExercises,
        onDropExercise: addExerciseFromLibrary,
    })

    const addNote = useCallback((workoutId: string) => {
        const noteTemplate = prescriptionPreferences?.quick_blocks.note_template
            ?? KINEVO_DEFAULT_PREFERENCES.quick_blocks.note_template
        appendItemsWith(workoutId, () => [makeNoteItem(noteTemplate ?? '')])
    }, [appendItemsWith, prescriptionPreferences])

    const addWarmup = useCallback((workoutId: string) => {
        const warmupTemplate = prescriptionPreferences?.quick_blocks.warmup_template
            ?? KINEVO_DEFAULT_PREFERENCES.quick_blocks.warmup_template
        appendItemsWith(workoutId, () => [makeWarmupItem(warmupTemplate)])
    }, [appendItemsWith, prescriptionPreferences])

    const addCardio = useCallback((workoutId: string) => {
        const aerobicTemplate = prescriptionPreferences?.quick_blocks.aerobic_template
            ?? KINEVO_DEFAULT_PREFERENCES.quick_blocks.aerobic_template
        appendItemsWith(workoutId, () => [makeCardioItem(aerobicTemplate)])
    }, [appendItemsWith, prescriptionPreferences])


    // Save program — overrideType allows buttons to pass the assignment type directly
    const saveProgram = async (overrideType?: 'immediate' | 'scheduled', skipFrequencyCheck = false, skipEmptyCheck = false) => {
        const effectiveAssignmentType = overrideType ?? assignmentType
        if (!name.trim()) {
            setError('Por favor, preencha o nome do programa.')
            setNameShake(true)
            setTimeout(() => setNameShake(false), 600)
            return
        }

        // Check for workouts without scheduled days
        if (!skipFrequencyCheck) {
            const missing = workouts.filter(w => !w.frequency || w.frequency.length === 0)
            if (missing.length > 0) {
                setFrequencyWarning({
                    workoutNames: missing.map(w => w.name),
                    onConfirm: () => {
                        setFrequencyWarning(null)
                        saveProgram(overrideType, true)
                    }
                })
                return
            }
        }

        // Soft check (student assignments only): workout(s) with no prescribed
        // exercise. Warmups/notes alone don't count as content; cardio does, so
        // a pure-aerobic day isn't flagged. The trainer can still proceed.
        if (!skipEmptyCheck && isStudentContext) {
            const empty = workouts.filter(w => !w.items?.some(i => i.item_type === 'exercise' || i.item_type === 'superset' || i.item_type === 'cardio'))
            if (empty.length > 0) {
                setEmptyWorkoutWarning({
                    workoutNames: empty.map(w => w.name),
                    onConfirm: () => {
                        setEmptyWorkoutWarning(null)
                        saveProgram(overrideType, true, true)
                    }
                })
                return
            }
        }

        setSaving(true)
        setError(null)

        const supabase = createClient()

        try {
            // ... existing save logic ...
            let programId = program?.id

            if (isEditing) {
                if (!programId) throw new Error('Programa em edição sem id')
                // Update existing program
                const { error: updateError } = await supabase
                    .from('program_templates')
                    .update({
                        name: name.trim(),
                        description: description.trim() || null,
                        duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                    })
                    .eq('id', programId)

                if (updateError) throw updateError

                // Delete existing workouts (cascade will delete items)
                await supabase
                    .from('workout_templates')
                    .delete()
                    .eq('program_template_id', programId)
            } else {
                // Create new program
                // is_template: true if saving as template OR not in student context
                const isTemplate = !isStudentContext

                const { data: newProgram, error: createError } = await supabase
                    .from('program_templates')
                    // trainer_id é preenchido pelo trigger set_trainer_id (BEFORE INSERT)
                    .insert({
                        name: name.trim(),
                        description: description.trim() || null,
                        duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                        is_template: isTemplate,
                    } as ProgramTemplateInsert)
                    .select('id')
                    .single()

                if (createError) throw createError
                programId = newProgram.id
            }

            // Save workouts and items
            for (const workout of workouts) {
                const { data: savedWorkout, error: workoutError } = await supabase
                    .from('workout_templates')
                    .insert({
                        program_template_id: programId,
                        name: workout.name,
                        order_index: workout.order_index,
                        frequency: workout.frequency
                    })
                    .select('id')
                    .single()

                if (workoutError) throw workoutError

                // Save items
                for (const item of workout.items) {
                    const aggs = aggregatesFromItem(item)
                    const itemRounds = effectiveRoundsForItem(item)
                    const { data: savedItem, error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: savedWorkout.id,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
                            exercise_id: item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids || [],
                            sets: aggs.sets,
                            reps: aggs.reps,
                            rest_seconds: aggs.rest_seconds,
                            notes: item.notes,
                            exercise_function: item.exercise_function || null,
                            item_config: item.item_config || {},
                            method_key: effectiveMethodKey(item),
                            rounds: itemRounds,
                        })
                        .select('id')
                        .single()

                    if (itemError) throw itemError

                    // Per-set children (Fase 2 / 4.4 — expanded by rounds).
                    // Skipped silently for items inside superset.
                    await insertSetSchemeRows(supabase, savedItem.id, item.set_scheme, itemRounds)

                    // Save children (for supersets)
                    if (item.children) {
                        for (const child of item.children) {
                            const { error: childError } = await supabase
                                .from('workout_item_templates')
                                .insert({
                                    workout_template_id: savedWorkout.id,
                                    item_type: child.item_type,
                                    order_index: child.order_index,
                                    parent_item_id: savedItem.id,
                                    exercise_id: child.exercise_id,
                                    substitute_exercise_ids: child.substitute_exercise_ids || [],
                                    sets: child.sets,
                                    reps: child.reps,
                                    rest_seconds: child.rest_seconds,
                                    notes: child.notes,
                                    exercise_function: child.exercise_function || null,
                                    item_config: child.item_config || {},
                                })

                            if (childError) throw childError
                        }
                    }
                }
            }

            // Save form triggers (secondary — failure shows warning, doesn't
            // revert program). SEM gate de (pre || post): a action deleta
            // quando recebe null — desmarcar AMBOS precisa persistir (M2).
            if (programId) {
                const triggerResult = await saveProgramFormTriggers({
                    programTemplateId: programId,
                    preWorkout: formTriggers.preWorkout,
                    postWorkout: formTriggers.postWorkout,
                })
                if (!triggerResult.success) {
                    console.error('Form triggers save error:', triggerResult.error)
                }
            }

            // Auto-assign to student if in student context
            if (isStudentContext && studentContext && programId) {
                // Prepare schedule map
                const workoutSchedule: Record<number, number[]> = {}
                workouts.forEach(w => {
                    const days = w.frequency || []
                    if (days.length > 0) {
                        const dayMap: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                        workoutSchedule[w.order_index] = days
                            .map(d => dayMap[d])
                            .filter(d => d !== undefined)
                    }
                })

                const result = await assignProgram({
                    studentId: studentContext.id,
                    templateId: programId,
                    startDate: new Date(startDate).toISOString(),
                    isScheduled: effectiveAssignmentType === 'scheduled',
                    workoutSchedule,
                    prescriptionGenerationId,
                })

                if (!result.success) {
                    console.error('Auto-assign error:', result.error)
                    // Don't throw - program was saved, just assignment failed
                    setError(`Programa salvo, mas erro ao atribuir: ${result.error}`)
                    return // Stop redirection to show error
                }

                // Mark both milestones: program created AND assigned
                useOnboardingStore.getState().completeMilestone('first_program_created')
                useOnboardingStore.getState().completeMilestone('first_program_assigned')

                clearDraft()
                router.push(`/students/${studentContext.id}`)
            } else {
                // Template saved (no assignment)
                useOnboardingStore.getState().completeMilestone('first_program_created')
                clearDraft()
                router.push('/programs')
            }
            router.refresh()
        } catch (err: unknown) {
            // Supabase PostgrestError is a plain object, not instanceof Error
            const message = err instanceof Error
                ? err.message
                : typeof err === 'object' && err !== null && 'message' in err
                    ? String((err as any).message)
                    : 'Erro ao salvar programa'
            console.error('Save program error:', message, err)
            setError(message)
        } finally {
            setSaving(false)
        }
    }

    // Save current program structure as a reusable template
    const saveAsTemplate = async (skipFrequencyCheck = false) => {
        if (!templateName.trim()) return

        // Check for workouts without scheduled days
        if (!skipFrequencyCheck) {
            const missing = workouts.filter(w => !w.frequency || w.frequency.length === 0)
            if (missing.length > 0) {
                setFrequencyWarning({
                    workoutNames: missing.map(w => w.name),
                    onConfirm: () => {
                        setFrequencyWarning(null)
                        saveAsTemplate(true)
                    }
                })
                return
            }
        }

        setSavingTemplate(true)
        setError(null)

        const supabase = createClient()

        try {
            // 1. Create template in program_templates with is_template = true
            const { data: newTemplate, error: createError } = await supabase
                .from('program_templates')
                // trainer_id é preenchido pelo trigger set_trainer_id (BEFORE INSERT)
                .insert({
                    name: templateName.trim(),
                    description: description.trim() || null,
                    duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                    is_template: true,
                } as ProgramTemplateInsert)
                .select('id')
                .single()

            if (createError) throw createError

            // 2. Save workouts and items (same structure as saveProgram)
            for (const workout of workouts) {
                const { data: savedWorkout, error: workoutError } = await supabase
                    .from('workout_templates')
                    .insert({
                        program_template_id: newTemplate.id,
                        name: workout.name,
                        order_index: workout.order_index,
                        frequency: workout.frequency,
                    })
                    .select('id')
                    .single()

                if (workoutError) throw workoutError

                for (const item of workout.items) {
                    const aggs = aggregatesFromItem(item)
                    const itemRounds = effectiveRoundsForItem(item)
                    const { data: savedItem, error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: savedWorkout.id,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
                            exercise_id: item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids || [],
                            sets: aggs.sets,
                            reps: aggs.reps,
                            rest_seconds: aggs.rest_seconds,
                            notes: item.notes,
                            exercise_function: item.exercise_function || null,
                            item_config: item.item_config || {},
                            method_key: effectiveMethodKey(item),
                            rounds: itemRounds,
                        })
                        .select('id')
                        .single()

                    if (itemError) throw itemError

                    await insertSetSchemeRows(supabase, savedItem.id, item.set_scheme, itemRounds)

                    if (item.children) {
                        for (const child of item.children) {
                            const { error: childError } = await supabase
                                .from('workout_item_templates')
                                .insert({
                                    workout_template_id: savedWorkout.id,
                                    item_type: child.item_type,
                                    order_index: child.order_index,
                                    parent_item_id: savedItem.id,
                                    exercise_id: child.exercise_id,
                                    substitute_exercise_ids: child.substitute_exercise_ids || [],
                                    sets: child.sets,
                                    reps: child.reps,
                                    rest_seconds: child.rest_seconds,
                                    notes: child.notes,
                                    exercise_function: child.exercise_function || null,
                                    item_config: child.item_config || {},
                                })
                            if (childError) throw childError
                        }
                    }
                }
            }

            setShowTemplateDialog(false)

            // 3. Optionally also activate for the student
            if (alsoActivate && isStudentContext && studentContext) {
                // Use the existing saveProgram flow with 'immediate'
                await saveProgram('immediate')
            } else {
                // Just show success and stay on page
                setError(null)
                toast({ message: 'Modelo salvo na biblioteca!', type: 'success' })
            }
        } catch (err: unknown) {
            const message = err instanceof Error
                ? err.message
                : typeof err === 'object' && err !== null && 'message' in err
                    ? String((err as any).message)
                    : 'Erro ao salvar modelo'
            console.error('Save template error:', message, err)
            setError(message)
        } finally {
            setSavingTemplate(false)
        }
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-surface-canvas">
                {/* Compact Header — auto-hides on scroll down, reappears on scroll up */}
                <div className={`flex-shrink-0 bg-white dark:bg-surface-primary backdrop-blur-md border-b border-[#E8E8ED] dark:border-k-border-primary flex flex-col gap-y-2 px-4 lg:px-6 z-sticky transition-all duration-250 ease-in-out overflow-hidden ${isHeaderHidden ? 'max-h-0 py-0 border-b-0 opacity-0' : isCanvasScrolled ? 'max-h-32 py-1.5 opacity-100' : 'max-h-32 py-3 opacity-100'}`}>
                    {/* ── Camada 1: identidade + ação de finalizar ── */}
                    <div className="flex items-center gap-3 w-full min-w-0">
                        {/* Back + Name */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleBack}
                                className="w-9 h-9 rounded-full hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-all flex-shrink-0"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </Button>

                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value)
                                        if (error) setError(null)
                                    }}
                                    placeholder="Nome do programa"
                                    className={`bg-transparent border-none text-lg font-bold text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:ring-0 p-0 w-full min-w-0 truncate transition-all cursor-text hover:border-b hover:border-dashed hover:border-[#AEAEB2] dark:hover:border-k-text-quaternary focus:border-b focus:border-solid focus:border-[#7C3AED] dark:focus:border-violet-500 ${nameShake ? 'animate-[shake_0.5s_ease-in-out]' : ''
                                        } ${error && !name.trim() ? 'placeholder:text-[#FF3B30]/60 dark:placeholder:text-red-400/60' : ''}`}
                                />
                                <button
                                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                                    className={`p-1 rounded-md transition-all shrink-0 ${isDescriptionOpen ? 'bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-violet-500/20 dark:text-violet-400' : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-tertiary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                        }`}
                                    title="Editar descrição"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Ações: secundária + primária + overflow ("⋯" com Salvar como modelo) */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {isStudentContext ? (
                                <>
                                    <Button
                                        onClick={() => saveProgram('scheduled')}
                                        disabled={saving}
                                        variant="outline"
                                        className="rounded-full px-3 sm:px-5 py-2 h-9 text-sm font-medium transition-all whitespace-nowrap"
                                    >
                                        Agendar na Fila
                                    </Button>
                                    <div data-onboarding="program-save">
                                        <Button
                                            onClick={() => {
                                                // Validate name first — before the archive-confirm modal, so we
                                                // never ask the trainer to confirm archiving the current program
                                                // for an activation that can't proceed.
                                                if (!name.trim()) {
                                                    setError('Por favor, preencha o nome do programa.')
                                                    setNameShake(true)
                                                    setTimeout(() => setNameShake(false), 600)
                                                    return
                                                }
                                                // Block activation if any workout has no scheduled days
                                                const missing = workoutsWithoutDays
                                                if (missing.length > 0) {
                                                    setActivationBlock({ workoutNames: missing.map(w => w.name) })
                                                    return
                                                }
                                                if (studentContext?.activeProgramName) {
                                                    setShowActivateConfirm(true)
                                                } else {
                                                    saveProgram('immediate')
                                                }
                                            }}
                                            disabled={saving}
                                            className="bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white rounded-full px-3 sm:px-5 py-2 h-9 text-sm font-medium transition-all whitespace-nowrap"
                                        >
                                            {saving ? (
                                                <Loader2 className="animate-spin w-4 h-4" />
                                            ) : (
                                                'Ativar como Atual'
                                            )}
                                        </Button>
                                    </div>
                                    <WorkoutCardKebab
                                        align="end"
                                        items={[{
                                            label: 'Salvar como modelo',
                                            icon: FileText,
                                            disabled: saving,
                                            onClick: () => {
                                                setTemplateName(name)
                                                setAlsoActivate(false)
                                                setShowTemplateDialog(true)
                                            },
                                        }]}
                                    />
                                </>
                            ) : (
                                <div data-onboarding="program-save">
                                    <Button
                                        onClick={() => saveProgram()}
                                        disabled={saving}
                                        className="bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white rounded-full px-5 py-2 h-9 text-sm font-medium transition-all min-w-[130px]"
                                    >
                                        {saving ? (
                                            <Loader2 className="animate-spin w-4 h-4" />
                                        ) : (
                                            'Salvar'
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Camada 2: barra de contexto (agenda + ferramentas), discreta ── */}
                    <div className="flex items-center gap-2 w-full min-w-0 border-t border-[#F0F0F2] dark:border-k-border-subtle/40 pt-2">
                        {/* Agenda / duração (somente contexto de aluno) */}
                        {isStudentContext && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-shrink overflow-hidden">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                                <span className="hidden sm:inline text-[10px] text-muted-foreground">Início</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => handleStartDateChange(e.target.value)}
                                    className="bg-transparent border-none text-xs font-medium text-k-text-secondary focus:ring-0 p-0 [color-scheme:dark] w-[96px] shrink-0"
                                />
                                <span className="text-k-border-subtle">→</span>
                                <span className="hidden sm:inline text-[10px] text-muted-foreground">Fim</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => handleEndDateChange(e.target.value)}
                                    className={`bg-transparent border-none text-xs font-medium focus:ring-0 p-0 [color-scheme:dark] w-[96px] shrink-0 transition-colors ${isEndDateFixed ? 'text-violet-400' : 'text-k-text-secondary'}`}
                                />
                                <span className="text-k-border-subtle">·</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <input
                                        type="number"
                                        value={durationWeeks}
                                        onChange={(e) => handleWeeksChange(e.target.value)}
                                        min="0"
                                        className="bg-transparent border-none text-xs font-bold text-violet-400 focus:ring-0 p-0 w-6 text-center"
                                    />
                                    <span className="text-muted-foreground">sem</span>
                                </div>
                            </div>
                        )}

                        {/* Ferramentas — IA · Check-in · Preview · Compare · Texto · Preferências */}
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                        {aiPanelAvailable && (
                            <>
                                <button
                                    onClick={() => setChatPanelOpen(true)}
                                    data-testid="ai-panel-toggle"
                                    className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition-colors duration-150 ${
                                        chatPanelOpen
                                            ? 'text-violet-600 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-500/[0.08]'
                                            : 'text-violet-600 dark:text-violet-400 hover:bg-violet-100/60 dark:hover:bg-violet-500/[0.08]'
                                    }`}
                                    title="Gerar programa com IA"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span className="hidden min-[1700px]:inline">Gerar com IA</span>
                                </button>
                                <span className="mx-1 h-5 w-px bg-k-border-subtle" aria-hidden />
                            </>
                        )}
                        {formTriggerTemplates.length > 0 && (
                            <button
                                onClick={() => setCheckinExpanded(!checkinExpanded)}
                                className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 ${
                                    checkinExpanded
                                        ? 'text-violet-600 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-500/[0.08]'
                                        : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                                }`}
                                title={formTriggerCount > 0 ? `Check-in: ${formTriggerCount} formulário${formTriggerCount > 1 ? 's' : ''} ativo${formTriggerCount > 1 ? 's' : ''}` : 'Configurar check-in'}
                                aria-expanded={checkinExpanded}
                            >
                                <ListChecks className="w-4 h-4" />
                                {formTriggerCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-2 ring-white dark:ring-surface-primary" />
                                )}
                            </button>
                        )}
                        <button
                            onClick={builderViewMode === 'preview' ? handleExitPreview : handleEnterPreview}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 ${
                                builderViewMode === 'preview'
                                    ? 'text-violet-600 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-500/[0.08]'
                                    : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                            }`}
                            title="Pré-visualizar no celular"
                        >
                            <Smartphone className="w-4 h-4" />
                        </button>
                        {studentContext && (
                            <button
                                onClick={builderViewMode === 'compare' ? handleExitCompare : handleEnterCompare}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 ${
                                    builderViewMode === 'compare'
                                        ? 'text-violet-600 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-500/[0.08]'
                                        : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                                }`}
                                title={builderViewMode === 'compare' ? 'Sair da comparação' : 'Comparar com programa anterior'}
                            >
                                <GitCompareArrows className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={builderViewMode === 'ai_prescribe' ? handleExitAiPrescribe : handleEnterAiPrescribe}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 ${
                                builderViewMode === 'ai_prescribe'
                                    ? 'text-violet-600 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-500/[0.08]'
                                    : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                            }`}
                            title="Texto para Treino"
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        {prescriptionPreferences && (
                            <>
                                <span className="mx-1 h-5 w-px bg-k-border-subtle" aria-hidden />
                                <button
                                    ref={preferencesGearButtonRef}
                                    onClick={openPreferencesDrawer}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-colors duration-150"
                                    title="Preferências de prescrição"
                                    aria-label="Abrir preferências de prescrição"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        </div>
                    </div>
                </div>

                {prescriptionPreferences && <PreferencesBanner />}

                {/* Header-based Description Area */}
                {isDescriptionOpen && (
                    <div className="flex-shrink-0 bg-white dark:bg-surface-primary border-b border-[#E8E8ED] dark:border-k-border-subtle px-8 py-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="max-w-3xl">
                            <label className="block text-xs font-semibold text-[#6E6E73] dark:text-k-text-tertiary mb-2">Descrição do programa</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Adicione detalhes sobre o objetivo, metodologia ou observações gerais..."
                                className="w-full bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-k-border-primary rounded-xl px-4 py-3 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:ring-1 focus:ring-[#7C3AED]/20 dark:focus:ring-violet-500/50 focus:border-[#7C3AED] dark:focus:border-violet-500/30 transition-all min-h-[80px] resize-none"
                            />
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="flex-shrink-0 mx-6 mt-3 bg-[#FF3B30]/10 dark:bg-red-500/10 border border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-red-400/60 hover:text-red-400 transition-colors text-xs font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* AI Agent Rationale Panel (collapsible).
                    Renders as a full-bleed header strip — no wrapper padding —
                    so it visually belongs to the page chrome instead of looking
                    like a floating island between the header and workspace. */}
                {prescriptionReasoning && (
                    <PrescriptionRationalePanel reasoning={prescriptionReasoning} />
                )}

                {/* Check-in expanded content panel */}
                {formTriggerTemplates.length > 0 && (
                    <ProgramFormTriggers
                        initialTriggers={initialFormTriggers ?? { preWorkout: null, postWorkout: null }}
                        availableTemplates={formTriggerTemplates}
                        onChange={setFormTriggers}
                        expanded={checkinExpanded}
                        onToggle={() => setCheckinExpanded(!checkinExpanded)}
                        renderContentOnly
                    />
                )}

                {/* Workspace (Layout Columns) */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: Exercise Library (collapsible) */}
                    <div
                        data-onboarding="program-exercise-library"
                        className={`bg-white dark:bg-surface-primary flex flex-col flex-shrink-0 transition-all duration-250 ease-in-out ${isLibraryCollapsed ? 'w-0 overflow-hidden' : 'w-[320px]'}`}
                    >
                        <ExerciseLibraryPanel
                            exercises={localExercises}
                            trainerId={trainer.id}
                            onAddExercise={addExerciseFromLibrary}
                            onExerciseCreated={handleExerciseCreated}
                            activeWorkoutId={activeWorkoutId}
                        />
                    </div>

                    {/* Library toggle handle (edge) */}
                    <button
                        onClick={toggleLibrary}
                        className="flex-shrink-0 w-5 flex items-center justify-center border-r border-[#E8E8ED] dark:border-k-border-subtle bg-[#FAFAFA] dark:bg-surface-primary hover:bg-[#F0F0F2] dark:hover:bg-glass-bg transition-colors group"
                        title={isLibraryCollapsed ? 'Expandir biblioteca' : 'Minimizar biblioteca'}
                    >
                        <ChevronLeft className={`w-3.5 h-3.5 text-[#AEAEB2] dark:text-k-text-quaternary group-hover:text-[#7C3AED] dark:group-hover:text-violet-400 transition-all duration-200 ${isLibraryCollapsed ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Right Panel: Canvas */}
                    <div className="flex-1 flex flex-col min-w-0 bg-surface-canvas">
                        {/* Compare header bar (full width, above the two columns) */}
                        {builderViewMode === 'compare' && (
                            <div className="flex items-center justify-between px-4 py-2 border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-surface-elevated flex-shrink-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <GitCompareArrows className="w-4 h-4 text-[#7C3AED] dark:text-violet-400 shrink-0" />
                                    <span className="text-xs font-medium text-[#6E6E73] dark:text-k-text-tertiary">Comparando com:</span>
                                    <span className="text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary truncate">
                                        {compareProgramData?.programName || 'Programa anterior'}
                                    </span>
                                    {compareProgramData?.startedAt && (
                                        <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary shrink-0">
                                            {new Date(compareProgramData.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    )}
                                    {compareProgramData?.status === 'active' && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 font-medium shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            Ativo
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <ProgramSelector
                                        programs={compareProgramsList}
                                        selectedId={compareSelectedProgramId}
                                        onSelect={handleSelectCompareProgram}
                                        isLoading={compareProgramsLoading}
                                    />
                                    <button
                                        onClick={handleExitCompare}
                                        className="p-1.5 rounded-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#E8E8ED] dark:hover:bg-glass-bg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Two-column layout when compare is active, single column otherwise */}
                        {builderViewMode === 'compare' ? (
                            <div className="flex flex-1 overflow-hidden">
                                {/* ══ LEFT COLUMN: Editable builder (50%) ══ */}
                                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                    {/* Volume */}
                                    <div data-onboarding="program-volume">
                                        <VolumeSummary workouts={workouts} />
                                    </div>
                                    {/* Tabs */}
                                    <div data-onboarding="program-workouts" className="flex items-center gap-1 p-4 overflow-x-auto no-scrollbar border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-surface-canvas">
                                        <DndContext id={tabDndId} sensors={tabSensors} collisionDetection={closestCenter} onDragEnd={handleWorkoutDragEnd}>
                                            <SortableContext items={workouts.map(w => w.id)} strategy={horizontalListSortingStrategy}>
                                                <div className="bg-white dark:bg-surface-card p-1 rounded-xl flex gap-1 items-center border border-[#E8E8ED] dark:border-k-border-subtle">
                                                    {workouts.map((workout) => (
                                                        <SortableWorkoutTab key={workout.id} id={workout.id}>
                                                            <button
                                                                onClick={() => setActiveWorkoutId(workout.id)}
                                                                className={`
                                                                    px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-2
                                                                    ${activeWorkoutId === workout.id
                                                                        ? 'bg-[#F5F5F7] dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm ring-1 ring-[#E8E8ED] dark:ring-k-border-subtle'
                                                                        : 'text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7]/50 dark:hover:bg-glass-bg'
                                                                    }
                                                                `}
                                                            >
                                                                {workout.name}
                                                                {(!workout.frequency || workout.frequency.length === 0) && (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Sem dia da semana selecionado" />
                                                                )}
                                                            </button>
                                                        </SortableWorkoutTab>
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                        <button
                                            onClick={addWorkout}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#7C3AED] dark:hover:text-k-text-primary hover:bg-[#7C3AED]/10 dark:hover:bg-glass-bg transition-all ml-2"
                                            title="Adicionar Treino"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                    </div>
                                    {/* Canvas (scrollable) */}
                                    <div
                                        ref={canvasScrollRef}
                                        onScroll={handleCanvasScroll}
                                        onDragOver={handleCanvasDragOver}
                                        onDragLeave={handleCanvasDragLeave}
                                        onDrop={handleCanvasDrop}
                                        className={`flex-1 overflow-y-auto px-6 pt-3 pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent transition-colors duration-200 ${isDraggingOver ? 'bg-[#7C3AED]/5 dark:bg-violet-500/5 ring-2 ring-inset ring-[#7C3AED]/20 dark:ring-violet-500/20' : ''}`}
                                    >
                                        <div className="pb-20">
                                            {activeWorkout ? (
                                                <WorkoutPanel
                                                    workout={activeWorkout}
                                                    exercises={localExercises}
                                                    onUpdateName={(name) => updateWorkoutName(activeWorkout.id, name)}
                                                    onAddExercise={() => { }}
                                                    onAddNote={() => addNote(activeWorkout.id)}
                                                    onAddWarmup={() => addWarmup(activeWorkout.id)}
                                                    onAddCardio={() => addCardio(activeWorkout.id)}
                                                    onSearchAddExercise={addExerciseFromLibrary}
                                                    onUpdateItem={(itemId, updates) => updateItem(activeWorkout.id, itemId, updates)}
                                                    onDeleteItem={(itemId) => deleteItem(activeWorkout.id, itemId)}
                                                    onDuplicateItem={(itemId) => duplicateItem(activeWorkout.id, itemId)}
                                                    onMoveItem={(itemId, dir) => moveItem(activeWorkout.id, itemId, dir)}
                                                    onReorderItem={handleReorderItem}
                                                    onCreateSupersetWithNext={(itemId) => createSupersetWithNext(activeWorkout.id, itemId)}
                                                    onAddToExistingSuperset={(itemId, supersetId) => addToExistingSuperset(activeWorkout.id, itemId, supersetId)}
                                                    onRemoveFromSuperset={(supersetId, itemId) => removeFromSuperset(activeWorkout.id, supersetId, itemId)}
                                                    onDissolveSuperset={(supersetId) => dissolveSuperset(activeWorkout.id, supersetId)}
                                                    onUpdateFrequency={(days) => updateWorkoutFrequency(activeWorkout.id, days)}
                                                    occupiedDays={occupiedDays}
                                                    isScrolled={isCanvasScrolled}
                                                    scrollContainerRef={canvasScrollRef}
                                                />
                                            ) : (
                                                <div className="text-center py-20">
                                                    <p className="text-k-text-quaternary text-sm">Selecione ou crie um treino para começar</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Vertical divider */}
                                <div className="w-px bg-[#E8E8ED] dark:bg-k-border-subtle flex-shrink-0" />

                                {/* ══ RIGHT COLUMN: Compare read-only (50%) ══ */}
                                <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FAFAFA] dark:bg-surface-canvas/50">
                                    {/* Volume */}
                                    {compareWorkouts.length > 0 && (
                                        <VolumeSummary workouts={compareWorkouts} />
                                    )}
                                    {/* Tabs */}
                                    {compareWorkouts.length > 0 && (
                                        <div className="flex items-center gap-1 p-4 overflow-x-auto no-scrollbar border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7]/50 dark:bg-surface-canvas">
                                            <div className="bg-white dark:bg-surface-card p-0.5 rounded-lg flex gap-0.5 items-center border border-[#E8E8ED] dark:border-k-border-subtle">
                                                {compareWorkouts.map((cw) => (
                                                    <button
                                                        key={cw.id}
                                                        onClick={() => setCompareActiveWorkoutId(cw.id)}
                                                        className={`
                                                            px-3 py-1 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap
                                                            ${compareActiveWorkoutId === cw.id
                                                                ? 'bg-[#F5F5F7] dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm ring-1 ring-[#E8E8ED] dark:ring-k-border-subtle'
                                                                : 'text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7]/50 dark:hover:bg-glass-bg'
                                                            }
                                                        `}
                                                    >
                                                        {cw.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Canvas (scrollable, read-only) */}
                                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                        {compareProgramLoading ? (
                                            <div className="flex items-center justify-center py-20">
                                                <Loader2 className="w-5 h-5 animate-spin text-[#AEAEB2] dark:text-k-text-quaternary" />
                                            </div>
                                        ) : compareActiveWorkout ? (
                                            <div className="pb-20">
                                                <WorkoutPanel
                                                    workout={compareActiveWorkout}
                                                    exercises={localExercises}
                                                    onUpdateName={() => {}}
                                                    onAddExercise={() => {}}
                                                    onAddNote={() => {}}
                                                    onAddWarmup={() => {}}
                                                    onAddCardio={() => {}}
                                                    onUpdateItem={() => {}}
                                                    onDeleteItem={() => {}}
                                                    onDuplicateItem={() => {}}
                                                    onMoveItem={() => {}}
                                                    onReorderItem={() => {}}
                                                    onCreateSupersetWithNext={() => {}}
                                                    onAddToExistingSuperset={() => {}}
                                                    onRemoveFromSuperset={() => {}}
                                                    onDissolveSuperset={() => {}}
                                                    readonly
                                                />
                                            </div>
                                        ) : !compareSelectedProgramId ? (
                                            <div className="text-center py-20">
                                                <GitCompareArrows className="w-8 h-8 text-[#AEAEB2] dark:text-k-text-quaternary mx-auto mb-3 opacity-50" />
                                                <p className="text-[#AEAEB2] dark:text-k-text-quaternary text-sm">Selecione um programa para comparar</p>
                                                <p className="text-[#AEAEB2] dark:text-k-text-quaternary text-[11px] mt-1 opacity-70">Visualize lado a lado com o programa atual</p>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ══ NORMAL MODE: Single column with optional preview panel ══ */
                            <>
                                {/* Workout Tabs + Volume Summary (combined, wraps on overflow) */}
                                <div data-onboarding="program-workouts" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-surface-canvas">
                                    <DndContext id={tabDndId} sensors={tabSensors} collisionDetection={closestCenter} onDragEnd={handleWorkoutDragEnd}>
                                        <SortableContext items={workouts.map(w => w.id)} strategy={horizontalListSortingStrategy}>
                                            <div className="bg-white dark:bg-surface-card p-1 rounded-xl flex gap-1 items-center border border-[#E8E8ED] dark:border-k-border-subtle">
                                                {workouts.map((workout) => (
                                                    <SortableWorkoutTab key={workout.id} id={workout.id}>
                                                        <button
                                                            onClick={() => setActiveWorkoutId(workout.id)}
                                                            className={`
                                                                px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-2
                                                                ${activeWorkoutId === workout.id
                                                                    ? 'bg-[#F5F5F7] dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm ring-1 ring-[#E8E8ED] dark:ring-k-border-subtle'
                                                                    : 'text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7]/50 dark:hover:bg-glass-bg'
                                                                }
                                                            `}
                                                        >
                                                            {workout.name}
                                                            {(!workout.frequency || workout.frequency.length === 0) && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Sem dia da semana selecionado" />
                                                            )}
                                                            {activeWorkoutId === workout.id && (
                                                                <span className="flex items-center gap-1 ml-1 border-l border-[#E8E8ED] dark:border-k-border-subtle pl-2">
                                                                    <span
                                                                        onClick={(e) => { e.stopPropagation(); duplicateWorkout(workout.id) }}
                                                                        className="p-1 rounded-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#7C3AED] dark:hover:text-violet-400 hover:bg-[#7C3AED]/10 dark:hover:bg-violet-500/15 transition-colors cursor-pointer"
                                                                        title="Duplicar treino"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                        </svg>
                                                                    </span>
                                                                    {workouts.length > 1 && (
                                                                        <span
                                                                            onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id) }}
                                                                            className="p-1 rounded-md text-[#FF3B30] dark:text-red-400 bg-[#FF3B30]/10 dark:bg-red-500/15 hover:text-white hover:bg-[#FF3B30] dark:hover:bg-red-500 transition-colors cursor-pointer"
                                                                            title="Excluir treino"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </SortableWorkoutTab>
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>

                                    <button
                                        onClick={addWorkout}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#7C3AED] dark:hover:text-k-text-primary hover:bg-[#7C3AED]/10 dark:hover:bg-glass-bg transition-all ml-1 shrink-0"
                                        title="Adicionar Treino"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>

                                    {/* Inline Volume Summary */}
                                    <div className="ml-auto shrink-0" data-onboarding="program-volume">
                                        <VolumeSummary workouts={workouts} />
                                    </div>
                                </div>

                                {/* Canvas + inline Preview */}
                                <div className="flex flex-1 overflow-hidden">
                                    <div
                                        ref={canvasScrollRef}
                                        onScroll={handleCanvasScroll}
                                        onDragOver={handleCanvasDragOver}
                                        onDragLeave={handleCanvasDragLeave}
                                        onDrop={handleCanvasDrop}
                                        className={`flex-1 overflow-y-auto px-6 pt-3 pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent transition-colors duration-200 ${isDraggingOver ? 'bg-[#7C3AED]/5 dark:bg-violet-500/5 ring-2 ring-inset ring-[#7C3AED]/20 dark:ring-violet-500/20' : ''}`}
                                    >
                                        <div className={`mx-auto pb-20 transition-[max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                                            (builderViewMode === 'preview' || builderViewMode === 'ai_prescribe') ? 'max-w-6xl flex gap-8' : 'max-w-3xl'
                                        }`}>
                                            <div className={(builderViewMode === 'preview' || builderViewMode === 'ai_prescribe') ? 'flex-1 min-w-0' : ''}>
                                                {activeWorkout ? (
                                                    <WorkoutPanel
                                                        workout={activeWorkout}
                                                        exercises={localExercises}
                                                        onUpdateName={(name) => updateWorkoutName(activeWorkout.id, name)}
                                                        onAddExercise={() => { }}
                                                        onAddNote={() => addNote(activeWorkout.id)}
                                                        onAddWarmup={() => addWarmup(activeWorkout.id)}
                                                        onAddCardio={() => addCardio(activeWorkout.id)}
                                                        onSearchAddExercise={addExerciseFromLibrary}
                                                        onUpdateItem={(itemId, updates) => updateItem(activeWorkout.id, itemId, updates)}
                                                        onDeleteItem={(itemId) => deleteItem(activeWorkout.id, itemId)}
                                                        onDuplicateItem={(itemId) => duplicateItem(activeWorkout.id, itemId)}
                                                        onMoveItem={(itemId, dir) => moveItem(activeWorkout.id, itemId, dir)}
                                                        onReorderItem={handleReorderItem}
                                                        onCreateSupersetWithNext={(itemId) => createSupersetWithNext(activeWorkout.id, itemId)}
                                                        onAddToExistingSuperset={(itemId, supersetId) => addToExistingSuperset(activeWorkout.id, itemId, supersetId)}
                                                        onRemoveFromSuperset={(supersetId, itemId) => removeFromSuperset(activeWorkout.id, supersetId, itemId)}
                                                        onDissolveSuperset={(supersetId) => dissolveSuperset(activeWorkout.id, supersetId)}
                                                        onUpdateFrequency={(days) => updateWorkoutFrequency(activeWorkout.id, days)}
                                                        occupiedDays={occupiedDays}
                                                        isScrolled={isCanvasScrolled}
                                                        scrollContainerRef={canvasScrollRef}
                                                    />
                                                ) : (
                                                    <div className="text-center py-20">
                                                        <p className="text-k-text-quaternary text-sm">Selecione ou crie um treino para começar</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mobile Preview — sticky, dynamically scaled to fit viewport */}
                                            {builderViewMode === 'preview' && (
                                                <div className="flex-shrink-0 sticky top-0 self-start">
                                                    <WorkoutExecutionPreview
                                                        workoutName={activeWorkout?.name || 'Treino'}
                                                        items={activeWorkout?.items || []}
                                                        scale={previewScale}
                                                    />
                                                </div>
                                            )}

                                            {/* AI Prescribe Panel — sticky, same layout slot as preview */}
                                            {builderViewMode === 'ai_prescribe' && (
                                                <AiPrescribePanel
                                                    onClose={handleExitAiPrescribe}
                                                    exercises={localExercises}
                                                    workouts={workouts}
                                                    activeWorkoutId={activeWorkoutId}
                                                    onAddExerciseToWorkout={addExerciseToWorkout}
                                                    onCreateWorkout={createWorkoutWithName}
                                                    onCleanupEmptyPlaceholders={cleanupEmptyPlaceholders}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Frequency warning modal */}
            {frequencyWarning && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setFrequencyWarning(null)} />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-[#FF9500]/10 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <AlertCircle className="w-6 h-6 text-[#FF9500] dark:text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-white text-center mb-2">Treino sem dia agendado</h3>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary text-center mb-1">
                            {frequencyWarning.workoutNames.length === 1
                                ? `O treino "${frequencyWarning.workoutNames[0]}" não tem dia da semana selecionado.`
                                : `Os treinos ${frequencyWarning.workoutNames.map(n => `"${n}"`).join(' e ')} não têm dia da semana selecionado.`
                            }
                        </p>
                        {isStudentContext && (
                            <p className="text-xs text-[#FF9500] dark:text-amber-400/80 text-center mb-4">
                                O aluno não verá {frequencyWarning.workoutNames.length === 1 ? 'esse treino' : 'esses treinos'} no calendário.
                            </p>
                        )}
                        {!isStudentContext && <div className="mb-4" />}
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary text-center mb-6">
                            Alunos que receberem este programa não verão {frequencyWarning.workoutNames.length === 1 ? 'esse treino' : 'esses treinos'} no calendário.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setFrequencyWarning(null)
                                    const firstMissing = workouts.find(w => !w.frequency || w.frequency.length === 0)
                                    if (firstMissing) setActiveWorkoutId(firstMissing.id)
                                }}
                                className="flex-1 py-3 bg-[#FF9500]/10 hover:bg-[#FF9500]/20 text-[#FF9500] dark:text-amber-400 text-xs font-bold rounded-full transition-colors border border-[#FF9500]/20 dark:border-amber-500/20"
                            >
                                Corrigir agora
                            </button>
                            <button
                                onClick={frequencyWarning.onConfirm}
                                className="flex-1 py-3 bg-[#F5F5F7] dark:bg-glass-bg hover:bg-[#ECECF0] dark:hover:bg-glass-bg-active text-[#6E6E73] dark:text-k-text-secondary text-xs font-bold rounded-full transition-colors border border-[#D2D2D7] dark:border-k-border-subtle"
                            >
                                Salvar assim mesmo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit confirmation — unsaved changes when leaving via back */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowExitConfirm(false)} />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-[#FF9500]/10 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <AlertCircle className="w-6 h-6 text-[#FF9500] dark:text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-white text-center mb-2">Sair sem salvar?</h3>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary text-center mb-6">
                            Você tem alterações não salvas neste treino. Salve como rascunho para continuar depois{isStudentContext ? ' no card "Próximos Programas" do aluno' : ''}, ou descarte as alterações.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setShowExitConfirm(false)
                                    saveDraftAndLeave()
                                }}
                                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-full transition-colors"
                            >
                                Salvar como rascunho
                            </button>
                            <button
                                onClick={() => {
                                    setShowExitConfirm(false)
                                    discardAndLeave()
                                }}
                                className="w-full py-3 bg-transparent hover:bg-[#FF3B30]/10 text-[#FF3B30] dark:text-red-400 text-xs font-bold rounded-full transition-colors border border-[#FF3B30]/20 dark:border-red-500/20"
                            >
                                Descartar alterações
                            </button>
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="w-full py-3 bg-transparent hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active text-[#6E6E73] dark:text-k-text-tertiary text-xs font-bold rounded-full transition-colors"
                            >
                                Continuar editando
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty-workout warning modal — workout(s) without prescribed exercises */}
            {emptyWorkoutWarning && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setEmptyWorkoutWarning(null)} />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-[#FF9500]/10 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <AlertCircle className="w-6 h-6 text-[#FF9500] dark:text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-white text-center mb-2">
                            {emptyWorkoutWarning.workoutNames.length === 1 ? 'Treino sem exercícios' : 'Treinos sem exercícios'}
                        </h3>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary text-center mb-1">
                            {emptyWorkoutWarning.workoutNames.length === 1
                                ? `O treino "${emptyWorkoutWarning.workoutNames[0]}" não tem nenhum exercício prescrito.`
                                : `Os treinos ${emptyWorkoutWarning.workoutNames.map(n => `"${n}"`).join(' e ')} não têm nenhum exercício prescrito.`
                            }
                        </p>
                        <p className="text-xs text-[#FF9500] dark:text-amber-400/80 text-center mb-6">
                            O aluno verá {emptyWorkoutWarning.workoutNames.length === 1 ? 'esse treino vazio' : 'esses treinos vazios'} no dia agendado.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setEmptyWorkoutWarning(null)
                                    const firstEmpty = workouts.find(w => !w.items?.some(i => i.item_type === 'exercise' || i.item_type === 'superset' || i.item_type === 'cardio'))
                                    if (firstEmpty) setActiveWorkoutId(firstEmpty.id)
                                }}
                                className="flex-1 py-3 bg-[#FF9500]/10 hover:bg-[#FF9500]/20 text-[#FF9500] dark:text-amber-400 text-xs font-bold rounded-full transition-colors border border-[#FF9500]/20 dark:border-amber-500/20"
                            >
                                Adicionar exercícios
                            </button>
                            <button
                                onClick={emptyWorkoutWarning.onConfirm}
                                className="flex-1 py-3 bg-[#F5F5F7] dark:bg-glass-bg hover:bg-[#ECECF0] dark:hover:bg-glass-bg-active text-[#6E6E73] dark:text-k-text-secondary text-xs font-bold rounded-full transition-colors border border-[#D2D2D7] dark:border-k-border-subtle"
                            >
                                Continuar assim mesmo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Activation blocked — workouts without scheduled days */}
            {activationBlock && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setActivationBlock(null)} />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-[#FF9500]/10 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <AlertCircle className="w-6 h-6 text-[#FF9500] dark:text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-white text-center mb-2">Treinos sem dia agendado</h3>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary text-center mb-1">
                            {activationBlock.workoutNames.length === 1
                                ? `O treino "${activationBlock.workoutNames[0]}" não possui dias da semana atribuídos.`
                                : `Os seguintes treinos não possuem dias da semana atribuídos: ${activationBlock.workoutNames.map(n => `"${n}"`).join(', ')}.`
                            }
                        </p>
                        <p className="text-xs text-[#FF9500] dark:text-amber-400/80 text-center mb-6">
                            Atribua pelo menos um dia a cada treino antes de ativar o programa.
                        </p>
                        <button
                            onClick={() => {
                                setActivationBlock(null)
                                const firstMissing = workouts.find(w => !w.frequency || w.frequency.length === 0)
                                if (firstMissing) setActiveWorkoutId(firstMissing.id)
                            }}
                            className="w-full py-3 bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white text-sm font-bold rounded-full transition-colors"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}

            {/* Tour: Program Builder (auto-start só na criação do zero). Ao revisar um
                rascunho gerado pela IA (?generationId=) NÃO inicia o tour — não é um
                momento de "primeira vez aprendendo o builder", e a hidratação do store
                de onboarding nessa rota não é confiável (skipHydration), fazendo o tour
                reaparecer mesmo já concluído. */}
            <TourRunner tourId="program_builder" steps={TOUR_STEPS.program_builder} autoStart={!prescriptionGenerationId} />

            {/* AI Prescription Panel (Fase 1) */}
            {aiPanelAvailable && studentContext && prescriptionData && (
                <AiPrescriptionPanel
                    open={aiPanelOpen}
                    studentId={studentContext.id}
                    studentName={studentContext.name}
                    prescriptionData={prescriptionData}
                    initialPageState={prescriptionGenerationId ? 'done' : undefined}
                    initialGenerationId={prescriptionGenerationId}
                    onClose={closeAiPanel}
                    onAcceptGeneratedProgram={handleAcceptGeneratedProgram}
                />
            )}

            {/* Painel de chat "Gerar com IA" ao vivo — monta no canvas pela ponte */}
            {aiPanelAvailable && studentContext && (
                <AiCanvasChatPanel
                    open={chatPanelOpen}
                    studentId={studentContext.id}
                    studentName={studentContext.name}
                    exercises={localExercises}
                    currentName={name}
                    currentDurationWeeks={durationWeeks ? parseInt(durationWeeks) : null}
                    onApplyMeta={(meta) => {
                        if (meta.name != null) setName(meta.name)
                        if (meta.durationWeeks != null) setDurationWeeks(String(meta.durationWeeks))
                    }}
                    onUseForm={() => { setChatPanelOpen(false); setAiPanelOpen(true) }}
                    onClose={() => setChatPanelOpen(false)}
                />
            )}

            {/* Confirmation dialog — activate as current program */}
            {showActivateConfirm && (
                <div className="fixed inset-0 z-modal flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowActivateConfirm(false)} />
                    <div className="relative bg-white dark:bg-surface-primary border border-[#D2D2D7] dark:border-k-border-subtle rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-k-text-primary mb-2">Ativar programa?</h3>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary leading-relaxed">
                            O programa atual do aluno{studentContext?.activeProgramName && (
                                <> (&quot;<span className="text-k-text-secondary">{studentContext.activeProgramName}</span>&quot;)</>
                            )} será concluído e arquivado no histórico.
                        </p>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary leading-relaxed mt-2">
                            O novo programa passará a ser exibido para o aluno imediatamente.
                        </p>
                        <div className="flex items-center justify-end gap-3 mt-6">
                            <Button
                                onClick={() => setShowActivateConfirm(false)}
                                variant="ghost"
                                className="rounded-full px-5 py-2 h-9 text-sm font-medium text-[#7C3AED] dark:text-k-text-secondary hover:text-[#6D28D9] dark:hover:text-k-text-primary bg-transparent dark:bg-white/[0.06] hover:bg-[#F5F5F7] dark:hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => { setShowActivateConfirm(false); saveProgram('immediate') }}
                                disabled={saving}
                                className="bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white rounded-full px-5 py-2 h-9 text-sm font-medium transition-all"
                            >
                                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar Ativação'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialog — save as template */}
            {showTemplateDialog && (
                <div className="fixed inset-0 z-modal flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowTemplateDialog(false)} />
                    <div className="relative bg-white dark:bg-surface-primary border border-[#D2D2D7] dark:border-k-border-subtle rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-k-text-primary mb-1">Salvar como Modelo</h3>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-tertiary leading-relaxed mb-5">
                            O programa será salvo na biblioteca de modelos para reutilizar com outros alunos.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[#6E6E73] dark:text-k-text-quaternary mb-1.5 uppercase tracking-wide">Nome do modelo</label>
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Ex: Hipertrofia 5x - Superior/Inferior"
                                    className="w-full bg-white dark:bg-white/[0.04] border border-[#D2D2D7] dark:border-k-border-subtle rounded-lg px-3 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary outline-none focus:border-[#7C3AED] dark:focus:border-violet-500/50 focus:ring-1 focus:ring-[#7C3AED]/20 dark:focus:ring-0 transition-colors"
                                    autoFocus
                                />
                            </div>

                            {isStudentContext && (
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={alsoActivate}
                                        onChange={(e) => setAlsoActivate(e.target.checked)}
                                        className="w-4 h-4 rounded border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-white/[0.04] text-[#7C3AED] dark:text-violet-600 focus:ring-[#7C3AED]/30 dark:focus:ring-violet-500/30 focus:ring-offset-0 cursor-pointer"
                                    />
                                    <span className="text-sm text-[#6E6E73] dark:text-k-text-tertiary group-hover:text-[#1D1D1F] dark:group-hover:text-k-text-secondary transition-colors">
                                        Também ativar como programa atual do aluno
                                    </span>
                                </label>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-6">
                            <Button
                                onClick={() => setShowTemplateDialog(false)}
                                variant="ghost"
                                className="rounded-full px-5 py-2 h-9 text-sm font-medium text-[#7C3AED] dark:text-k-text-secondary hover:text-[#6D28D9] dark:hover:text-k-text-primary bg-transparent dark:bg-white/[0.06] hover:bg-[#F5F5F7] dark:hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => saveAsTemplate()}
                                disabled={!templateName.trim() || savingTemplate}
                                className="bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white rounded-full px-5 py-2 h-9 text-sm font-medium transition-all"
                            >
                                {savingTemplate ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar Modelo'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {prescriptionPreferences && (
                <>
                    <PreferencesDrawer triggerRef={preferencesGearButtonRef} />
                    <PreferencesWizard />
                </>
            )}
        </AppLayout>
    )
}
