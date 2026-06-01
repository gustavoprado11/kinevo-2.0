'use client'

import { useState, useCallback, useId, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { WorkoutPanel } from './workout-panel'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableWorkoutTab } from './sortable-workout-tab'
import { ExerciseLibraryPanel } from './exercise-library-panel'
import { VolumeSummary } from './volume-summary'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Loader2, Calendar, AlertCircle, Smartphone, GitCompareArrows, X, ListChecks, FileText, Sparkles, Settings } from 'lucide-react'
import { KINEVO_DEFAULT_PREFERENCES, type PrescriptionPreferences } from '@/types/prescription-preferences'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import { PreferencesBanner } from './preferences/preferences-banner'
import { PreferencesDrawer } from './preferences/preferences-drawer'
import { PreferencesWizard } from './preferences/preferences-wizard'
import { track } from '@/lib/analytics'

import dynamic from 'next/dynamic'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { useOnboardingStore } from '@/stores/onboarding-store'
import type { Exercise } from '@/types/exercise'
import { assignProgram } from '@/app/students/[id]/actions/assign-program'
import { ProgramFormTriggers, type TriggerSelection, type InitialTrigger } from './program-form-triggers'
import { saveProgramFormTriggers } from '@/actions/programs/save-program-form-triggers'
import type { FormTemplateOption } from '@/actions/programs/get-form-templates-for-triggers'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'
import { usePrescriptionGenerationStream } from '@/hooks/use-prescription-generation-stream'
import { consumePrescriptionAnimateFlag, setPrescriptionAnimateFlag } from './helpers/prescription-animate-flag'
import { getPastProgramsForStudent, getFullProgramForCompare } from '@/actions/programs/get-program-for-compare'

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
const ProgramSelector = dynamic(
    () => import('@/components/builder/context-panel/program-selector').then(m => ({ default: m.ProgramSelector })),
    { ssr: false }
)
import type { CompareProgramSummary, CompareProgramData } from '@/actions/programs/get-program-for-compare'
import { compareWorkoutToWorkout } from '@/lib/workouts/transformPastWorkout'

export type BuilderViewMode = 'normal' | 'preview' | 'compare' | 'ai_prescribe'

export interface WorkoutItem {
    id: string
    item_type: 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio'
    order_index: number
    parent_item_id: string | null
    exercise_id: string | null
    substitute_exercise_ids: string[]
    exercise?: Exercise
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    exercise_function?: string | null
    item_config?: Record<string, any>
    children?: WorkoutItem[]
    /** Per-set prescription (Fase 2). When set, takes precedence over the
     * aggregates and the saved aggregates are derived via summarizeSetScheme.
     * For compound methods (drop-set, cluster) this is the per-round shape
     * collapsed from the materialized DB rows; the save flow expands it back
     * `rounds` times via `expandSchemeByRounds`. */
    set_scheme?: import('@kinevo/shared/types/prescription').WorkoutSet[] | null
    /** Method/preset marker for the chip in the UI. */
    method_key?: import('@kinevo/shared/types/prescription').MethodKey | null
    /** Rodadas (Fase 4.4). 1 para métodos lineares (default). 2..20 para
     *  compostos. Quando > 1, `set_scheme` descreve UMA rodada e é
     *  materializado N vezes no save. */
    rounds?: number | null
}

export interface Workout {
    id: string
    name: string
    order_index: number
    items: WorkoutItem[]
    frequency?: string[] // ['mon', 'tue', etc]
}

interface ProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workout_templates?: Array<{
        id: string
        name: string
        order_index: number
        frequency?: string[]
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
            item_config?: Record<string, any>
            method_key?: string | null
            rounds?: number | null
            workout_item_set_templates?: Array<import('@kinevo/shared/types/prescription').WorkoutSet> | null
        }>
    }>
}

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

// Generate temp ID for new items
const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/** Converte uma pref de séries (ex: "3", "3-4") em count inteiro. Faixa pega
 *  o limite inferior. Fallback 3 se inválido. Usado pelo seed de set_scheme
 *  quando a pref `add_exercise.open_mode === 'set_editor'`. */
function parseSetsCount(setsPref: string): number {
    const match = setsPref.trim().match(/^(\d+)/)
    const n = match ? parseInt(match[1], 10) : 3
    return Number.isFinite(n) && n > 0 ? n : 3
}

/** Gera o nome de um workout novo respeitando a convenção do treinador.
 *  - 'letter': "Treino A", "Treino B", ... (até Z; depois reinicia em A1, B1 — improvável v1)
 *  - 'free':   "Treino 1", "Treino 2", ... (numérico simples) */
function generateWorkoutName(index: number, convention: 'letter' | 'free'): string {
    if (convention === 'free') return `Treino ${index + 1}`
    return `Treino ${String.fromCharCode(65 + index)}`
}

// ── Per-set helpers (Fase 2 / 4.4) ──
import {
    collapseExpandedScheme,
    expandSchemeByRounds,
    summarizeSetScheme as _summarizeSetScheme,
    summarizeWithRounds as _summarizeWithRounds,
} from '@kinevo/shared/lib/prescription/set-scheme'
import { isCompoundMethod } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import type { WorkoutSet } from '@kinevo/shared/types/prescription'

/** Hydrate the materialized rows from the DB into the per-round shape the
 *  editor expects. Returns `{ scheme, rounds }`:
 *  - linear methods → returns the rows unchanged with rounds=1
 *  - compound methods → collapses N×M rows into M (one round) and rounds=N
 *  - empty / null → returns `{ scheme: null, rounds: 1 }` */
function hydrateSetScheme(
    rows: WorkoutSet[] | null | undefined,
    roundsHint: number | null | undefined,
): { scheme: WorkoutSet[] | null; rounds: number } {
    if (!rows || rows.length === 0) return { scheme: null, rounds: 1 }
    const sorted = [...rows].sort((a, b) => a.set_number - b.set_number)
    const collapsed = collapseExpandedScheme(sorted, roundsHint ?? 1)
    return {
        scheme: collapsed.scheme.length > 0 ? collapsed.scheme : null,
        rounds: collapsed.rounds,
    }
}

/** Effective rounds for an item. Compound methods honor `item.rounds`; linear
 *  methods are forced to 1 even if the trainer accidentally typed something
 *  else somewhere — defesa em profundidade matching the mobile save flow. */
function effectiveRoundsForItem(item: WorkoutItem): number {
    if (!item.set_scheme || item.set_scheme.length === 0) return 1
    if (!isCompoundMethod(item.method_key ?? null)) return 1
    const r = Number.isFinite(item.rounds as number) ? Math.floor(item.rounds as number) : 1
    return Math.max(1, Math.min(20, r))
}

/** Persist the materialized children rows for a saved workout_item_template.
 *  Linear methods write the scheme as-is; compound methods expand by `rounds`
 *  via `expandSchemeByRounds` and tag each row with its `round_number`. */
async function insertSetSchemeRows(
    supabase: ReturnType<typeof createClient>,
    workoutItemTemplateId: string,
    scheme: WorkoutSet[] | null | undefined,
    rounds: number,
): Promise<void> {
    if (!scheme || scheme.length === 0) return
    const safeRounds = Math.max(1, Math.min(20, Math.floor(rounds || 1)))
    const expanded = safeRounds > 1
        ? expandSchemeByRounds(scheme, safeRounds)
        : scheme
    const isCompound = safeRounds > 1
    const rows = expanded.map((s, i) => ({
        workout_item_template_id: workoutItemTemplateId,
        set_number: i + 1,
        set_type: s.set_type,
        reps: s.reps,
        rest_seconds: s.rest_seconds,
        weight_target_kg: s.weight_target_kg,
        weight_target_pct1rm: s.weight_target_pct1rm,
        rir: s.rir,
        tempo: s.tempo,
        notes: s.notes,
        round_number: isCompound ? (s.round_number ?? null) : null,
    }))
    const { error } = await supabase.from('workout_item_set_templates').insert(rows)
    if (error) throw error
}

/** Coerce the parent aggregates so they always mirror the canonical summary
 *  for the item's effective rounds. Linear / no-scheme paths keep the legacy
 *  behaviour byte-for-byte. */
function aggregatesFromItem(item: WorkoutItem): {
    sets: number | null
    reps: string | null
    rest_seconds: number | null
} {
    if (item.set_scheme && item.set_scheme.length > 0) {
        const rounds = effectiveRoundsForItem(item)
        const summary = rounds > 1
            ? _summarizeWithRounds(item.set_scheme, rounds)
            : _summarizeSetScheme(item.set_scheme)
        return {
            sets: summary.sets,
            reps: summary.reps,
            rest_seconds: summary.rest_seconds,
        }
    }
    return { sets: item.sets, reps: item.reps, rest_seconds: item.rest_seconds }
}

/** Effective method_key honouring the "supersets bloqueados em V1" rule:
 * children with parent_item_id !== null never persist a scheme. */
function effectiveMethodKey(item: WorkoutItem): string | null {
    if (item.parent_item_id) return null
    return item.method_key ?? null
}

export function ProgramBuilderClient({ trainer, program, exercises, studentContext, initialAssignmentType = 'immediate', prescriptionGenerationId, prescriptionReasoning, formTriggerTemplates = [], initialFormTriggers, prescriptionData, prescriptionPreferences }: ProgramBuilderClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tabDndId = useId()
    const isEditing = !!program && !!program.id && !program.id.startsWith('temp_')
    const isStudentContext = !!studentContext

    // Local exercises state to support inline creation
    const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises)

    // Program state
    const [name, setName] = useState(program?.name || '')
    const [description, setDescription] = useState(program?.description || '')
    const [durationWeeks, setDurationWeeks] = useState(
        program?.duration_weeks?.toString()
        ?? prescriptionPreferences?.program_structure.default_weeks?.toString()
        ?? '4',
    )
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [isEndDateFixed, setIsEndDateFixed] = useState(false)
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

    // Compare mode state
    const [compareProgramsList, setCompareProgramsList] = useState<CompareProgramSummary[]>([])
    const [compareProgramsLoading, setCompareProgramsLoading] = useState(false)
    const [compareProgramsLoaded, setCompareProgramsLoaded] = useState(false)
    const [compareSelectedProgramId, setCompareSelectedProgramId] = useState<string | null>(null)
    const [compareProgramData, setCompareProgramData] = useState<CompareProgramData | null>(null)
    const [compareProgramLoading, setCompareProgramLoading] = useState(false)
    const [compareWorkouts, setCompareWorkouts] = useState<Workout[]>([])
    const [compareActiveWorkoutId, setCompareActiveWorkoutId] = useState<string | null>(null)

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

    // Helper to calculate end date from weeks
    const calculateEndDate = useCallback((start: string, weeksStr: string) => {
        const startObj = new Date(start)
        const weeks = parseInt(weeksStr) || 0
        if (isNaN(startObj.getTime())) return ''
        const endObj = new Date(startObj)
        endObj.setDate(endObj.getDate() + (weeks * 7) - 1)
        return endObj.toISOString().split('T')[0]
    }, [])

    // Helper to calculate weeks from end date
    const calculateWeeks = useCallback((start: string, end: string) => {
        const startObj = new Date(start)
        const endObj = new Date(end)
        if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return '0'
        const diffTime = endObj.getTime() - startObj.getTime()
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)
        return Math.round(diffDays / 7).toString()
    }, [])

    const [endDate, setEndDate] = useState(() =>
        calculateEndDate(new Date().toISOString().split('T')[0], program?.duration_weeks?.toString() || '4')
    )

    // Handlers for bidirectional sync
    const handleWeeksChange = (weeks: string) => {
        const weeksNum = Math.max(0, parseInt(weeks) || 0)
        const weeksStr = weeksNum.toString()

        setDurationWeeks(weeksStr)
        const newEnd = calculateEndDate(startDate, weeksStr)
        setEndDate(newEnd)
    }

    const handleEndDateChange = (end: string) => {
        // Prevent end date being before start date
        if (new Date(end) < new Date(startDate)) {
            // Reset to start date + 0 weeks
            const resetEnd = calculateEndDate(startDate, '0')
            setEndDate(resetEnd)
            setDurationWeeks('0')
            return
        }

        setEndDate(end)
        setIsEndDateFixed(true)
        const newWeeks = calculateWeeks(startDate, end)
        setDurationWeeks(newWeeks)
    }

    const handleStartDateChange = (start: string) => {
        setStartDate(start)
        const newEnd = calculateEndDate(start, durationWeeks)
        setEndDate(newEnd)
    }

    // ── Compare mode handlers ──────────────────────────────────────────────
    const handleEnterCompare = useCallback(() => {
        setBuilderViewMode('compare')
        if (studentContext?.id && !compareProgramsLoaded) {
            setCompareProgramsLoading(true)
            getPastProgramsForStudent(studentContext.id)
                .then((result) => {
                    setCompareProgramsList(result.data || [])
                    setCompareProgramsLoaded(true)
                })
                .catch(() => {
                    setCompareProgramsList([])
                    setCompareProgramsLoaded(true)
                })
                .finally(() => setCompareProgramsLoading(false))
        }
    }, [studentContext?.id, compareProgramsLoaded])

    const handleSelectCompareProgram = useCallback((programId: string) => {
        setCompareSelectedProgramId(programId)
        setCompareProgramLoading(true)
        getFullProgramForCompare(programId)
            .then((result) => {
                const data = result.data || null
                setCompareProgramData(data)
                if (data && data.workouts.length > 0) {
                    const converted = data.workouts.map(cw => compareWorkoutToWorkout(cw, localExercises))
                    setCompareWorkouts(converted)
                    setCompareActiveWorkoutId(converted[0].id)
                } else {
                    setCompareWorkouts([])
                    setCompareActiveWorkoutId(null)
                }
            })
            .catch(() => {
                setCompareProgramData(null)
                setCompareWorkouts([])
                setCompareActiveWorkoutId(null)
            })
            .finally(() => setCompareProgramLoading(false))
    }, [localExercises])

    const handleExitCompare = useCallback(() => {
        setBuilderViewMode('normal')
    }, [])

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
    const aiPanelAutoOpenedRef = useRef(false)

    // ── AI Panel lifecycle ──
    // Auto-open once on mount if ?mode=ai or a deeplink generation id is present.
    useEffect(() => {
        if (!aiPanelAvailable || aiPanelAutoOpenedRef.current) return
        const modeAi = searchParams?.get('mode') === 'ai'
        const hasGen = !!prescriptionGenerationId
        if (modeAi || hasGen) {
            setAiPanelOpen(true)
            aiPanelAutoOpenedRef.current = true
        }
    }, [aiPanelAvailable, searchParams, prescriptionGenerationId])

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
        console.log('Initializing workouts with program:', program?.workout_templates)
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
                                const childHydrated = hydrateSetScheme(c.workout_item_set_templates, c.rounds ?? 1)
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
                                    item_config: c.item_config || {},
                                    set_scheme: childHydrated.scheme,
                                    method_key: (c.method_key as WorkoutItem['method_key']) ?? null,
                                    rounds: childHydrated.rounds,
                                }
                            })

                        const parentHydrated = hydrateSetScheme(p.workout_item_set_templates, p.rounds ?? 1)
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
                            item_config: p.item_config || {},
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

    const [workouts, setWorkouts] = useState<Workout[]>(initializeWorkouts)
    const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(
        workouts.length > 0 ? workouts[0].id : null
    )

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
    }, [streamAnimate])

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
    }, [streamAnimate, stream.workouts, stream.isDone])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [nameShake, setNameShake] = useState(false)
    const [isCanvasScrolled, setIsCanvasScrolled] = useState(false)
    const [isHeaderHidden, setIsHeaderHidden] = useState(false)
    const lastScrollTopRef = useRef(0)
    const accumulatedScrollRef = useRef(0)
    const lastDirectionRef = useRef<'up' | 'down' | null>(null)
    const headerTransitionRef = useRef(false)

    const setHeaderHiddenSafe = useCallback((hidden: boolean) => {
        if (hidden === isHeaderHidden || headerTransitionRef.current) return
        headerTransitionRef.current = true
        setIsHeaderHidden(hidden)
        setTimeout(() => { headerTransitionRef.current = false }, 200)
    }, [isHeaderHidden])
    const [previewScale, setPreviewScale] = useState(0.82)
    // Fase 4.5k: SSR-safe init (mesmo padrão do EditAssignedProgramClient).
    // Default `false` no servidor; useEffect rehidrata do localStorage no
    // client após mount. Resolve hydration mismatch reportado no painel da
    // biblioteca.
    const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(
        prescriptionPreferences ? !prescriptionPreferences.visualization.library_open_on_enter : false,
    )
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [formTriggers, setFormTriggers] = useState<TriggerSelection>({
        preWorkout: initialFormTriggers?.preWorkout?.formTemplateId ?? null,
        postWorkout: initialFormTriggers?.postWorkout?.formTemplateId ?? null,
    })
    const [checkinExpanded, setCheckinExpanded] = useState(false)
    const formTriggerCount = (formTriggers.preWorkout ? 1 : 0) + (formTriggers.postWorkout ? 1 : 0)
    const canvasScrollRef = useRef<HTMLDivElement>(null)
    // Sensors for tab drag-and-drop (distance constraint allows click without triggering drag)
    const tabSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor),
    )

    // Derived state
    const activeWorkout = useMemo(() =>
        workouts.find(w => w.id === activeWorkoutId) || null
        , [workouts, activeWorkoutId])

    const compareActiveWorkout = useMemo(() =>
        compareWorkouts.find(w => w.id === compareActiveWorkoutId) || null
        , [compareWorkouts, compareActiveWorkoutId])

    const workoutsWithoutDays = useMemo(() =>
        workouts.filter(w => !w.frequency || w.frequency.length === 0),
        [workouts]
    )

    const occupiedDays = useMemo(() => {
        const days = new Set<string>()
        workouts.forEach(w => {
            if (activeWorkoutId !== w.id && w.frequency) {
                w.frequency.forEach(d => days.add(d))
            }
        })
        return Array.from(days)
    }, [workouts, activeWorkoutId])

    // Dynamically scale the phone preview to fit the available vertical space
    useEffect(() => {
        const BASE_PHONE_HEIGHT = 812
        // Offset = AppLayout header (64) + builder header (~48) + tabs (~44) + padding (24)
        const OFFSET = 180

        const update = () => {
            const available = window.innerHeight - OFFSET
            const s = Math.min(0.82, Math.max(0.55, available / BASE_PHONE_HEIGHT))
            setPreviewScale(s)
        }

        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    // Fase 4.5k: rehidrata a preferência salva DEPOIS do mount. A transição
    // animada do panel mascara o ajuste — sem flash perceptível.
    useEffect(() => {
        if (typeof window === 'undefined') return
        const stored = localStorage.getItem('kinevo-library-collapsed')
        if (stored === 'true') setIsLibraryCollapsed(true)
    }, [])

    const toggleLibrary = useCallback(() => {
        setIsLibraryCollapsed(prev => {
            const next = !prev
            localStorage.setItem('kinevo-library-collapsed', String(next))
            return next
        })
    }, [])

    // Actions
    const addWorkout = useCallback(() => {
        const convention = prescriptionPreferences?.program_structure.naming_convention
            ?? KINEVO_DEFAULT_PREFERENCES.program_structure.naming_convention
        const newWorkout: Workout = {
            id: tempId(),
            name: generateWorkoutName(workouts.length, convention),
            order_index: workouts.length,
            items: [],
            frequency: []
        }
        setWorkouts(prev => [...prev, newWorkout])
        setActiveWorkoutId(newWorkout.id)
    }, [workouts.length, prescriptionPreferences])

    const updateWorkoutName = useCallback((workoutId: string, name: string) => {
        setWorkouts(prev => prev.map(w =>
            w.id === workoutId ? { ...w, name } : w
        ))
    }, [])

    const deleteWorkout = useCallback((workoutId: string) => {
        const remaining = workouts.filter(w => w.id !== workoutId)
        setWorkouts(remaining.map((w, i) => ({ ...w, order_index: i })))
        if (activeWorkoutId === workoutId) {
            setActiveWorkoutId(remaining[0]?.id || null)
        }
    }, [activeWorkoutId, workouts])

    const duplicateWorkout = useCallback((workoutId: string) => {
        const convention = prescriptionPreferences?.program_structure.naming_convention
            ?? KINEVO_DEFAULT_PREFERENCES.program_structure.naming_convention
        setWorkouts(prev => {
            const source = prev.find(w => w.id === workoutId)
            if (!source) return prev
            const baseName = source.name.replace(/^(Treino [A-Z]|Treino \d+|Dia \d+)\s*[-–]\s*/, '')
            const prefix = generateWorkoutName(prev.length, convention)
            const copy: Workout = {
                id: tempId(),
                name: `${prefix}${baseName ? ` - ${baseName}` : ''}`,
                order_index: prev.length,
                items: source.items.map(item => ({
                    ...item,
                    id: tempId(),
                    item_config: item.item_config ? { ...item.item_config } : {},
                    children: item.children?.map(child => ({ ...child, id: tempId(), item_config: child.item_config ? { ...child.item_config } : {} })),
                })),
                frequency: [],
            }
            return [...prev, copy]
        })
    }, [prescriptionPreferences])

    const handleWorkoutDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setWorkouts(prev => {
            const oldIndex = prev.findIndex(w => w.id === active.id)
            const newIndex = prev.findIndex(w => w.id === over.id)
            if (oldIndex === -1 || newIndex === -1) return prev
            return arrayMove(prev, oldIndex, newIndex).map((w, i) => ({ ...w, order_index: i }))
        })
    }, [])

    const updateWorkoutFrequency = useCallback((workoutId: string, days: string[]) => {
        console.log('updateWorkoutFrequency', workoutId, days)
        setWorkouts(prev => prev.map(w =>
            w.id === workoutId ? { ...w, frequency: days } : w
        ))
    }, [])

    const addExerciseFromLibrary = useCallback((exercise: Exercise, options?: { sets?: number; reps?: string; rest_seconds?: number | null; notes?: string | null }) => {
        if (!activeWorkoutId) return

        const setDefaults = prescriptionPreferences?.set_defaults ?? KINEVO_DEFAULT_PREFERENCES.set_defaults
        const addCfg = prescriptionPreferences?.add_exercise ?? KINEVO_DEFAULT_PREFERENCES.add_exercise

        setWorkouts(prev => prev.map(w => {
            if (w.id !== activeWorkoutId) return w

            const setsCount = options?.sets ?? parseSetsCount(setDefaults.sets)
            const repsStr = options?.reps ?? setDefaults.reps
            // TODO v2: client model has single rest_seconds; pref.rest_isolation_seconds
            // is persisted but not consumed. See PRD_preferencias_prescricao_LIMITACOES_V1.md.
            const restSeconds = options?.rest_seconds ?? setDefaults.rest_compound_seconds

            const seedScheme: WorkoutSet[] | null =
                addCfg.open_mode === 'set_editor'
                    ? Array.from({ length: setsCount }, (_, i): WorkoutSet => ({
                        set_number: i + 1,
                        set_type: 'normal',
                        reps: repsStr,
                        rest_seconds: restSeconds,
                        weight_target_kg: null,
                        weight_target_pct1rm: null,
                        rir: null,
                        tempo: null,
                        notes: null,
                    }))
                    : null

            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'exercise',
                order_index: 0, // Will be recalculated
                parent_item_id: null,
                exercise_id: exercise.id,
                substitute_exercise_ids: [],
                exercise: exercise,
                sets: setsCount,
                reps: repsStr,
                rest_seconds: restSeconds,
                notes: options?.notes ?? null,
                set_scheme: seedScheme,
                method_key: null,
                rounds: 1,
                children: []
            }

            // Heurística auto_warmup: injeta um item de aquecimento ANTES do
            // exercício quando a pref está ligada E é a primeira adição neste
            // workout (items.length === 0). Não duplica em workouts já populados.
            const shouldInjectWarmup = addCfg.auto_warmup && w.items.length === 0
            const newItems = [...w.items]
            if (shouldInjectWarmup) {
                const warmupItem: WorkoutItem = {
                    id: tempId(),
                    item_type: 'warmup',
                    order_index: newItems.length,
                    parent_item_id: null,
                    exercise_id: null,
                    substitute_exercise_ids: [],
                    sets: null,
                    reps: null,
                    rest_seconds: null,
                    notes: null,
                    item_config: { warmup_type: 'free' },
                    children: [],
                }
                newItems.push(warmupItem)
            }
            newItems.push({ ...newItem, order_index: newItems.length })

            return { ...w, items: newItems }
        }))
    }, [activeWorkoutId, prescriptionPreferences])

    const addExerciseToWorkout = useCallback((
        workoutId: string,
        exercise: Exercise,
        options?: {
            sets?: number
            reps?: string
            rest_seconds?: number | null
            notes?: string | null
            method_key?: import('@kinevo/shared/types/prescription').MethodKey | null
            set_scheme?: WorkoutSet[] | null
            rounds?: number | null
        },
    ) => {
        const setDefaults = prescriptionPreferences?.set_defaults ?? KINEVO_DEFAULT_PREFERENCES.set_defaults
        const addCfg = prescriptionPreferences?.add_exercise ?? KINEVO_DEFAULT_PREFERENCES.add_exercise

        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const setsCount = options?.sets ?? parseSetsCount(setDefaults.sets)
            const repsStr = options?.reps ?? setDefaults.reps
            // TODO v2: client model has single rest_seconds; pref.rest_isolation_seconds
            // is persisted but not consumed. See PRD_preferencias_prescricao_LIMITACOES_V1.md.
            const restSeconds = options?.rest_seconds ?? setDefaults.rest_compound_seconds

            const seedScheme: WorkoutSet[] | null =
                options?.set_scheme !== undefined
                    ? options.set_scheme
                    : addCfg.open_mode === 'set_editor'
                        ? Array.from({ length: setsCount }, (_, i): WorkoutSet => ({
                            set_number: i + 1,
                            set_type: 'normal',
                            reps: repsStr,
                            rest_seconds: restSeconds,
                            weight_target_kg: null,
                            weight_target_pct1rm: null,
                            rir: null,
                            tempo: null,
                            notes: null,
                        }))
                        : null

            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'exercise',
                order_index: w.items.length,
                parent_item_id: null,
                exercise_id: exercise.id,
                substitute_exercise_ids: [],
                exercise: exercise,
                sets: setsCount,
                reps: repsStr,
                rest_seconds: restSeconds,
                notes: options?.notes ?? null,
                set_scheme: seedScheme,
                method_key: options?.method_key ?? null,
                rounds: options?.rounds ?? 1,
                children: []
            }

            // Mesma heurística do addExerciseFromLibrary — só injeta warmup
            // se a pref está ligada e o workout está vazio.
            const shouldInjectWarmup = addCfg.auto_warmup && w.items.length === 0
            const newItems = [...w.items]
            if (shouldInjectWarmup) {
                const warmupItem: WorkoutItem = {
                    id: tempId(),
                    item_type: 'warmup',
                    order_index: newItems.length,
                    parent_item_id: null,
                    exercise_id: null,
                    substitute_exercise_ids: [],
                    sets: null,
                    reps: null,
                    rest_seconds: null,
                    notes: null,
                    item_config: { warmup_type: 'free' },
                    children: [],
                }
                newItems.push(warmupItem)
            }
            newItems.push({ ...newItem, order_index: newItems.length })

            return { ...w, items: newItems }
        }))
    }, [prescriptionPreferences])

    const createWorkoutWithName = useCallback((name: string, frequency?: string[]): string => {
        const id = tempId()
        const newWorkout: Workout = {
            id,
            name,
            order_index: workouts.length,
            items: [],
            frequency: frequency ?? []
        }
        setWorkouts(prev => [...prev, newWorkout])
        setActiveWorkoutId(id)
        return id
    }, [workouts.length])

    /** Remove workouts vazios pelos IDs informados, com reindex de order_index.
     *  Usado pelo `AiPrescribePanel` no fim de uma prescrição por texto pra
     *  limpar placeholders ("Treino A" default) que ficaram órfãos quando o
     *  trainer prescreveu workouts próprios. Operação atômica via callback —
     *  sobrevive a múltiplas atualizações em sequência. */
    const cleanupEmptyPlaceholders = useCallback((workoutIds: string[]) => {
        if (workoutIds.length === 0) return
        const idSet = new Set(workoutIds)
        setWorkouts(prev => {
            const filtered = prev.filter(w => !idSet.has(w.id) || w.items.length > 0)
            // Só reindex se houve remoção, pra evitar render desnecessário.
            if (filtered.length === prev.length) return prev
            return filtered.map((w, i) => ({ ...w, order_index: i }))
        })
        setActiveWorkoutId(prev => prev && idSet.has(prev) ? null : prev)
    }, [])

    const handleExerciseCreated = useCallback((newExercise: Exercise) => {
        setLocalExercises(prev => [newExercise, ...prev])
    }, [])

    // Handle drag-and-drop from exercise library to workout canvas
    const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('application/kinevo-exercise-id')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setIsDraggingOver(true)
        }
    }, [])

    const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
        // Only trigger when leaving the container, not child elements
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOver(false)
        }
    }, [])

    const handleCanvasDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingOver(false)
        const exerciseId = e.dataTransfer.getData('application/kinevo-exercise-id')
        if (!exerciseId) return
        const exercise = localExercises.find(ex => ex.id === exerciseId)
        if (exercise) {
            addExerciseFromLibrary(exercise)
        }
    }, [localExercises, addExerciseFromLibrary])

    const addNote = useCallback((workoutId: string) => {
        const noteTemplate = prescriptionPreferences?.quick_blocks.note_template
            ?? KINEVO_DEFAULT_PREFERENCES.quick_blocks.note_template
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'note',
                order_index: w.items.length,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: null,
                notes: noteTemplate ?? '',
                children: []
            }
            return { ...w, items: [...w.items, newItem] }
        }))
    }, [prescriptionPreferences])

    const addWarmup = useCallback((workoutId: string) => {
        const warmupTemplate = prescriptionPreferences?.quick_blocks.warmup_template
            ?? KINEVO_DEFAULT_PREFERENCES.quick_blocks.warmup_template
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'warmup',
                order_index: w.items.length,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: null,
                notes: null,
                item_config: warmupTemplate
                    ? { warmup_type: 'free', description: warmupTemplate }
                    : { warmup_type: 'free' },
                children: []
            }
            return { ...w, items: [...w.items, newItem] }
        }))
    }, [prescriptionPreferences])

    const addCardio = useCallback((workoutId: string) => {
        const aerobicTemplate = prescriptionPreferences?.quick_blocks.aerobic_template
            ?? KINEVO_DEFAULT_PREFERENCES.quick_blocks.aerobic_template
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w
            const newItem: WorkoutItem = {
                id: tempId(),
                item_type: 'cardio',
                order_index: w.items.length,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: null,
                notes: null,
                // v1 limitation: aerobic_template popula item_config.notes (campo
                // exposto pelo TechnicalNote do CardioItemCard). CardioConfig não
                // tem um `description` dedicado como WarmupConfig.
                // Ver PRD_preferencias_prescricao_LIMITACOES_V1.md.
                item_config: aerobicTemplate
                    ? { mode: 'continuous', objective: 'time', notes: aerobicTemplate }
                    : { mode: 'continuous', objective: 'time' },
                children: []
            }
            return { ...w, items: [...w.items, newItem] }
        }))
    }, [prescriptionPreferences])

    const updateItem = useCallback((workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const newItems = w.items.map(item => {
                if (item.id === itemId) return { ...item, ...updates }
                if (item.children) {
                    const newChildren = item.children.map(c =>
                        c.id === itemId ? { ...c, ...updates } : c
                    )
                    return { ...item, children: newChildren }
                }
                return item
            })

            return { ...w, items: newItems }
        }))
    }, [])

    const deleteItem = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const newItems = w.items.filter(item => item.id !== itemId).map(item => ({
                ...item,
                children: item.children ? item.children.filter(c => c.id !== itemId) : []
            }))

            return { ...w, items: newItems }
        }))
    }, [])

    /**
     * Duplica um item top-level (exercise, superset, warmup, cardio) e o
     * insere logo após o original. Útil quando o trainer configurou um bloco
     * complexo (ex: superset com método avançado) e quer replicar a
     * estrutura pra outro grupo de exercícios.
     *
     * - Gera novos `id` pro item e pra todos os children (supersets).
     * - `set_scheme` é clonado raso: cada WorkoutSet só tem campos
     *   primitivos, sem IDs próprios.
     * - `substitute_exercise_ids` aponta pra exercícios da biblioteca, não
     *   pra workout items, então pode reutilizar o array.
     */
    const duplicateItem = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === itemId)
            if (index === -1) return w

            const original = w.items[index]
            const newItemId = tempId()
            const duplicate: WorkoutItem = {
                ...original,
                id: newItemId,
                set_scheme: original.set_scheme
                    ? original.set_scheme.map(s => ({ ...s }))
                    : original.set_scheme,
                substitute_exercise_ids: [...(original.substitute_exercise_ids ?? [])],
                children: original.children
                    ? original.children.map(child => ({
                        ...child,
                        id: tempId(),
                        parent_item_id: newItemId,
                        set_scheme: child.set_scheme
                            ? child.set_scheme.map(s => ({ ...s }))
                            : child.set_scheme,
                        substitute_exercise_ids: [...(child.substitute_exercise_ids ?? [])],
                    }))
                    : original.children,
            }

            const newItems = [...w.items]
            newItems.splice(index + 1, 0, duplicate)

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const moveItem = useCallback((workoutId: string, itemId: string, direction: 'up' | 'down') => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === itemId)
            if (index !== -1) {
                const targetIndex = direction === 'up' ? index - 1 : index + 1
                if (targetIndex >= 0 && targetIndex < w.items.length) {
                    const newItems = [...w.items]
                    const temp = newItems[index]
                    newItems[index] = newItems[targetIndex]
                    newItems[targetIndex] = temp
                    return { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
                }
            }
            return w
        }))
    }, [])

    const handleReorderItem = useCallback((activeId: string, overId: string) => {
        if (!activeWorkoutId) return

        setWorkouts(prev => prev.map(w => {
            if (w.id !== activeWorkoutId) return w

            const oldIndex = w.items.findIndex(i => i.id === activeId)
            const newIndex = w.items.findIndex(i => i.id === overId)

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const newItems = arrayMove(w.items, oldIndex, newIndex)
                return { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
            }
            return w
        }))
    }, [activeWorkoutId])

    const createSupersetWithNext = useCallback((workoutId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === itemId)
            if (index === -1 || index === w.items.length - 1) return w

            const currentItem = w.items[index]
            const nextItem = w.items[index + 1]
            if (currentItem.item_type !== 'exercise' || nextItem.item_type !== 'exercise') return w

            const supersetId = tempId()
            const superset: WorkoutItem = {
                id: supersetId,
                item_type: 'superset',
                order_index: index,
                parent_item_id: null,
                exercise_id: null,
                substitute_exercise_ids: [],
                sets: null,
                reps: null,
                rest_seconds: null,
                notes: null,
                children: [
                    { ...currentItem, parent_item_id: supersetId, order_index: 0 },
                    { ...nextItem, parent_item_id: supersetId, order_index: 1 }
                ]
            }

            const newItems = [...w.items]
            newItems.splice(index, 2, superset)

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const dissolveSuperset = useCallback((workoutId: string, supersetId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const index = w.items.findIndex(i => i.id === supersetId)
            if (index === -1) return w

            const superset = w.items[index]
            if (!superset.children) return w

            const children = superset.children.map(c => ({
                ...c,
                parent_item_id: null
            }))

            const newItems = [...w.items]
            newItems.splice(index, 1, ...children)
            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const addToExistingSuperset = useCallback((workoutId: string, itemId: string, supersetId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const itemIndex = w.items.findIndex(i => i.id === itemId)
            const supersetIndex = w.items.findIndex(i => i.id === supersetId)

            if (itemIndex === -1 || supersetIndex === -1) return w

            const item = w.items[itemIndex]
            const superset = w.items[supersetIndex]

            // Only exercise items can be added to supersets
            if (item.item_type !== 'exercise') return w

            // Create new child with parent reference
            const newChild = {
                ...item,
                parent_item_id: supersetId,
                order_index: (superset.children?.length || 0)
            }

            // Update superset children
            const newChildren = [...(superset.children || []), newChild]
                .map((c, i) => ({ ...c, order_index: i }))

            const updatedSuperset = {
                ...superset,
                children: newChildren
            }

            // Remove original item and update superset
            const newItems = [...w.items]
            // If item is before superset, remove first then update superset index
            if (itemIndex < supersetIndex) {
                newItems.splice(supersetIndex, 1, updatedSuperset)
                newItems.splice(itemIndex, 1)
            } else {
                newItems.splice(itemIndex, 1)
                newItems.splice(supersetIndex, 1, updatedSuperset)
            }

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])

    const removeFromSuperset = useCallback((workoutId: string, supersetId: string, itemId: string) => {
        setWorkouts(prev => prev.map(w => {
            if (w.id !== workoutId) return w

            const supersetIndex = w.items.findIndex(i => i.id === supersetId)
            if (supersetIndex === -1) return w

            const superset = w.items[supersetIndex]
            if (!superset.children) return w

            const childIndex = superset.children.findIndex(c => c.id === itemId)
            if (childIndex === -1) return w

            const child = superset.children[childIndex]
            const newChildren = superset.children.filter(c => c.id !== itemId)
            const removedChild: WorkoutItem = { ...child, parent_item_id: null }

            const newItems = [...w.items]

            // Auto-dissolução: superset com 0 ou 1 filho não faz mais sentido
            // como agrupamento. Some o container e promove o(s) sobrevivente(s)
            // pra root. Espelha o comportamento de
            // edit-assigned-program-client.tsx pra manter os dois fluxos
            // consistentes.
            if (newChildren.length <= 1) {
                // Remove o superset
                newItems.splice(supersetIndex, 1)

                // Insere o desvinculado na posição original do superset, e o
                // remanescente (se houver) logo depois.
                const itemsToInsert: WorkoutItem[] = [removedChild]
                if (newChildren.length === 1) {
                    itemsToInsert.push({ ...newChildren[0], parent_item_id: null })
                }
                newItems.splice(supersetIndex, 0, ...itemsToInsert)

                return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
            }

            // 2+ filhos remanescentes: mantém o superset, só atualiza children
            // e enfileira o desvinculado logo após o bloco.
            const updatedSuperset = {
                ...superset,
                children: newChildren.map((c, i) => ({ ...c, order_index: i }))
            }
            newItems.splice(supersetIndex, 1, updatedSuperset)
            newItems.splice(supersetIndex + 1, 0, removedChild)

            return { ...w, items: newItems.map((i, idx) => ({ ...i, order_index: idx })) }
        }))
    }, [])


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
                    .insert({
                        name: name.trim(),
                        description: description.trim() || null,
                        duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                        is_template: isTemplate,
                    })
                    .select('id')
                    .single()

                if (createError) throw createError
                programId = newProgram.id
            }

            // Save workouts and items
            for (const workout of workouts) {
                console.log('Saving workout:', workout.name, 'Frequency:', workout.frequency)
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

            // Save form triggers (secondary — failure shows warning, doesn't revert program)
            if (programId && (formTriggers.preWorkout || formTriggers.postWorkout)) {
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

                router.push(`/students/${studentContext.id}`)
            } else {
                // Template saved (no assignment)
                useOnboardingStore.getState().completeMilestone('first_program_created')
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
                .insert({
                    name: templateName.trim(),
                    description: description.trim() || null,
                    duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                    is_template: true,
                })
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
                alert('Modelo salvo na biblioteca!')
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
                <div className={`flex-shrink-0 bg-white dark:bg-surface-primary backdrop-blur-md border-b border-[#E8E8ED] dark:border-k-border-primary flex items-center gap-2 lg:gap-4 px-4 lg:px-6 z-sticky transition-all duration-250 ease-in-out overflow-hidden ${isHeaderHidden ? 'max-h-0 py-0 border-b-0 opacity-0' : isCanvasScrolled ? 'max-h-20 py-1.5 opacity-100' : 'max-h-20 py-3 opacity-100'}`}>
                    {/* Left: Back + Name — flex-1 below lg, fixed (non-shrinking) responsive widths from lg up. The wider layout (with "Salvar Modelo" / "Gerar com IA" labels / px-5 buttons) only kicks in at min-[1700px]; below that we keep a compact configuration so the action buttons never get clipped by the header's overflow-hidden. */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-[210px] xl:w-[230px] min-[1700px]:w-[280px]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => isStudentContext && studentContext
                                ? router.push(`/students/${studentContext.id}`)
                                : router.push('/programs')
                            }
                            className="w-9 h-9 rounded-full hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-all flex-shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>

                        <div className="flex items-center gap-2 min-w-0 flex-1">
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

                    {/* Center: Condensed timeline (only in student context, hidden on scroll). Compacts at lg, expands at xl. */}
                    {isStudentContext && (
                        <div className={`hidden lg:flex items-center gap-1.5 2xl:gap-2 text-xs text-muted-foreground border-x border-k-border-subtle px-2 lg:px-3 2xl:px-5 min-w-0 transition-all duration-200 overflow-hidden ${isCanvasScrolled ? 'max-w-0 opacity-0 px-0 border-0' : 'max-w-[600px] opacity-100'}`}>
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                            <span className="hidden 2xl:inline text-[10px] text-muted-foreground">Início</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                className="bg-transparent border-none text-xs font-medium text-k-text-secondary focus:ring-0 p-0 [color-scheme:dark] w-[90px] 2xl:w-[104px] shrink-0"
                            />
                            <span className="text-k-border-subtle">→</span>
                            <span className="hidden 2xl:inline text-[10px] text-muted-foreground">Fim</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleEndDateChange(e.target.value)}
                                className={`bg-transparent border-none text-xs font-medium focus:ring-0 p-0 [color-scheme:dark] w-[90px] 2xl:w-[104px] shrink-0 transition-colors ${isEndDateFixed ? 'text-violet-400' : 'text-k-text-secondary'}`}
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
                                <span className="text-muted-foreground"><span className="2xl:hidden">sem</span><span className="hidden 2xl:inline">semanas</span></span>
                            </div>
                        </div>
                    )}

                    {/* View mode icons — Check-in · Preview · Compare */}
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0 mr-3">
                        {aiPanelAvailable && (
                            <>
                                <button
                                    onClick={toggleAiPanel}
                                    data-testid="ai-panel-toggle"
                                    className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition-colors duration-150 ${
                                        aiPanelOpen
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

                    {/* Actions — context-aware save buttons */}
                    <div className="flex items-center gap-1.5 lg:gap-3 flex-shrink-0">
                        {isStudentContext ? (
                            <>
                                {/* Terciário: Salvar Modelo — ghost text. Only shown at min-[1700px] since at narrower widths its ~120px would push the primary action buttons off-screen (2xl alone isn't wide enough — at 1536-1700px the layout still overflows). */}
                                <button
                                    onClick={() => {
                                        setTemplateName(name)
                                        setAlsoActivate(false)
                                        setShowTemplateDialog(true)
                                    }}
                                    disabled={saving}
                                    className="hidden min-[1700px]:inline px-3 py-2 h-9 text-sm text-k-text-quaternary hover:text-k-text-primary transition-colors disabled:opacity-50"
                                >
                                    Salvar Modelo
                                </button>

                                {/* Secundário: Agendar na Fila — outline. Compact padding at xl-down to keep both action buttons on screen. */}
                                <Button
                                    onClick={() => saveProgram('scheduled')}
                                    disabled={saving}
                                    variant="outline"
                                    className="rounded-full px-3 min-[1700px]:px-5 py-2 h-9 text-sm font-medium transition-all whitespace-nowrap"
                                >
                                    Agendar na Fila
                                </Button>

                                {/* Primário: Ativar como Atual — roxo sólido */}
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
                                        className="bg-[#7C3AED] dark:bg-violet-600 hover:bg-[#6D28D9] dark:hover:bg-violet-500 text-white rounded-full px-3 min-[1700px]:px-5 py-2 h-9 text-sm font-medium transition-all whitespace-nowrap"
                                    >
                                        {saving ? (
                                            <Loader2 className="animate-spin w-4 h-4" />
                                        ) : (
                                            'Ativar como Atual'
                                        )}
                                    </Button>
                                </div>
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
                                        onScroll={(e) => {
                                            const scrollTop = e.currentTarget.scrollTop
                                            const shouldBeScrolled = isCanvasScrolled ? scrollTop > 10 : scrollTop > 60
                                            if (shouldBeScrolled !== isCanvasScrolled) setIsCanvasScrolled(shouldBeScrolled)
                                            // Auto-hide header: accumulate distance in same direction
                                            if (!headerTransitionRef.current) {
                                                const dir = scrollTop > lastScrollTopRef.current ? 'down' : 'up'
                                                const absDelta = Math.abs(scrollTop - lastScrollTopRef.current)
                                                if (dir !== lastDirectionRef.current) {
                                                    accumulatedScrollRef.current = 0
                                                    lastDirectionRef.current = dir
                                                }
                                                accumulatedScrollRef.current += absDelta
                                                if (dir === 'down' && scrollTop > 60 && accumulatedScrollRef.current > 40) {
                                                    setHeaderHiddenSafe(true)
                                                    accumulatedScrollRef.current = 0
                                                } else if (dir === 'up' && accumulatedScrollRef.current > 20) {
                                                    setHeaderHiddenSafe(false)
                                                    accumulatedScrollRef.current = 0
                                                }
                                                if (scrollTop <= 10) setHeaderHiddenSafe(false)
                                            }
                                            lastScrollTopRef.current = scrollTop
                                        }}
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
                                        onScroll={(e) => {
                                            const scrollTop = e.currentTarget.scrollTop
                                            const shouldBeScrolled = isCanvasScrolled ? scrollTop > 10 : scrollTop > 60
                                            if (shouldBeScrolled !== isCanvasScrolled) setIsCanvasScrolled(shouldBeScrolled)
                                            // Auto-hide header: accumulate distance in same direction
                                            if (!headerTransitionRef.current) {
                                                const dir = scrollTop > lastScrollTopRef.current ? 'down' : 'up'
                                                const absDelta = Math.abs(scrollTop - lastScrollTopRef.current)
                                                if (dir !== lastDirectionRef.current) {
                                                    accumulatedScrollRef.current = 0
                                                    lastDirectionRef.current = dir
                                                }
                                                accumulatedScrollRef.current += absDelta
                                                if (dir === 'down' && scrollTop > 60 && accumulatedScrollRef.current > 40) {
                                                    setHeaderHiddenSafe(true)
                                                    accumulatedScrollRef.current = 0
                                                } else if (dir === 'up' && accumulatedScrollRef.current > 20) {
                                                    setHeaderHiddenSafe(false)
                                                    accumulatedScrollRef.current = 0
                                                }
                                                if (scrollTop <= 10) setHeaderHiddenSafe(false)
                                            }
                                            lastScrollTopRef.current = scrollTop
                                        }}
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

            {/* Tour: Program Builder (auto-start on first visit) */}
            <TourRunner tourId="program_builder" steps={TOUR_STEPS.program_builder} autoStart />

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
