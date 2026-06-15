'use client'

import { useState, useCallback, useId } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Calendar, AlertCircle, Smartphone, GitCompareArrows, X, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { WorkoutPanel } from './workout-panel'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableWorkoutTab } from './sortable-workout-tab'
import { ExerciseLibraryPanel } from './exercise-library-panel'
import { VolumeSummary } from './volume-summary'
import { ProgramFormTriggers, type TriggerSelection, type InitialTrigger } from './program-form-triggers'
import { useToast } from '@/components/ui/toast'

import type { Exercise } from '@/types/exercise'
import type { FormTemplateOption } from '@/actions/programs/get-form-templates-for-triggers'
import { saveProgramFormTriggers } from '@/actions/programs/save-program-form-triggers'
import { capturePostAssignmentEdits } from '@/actions/prescription/capture-post-assignment-edits'

// Code-split panels that only render in preview / compare modes — see
// program-builder-client.tsx for context.
const WorkoutExecutionPreview = dynamic(
    () => import('./workout-preview/workout-execution-preview').then(m => ({ default: m.WorkoutExecutionPreview })),
    { ssr: false }
)
const ProgramSelector = dynamic(
    () => import('@/components/builder/context-panel/program-selector').then(m => ({ default: m.ProgramSelector })),
    { ssr: false }
)
// ── Núcleo compartilhado: tipos, helpers per-set e mutações puras ──
import {
    aggregatesFromItem,
    buildSetSchemeRows,
    effectiveMethodKey,
    effectiveRoundsForItem,
    hydrateSetScheme,
    makeCardioItem,
    makeExerciseItem,
    makeNoteItem,
    makeWarmupItem,
    type BuilderViewMode,
    type Workout,
    type WorkoutItem,
} from './builder-model'
import { useWorkoutModel } from './helpers/use-workout-model'
import { useCompareMode } from './helpers/use-compare-mode'
import { useProgramSchedule } from './helpers/use-program-schedule'
import { useCanvasDnd } from './helpers/use-canvas-dnd'
import { useBuilderChrome } from './helpers/use-builder-chrome'
import type { WorkoutSet } from '@kinevo/shared/types/prescription'


interface AssignedProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    status?: string | null
    started_at?: string | null
    scheduled_start_date?: string | null
    assigned_workouts: Array<{
        id: string
        name: string
        order_index: number
        scheduled_days?: number[]
        assigned_workout_items: Array<{
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
            // Optional: only present after the page.tsx query was extended in
            // Fase 4.5i. Older queries (or future trimmed projections) will
            // omit these and the builder falls back to legacy linear mode.
            item_config?: Record<string, unknown> | null
            method_key?: import('@kinevo/shared/types/prescription').MethodKey | null
            rounds?: number | null
            assigned_workout_item_sets?: Array<import('@kinevo/shared/types/prescription').WorkoutSet> | null
        }>
    }>
}

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
}

interface EditAssignedProgramClientProps {
    trainer: Trainer
    program: AssignedProgramData
    exercises: Exercise[]
    studentId: string
    /** Source template ID (for saving form triggers) */
    sourceTemplateId?: string | null
    /** Initial form triggers from source template */
    formTriggers?: {
        preWorkout: InitialTrigger | null
        postWorkout: InitialTrigger | null
    }
    /** Available form templates for trigger configuration */
    formTriggerTemplates?: FormTemplateOption[]
}


/** Persiste as linhas filhas em `assigned_workout_item_sets` para um item
 *  recém-salvo. A expansão por rounds vive em buildSetSchemeRows (núcleo
 *  compartilhado); aqui entram a coluna FK desta tabela e o delete das filhas
 *  órfãs no caminho de UPDATE (item pré-existente que ganhou/perdeu/
 *  reorganizou fases). */
async function persistAssignedSetSchemeRows(
    supabase: ReturnType<typeof createClient>,
    assignedItemId: string,
    scheme: WorkoutSet[] | null | undefined,
    rounds: number,
    isPreExistingItem: boolean,
): Promise<void> {
    // UPDATE path: limpa filhas antigas antes de re-materializar.
    if (isPreExistingItem) {
        const { error: delError } = await supabase
            .from('assigned_workout_item_sets')
            .delete()
            .eq('assigned_workout_item_id', assignedItemId)
        if (delError) throw delError
    }

    const rows = buildSetSchemeRows(scheme, rounds).map(r => ({
        assigned_workout_item_id: assignedItemId,
        ...r,
    }))
    if (rows.length === 0) return
    const { error } = await supabase.from('assigned_workout_item_sets').insert(rows)
    if (error) throw error
}

export function EditAssignedProgramClient({ trainer, program, exercises, studentId, sourceTemplateId, formTriggers: initialFormTriggers, formTriggerTemplates = [] }: EditAssignedProgramClientProps) {
    const router = useRouter()
    const tabDndId = useId()
    const { toast } = useToast()

    // Program state
    const [name, setName] = useState(program.name)
    const [description, setDescription] = useState(program.description || '')
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)
    const [showTemplateDialog, setShowTemplateDialog] = useState(false)
    const [builderViewMode, setBuilderViewMode] = useState<BuilderViewMode>('preview')
    const [checkinExpanded, setCheckinExpanded] = useState(false)


    const [formTriggers, setFormTriggers] = useState<TriggerSelection>({
        preWorkout: initialFormTriggers?.preWorkout?.formTemplateId ?? null,
        postWorkout: initialFormTriggers?.postWorkout?.formTemplateId ?? null,
    })
    const formTriggerCount = (formTriggers.preWorkout ? 1 : 0) + (formTriggers.postWorkout ? 1 : 0)

    const [templateName, setTemplateName] = useState('')
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [frequencyWarning, setFrequencyWarning] = useState<{ workoutNames: string[], onConfirm: () => void } | null>(null)
    // Preserve the program's original activation mode
    const assignmentType = program.scheduled_start_date ? 'scheduled' : 'immediate' as const

    // Início ↔ semanas ↔ fim (sync bidirecional) — hook compartilhado.
    const {
        startDate,
        endDate,
        durationWeeks,
        isEndDateFixed,
        handleWeeksChange,
        handleEndDateChange,
        handleStartDateChange,
    } = useProgramSchedule({
        initialStartDate: (program.started_at || program.scheduled_start_date || new Date().toISOString()).split('T')[0],
        initialWeeks: program.duration_weeks?.toString() || '0',
    })

    const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises)

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
        studentId,
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

    // Handler for new inline exercises (prepend: novo exercício no topo da
    // biblioteca — comportamento unificado com o builder de criação).
    const handleExerciseCreated = useCallback((newExercise: Exercise) => {
        setLocalExercises(prev => [newExercise, ...prev])
    }, [])

    // Initialize workouts from program data
    const initializeWorkouts = (): Workout[] => {
        if (!program?.assigned_workouts) return []

        return program.assigned_workouts
            .sort((a, b) => a.order_index - b.order_index)
            .map(wt => {
                const items = wt.assigned_workout_items || []
                const parentItems = items
                    .filter(i => !i.parent_item_id)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(item => {
                        // Fase 4.5i: hidrata set_scheme/rounds a partir das
                        // linhas materializadas em assigned_workout_item_sets.
                        // Programas pré-Fase-4.5i sem essas linhas caem em
                        // { scheme: null, rounds: 1 } e abrem em modo simples.
                        const parentHydrated = hydrateSetScheme(
                            (item as any).assigned_workout_item_sets,
                            (item as any).rounds ?? 1,
                        )
                        return {
                            id: item.id,
                            item_type: item.item_type as WorkoutItem['item_type'],
                            order_index: item.order_index,
                            parent_item_id: null,
                            exercise_id: item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids || [],
                            exercise: localExercises.find(e => e.id === item.exercise_id),
                            sets: item.sets,
                            reps: item.reps,
                            rest_seconds: item.rest_seconds,
                            notes: item.notes,
                            item_config: (item as any).item_config || {},
                            set_scheme: parentHydrated.scheme,
                            method_key: ((item as any).method_key as WorkoutItem['method_key']) ?? null,
                            rounds: parentHydrated.rounds,
                            children: items
                                .filter(child => child.parent_item_id === item.id)
                                .sort((a, b) => a.order_index - b.order_index)
                                .map(child => {
                                    const childHydrated = hydrateSetScheme(
                                        (child as any).assigned_workout_item_sets,
                                        (child as any).rounds ?? 1,
                                    )
                                    return {
                                        id: child.id,
                                        item_type: child.item_type as WorkoutItem['item_type'],
                                        order_index: child.order_index,
                                        parent_item_id: item.id,
                                        exercise_id: child.exercise_id,
                                        substitute_exercise_ids: child.substitute_exercise_ids || [],
                                        exercise: localExercises.find(e => e.id === child.exercise_id),
                                        sets: child.sets,
                                        reps: child.reps,
                                        rest_seconds: child.rest_seconds,
                                        notes: child.notes,
                                        set_scheme: childHydrated.scheme,
                                        method_key: ((child as any).method_key as WorkoutItem['method_key']) ?? null,
                                        rounds: childHydrated.rounds,
                                    }
                                })
                        }
                    })

                const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
                const frequency = (wt.scheduled_days || []).map(d => dayMap[d])

                return {
                    id: wt.id,
                    name: wt.name,
                    order_index: wt.order_index,
                    frequency,
                    items: parentItems,
                }
            })
    }

    const {
        workouts,
        activeWorkoutId,
        setActiveWorkoutId,
        activeWorkout,
        occupiedDays,
        addWorkout,
        updateWorkoutName,
        updateWorkoutFrequency,
        deleteWorkout: deleteWorkoutFromModel,
        duplicateWorkout,
        handleWorkoutDragEnd,
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
    } = useWorkoutModel({ initialWorkouts: initializeWorkouts })
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
    } = useBuilderChrome()
    // Sensors for tab drag-and-drop
    const tabSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor),
    )


    // Excluir treino atribuído pede confirmação: histórico do aluno pode ser
    // afetado (cascade no banco). A mutação em si vive no hook compartilhado.
    const deleteWorkout = (id: string) => {
        if (!confirm('Tem certeza que deseja remover este treino? Se ele já foi realizado pelo aluno, o histórico associado pode ser perdido.')) {
            return
        }
        deleteWorkoutFromModel(id)
    }

    // Add exercise from inline library — defaults fixos do fluxo de edição
    // (as preferências de prescrição só existem no builder de criação).
    const addExerciseFromLibrary = useCallback((exercise: Exercise) => {
        if (!activeWorkoutId) return
        appendItemsWith(activeWorkoutId, () => [makeExerciseItem(exercise, {
            setsCount: 3,
            reps: '10-12',
            restSeconds: 60,
        })])
    }, [activeWorkoutId, appendItemsWith])

    // Drag-and-drop biblioteca → canvas
    const { isDraggingOver, handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop } = useCanvasDnd({
        exercises: localExercises,
        onDropExercise: addExerciseFromLibrary,
    })

    const addNote = useCallback((workoutId: string) => {
        appendItemsWith(workoutId, () => [makeNoteItem('')])
    }, [appendItemsWith])

    const addWarmup = useCallback((workoutId: string) => {
        appendItemsWith(workoutId, () => [makeWarmupItem()])
    }, [appendItemsWith])

    const addCardio = useCallback((workoutId: string) => {
        appendItemsWith(workoutId, () => [makeCardioItem()])
    }, [appendItemsWith])

    const saveProgram = async (skipFrequencyCheck = false) => {
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
                        saveProgram(true)
                    }
                })
                return
            }
        }

        setSaving(true)
        setError(null)

        const supabase = createClient()

        try {
            // 1. Update Program Details
            const updatePayload: any = {
                name: name.trim(),
                description: description.trim() || null,
                duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
            }

            // Update the correct date field and status.
            // Rascunho (criado fora do builder, ex.: assistente via MCP) PERMANECE
            // rascunho ao ser editado — ativá-lo é uma ação explícita ("Ativar").
            // Sem isso, salvar forçaria status='active' e colidiria com o índice
            // parcial idx_assigned_programs_active_unique (1 ativo por aluno).
            if (program.status === 'draft') {
                updatePayload.status = 'draft'
                updatePayload.started_at = null
                updatePayload.scheduled_start_date = null
            } else if (assignmentType === 'immediate') {
                updatePayload.started_at = startDate
                updatePayload.scheduled_start_date = null
                updatePayload.status = 'active'
            } else {
                updatePayload.scheduled_start_date = startDate
                updatePayload.started_at = null
                updatePayload.status = 'scheduled'
            }

            const { error: updateError } = await supabase
                .from('assigned_programs')
                .update(updatePayload)
                .eq('id', program.id)

            if (updateError) throw updateError

            // 2. Identify Deleted Workouts
            const currentWorkoutIds = workouts
                .filter(w => !w.id.startsWith('temp_'))
                .map(w => w.id)

            // Delete workouts that are no longer in the list
            // WARNING: This cascades to deletion of session history if configured in DB
            // We warned the user in deleteWorkout()
            if (currentWorkoutIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('assigned_workouts')
                    .delete()
                    .eq('assigned_program_id', program.id)
                    .not('id', 'in', `(${currentWorkoutIds.join(',')})`)

                if (deleteError) throw deleteError
            } else {
                // If currentWorkoutIds is empty, it means ALL original workouts were removed
                // But we still have temp workouts potentially
                // So delete everything from DB for this program
                const { error: deleteError } = await supabase
                    .from('assigned_workouts')
                    .delete()
                    .eq('assigned_program_id', program.id)

                if (deleteError) throw deleteError
            }

            // 3. Upsert Workouts
            for (const workout of workouts) {
                let workoutId = workout.id
                const isNewWorkout = workoutId.startsWith('temp_')

                if (isNewWorkout) {
                    const { data, error: insertError } = await supabase
                        .from('assigned_workouts')
                        .insert({
                            assigned_program_id: program.id,
                            name: workout.name,
                            order_index: workout.order_index,
                            scheduled_days: (workout.frequency || []).map(d => {
                                const map: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                                return map[d]
                            }).filter(x => x !== undefined),
                        })
                        .select('id')
                        .single()

                    if (insertError) throw insertError
                    workoutId = data.id
                    // Note: we update local var, but not state, because we're refreshing page anyway
                } else {
                    const { error: updateError } = await supabase
                        .from('assigned_workouts')
                        .update({
                            name: workout.name,
                            order_index: workout.order_index,
                            scheduled_days: (workout.frequency || []).map(d => {
                                const map: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                                return map[d]
                            }).filter(x => x !== undefined),
                        })
                        .eq('id', workoutId)

                    if (updateError) throw updateError
                }

                // 4. Handle Items
                const currentItemIds = workout.items
                    .flatMap(i => [i.id, ...(i.children?.map(c => c.id) || [])])
                    .filter(id => !id.startsWith('temp_'))

                // Delete missing items
                if (currentItemIds.length > 0) {
                    await supabase
                        .from('assigned_workout_items')
                        .delete()
                        .eq('assigned_workout_id', workoutId)
                        .not('id', 'in', `(${currentItemIds.join(',')})`)
                } else if (!isNewWorkout) {
                    // Only delete items if workout existed, otherwise it's empty anyway
                    await supabase
                        .from('assigned_workout_items')
                        .delete()
                        .eq('assigned_workout_id', workoutId)
                }

                // Upsert items (Root first, then children)
                for (const item of workout.items) {
                    let itemId = item.id
                    const isPreExistingItem = !itemId.startsWith('temp_')

                    // Fase 4.5i: agregados sempre derivados de
                    // summarizeWithRounds quando há scheme + rounds.
                    const aggs = aggregatesFromItem(item)
                    const itemRounds = effectiveRoundsForItem(item)

                    const payload: any = {
                        assigned_workout_id: workoutId,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        exercise_id: item.exercise_id,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        sets: aggs.sets,
                        reps: aggs.reps,
                        rest_seconds: aggs.rest_seconds,
                        notes: item.notes,
                        item_config: item.item_config || {},
                        parent_item_id: null,
                        method_key: effectiveMethodKey(item),
                        rounds: itemRounds,
                        // Snapshot data
                        exercise_name: item.exercise?.name,
                        exercise_muscle_group: (() => {
                            const mg = item.exercise?.muscle_groups?.[0] || (item.exercise as any)?.muscle_group
                            return typeof mg === 'object' ? mg?.name : mg
                        })(),
                        exercise_equipment: item.exercise?.equipment
                    }

                    if (itemId.startsWith('temp_')) {
                        const { data, error: itemError } = await supabase
                            .from('assigned_workout_items')
                            .insert(payload)
                            .select('id')
                            .single()

                        if (itemError) throw itemError
                        itemId = data.id
                    } else {
                        await supabase
                            .from('assigned_workout_items')
                            .update(payload)
                            .eq('id', itemId)
                    }

                    // Fase 4.5i: persiste/repõe linhas filhas em
                    // assigned_workout_item_sets. Para itens pré-existentes
                    // (UPDATE path) deleta órfãs antes — cobre casos onde o
                    // trainer mudou o método, número de fases ou reduziu
                    // rounds. Itens recém-criados via temp_id pulam o
                    // delete (não há linhas antigas).
                    await persistAssignedSetSchemeRows(
                        supabase,
                        itemId,
                        item.set_scheme,
                        itemRounds,
                        isPreExistingItem,
                    )

                    // Children (Supersets) — V1 não persiste set_scheme em
                    // filhos de superset. Defesa em profundidade alinhada
                    // com effectiveMethodKey (retorna null pra children) e
                    // com a documentação da Fase 1: "supersets bloqueados
                    // em modo avançado". method_key/rounds vão como null/1.
                    if (item.children) {
                        for (const child of item.children) {
                            const childId = child.id
                            const childPayload: any = {
                                assigned_workout_id: workoutId,
                                item_type: child.item_type,
                                order_index: child.order_index,
                                exercise_id: child.exercise_id,
                                substitute_exercise_ids: child.substitute_exercise_ids || [],
                                sets: child.sets,
                                reps: child.reps,
                                rest_seconds: child.rest_seconds,
                                notes: child.notes,
                                item_config: child.item_config || {},
                                parent_item_id: itemId,
                                method_key: null,
                                rounds: 1,
                                // Snapshot
                                exercise_name: child.exercise?.name,
                                exercise_muscle_group: (() => {
                                    const mg = child.exercise?.muscle_groups?.[0] || (child.exercise as any)?.muscle_group
                                    return typeof mg === 'object' ? mg?.name : mg
                                })(),
                                exercise_equipment: child.exercise?.equipment
                            }

                            if (childId.startsWith('temp_')) {
                                await supabase
                                    .from('assigned_workout_items')
                                    .insert(childPayload)
                            } else {
                                await supabase
                                    .from('assigned_workout_items')
                                    .update(childPayload)
                                    .eq('id', childId)
                            }
                        }
                    }
                }
            }

            // Save form triggers (if source template exists)
            if (sourceTemplateId && (formTriggers.preWorkout || formTriggers.postWorkout)) {
                await saveProgramFormTriggers({
                    programTemplateId: sourceTemplateId,
                    preWorkout: formTriggers.preWorkout,
                    postWorkout: formTriggers.postWorkout,
                })
            }

            // Success feedback
            toast({ message: 'Programa atualizado com sucesso!', type: 'success' })

            // Fire-and-forget: capture edits for AI learning (only processes AI-generated programs)
            capturePostAssignmentEdits(program.id).catch(() => {})

            // Fase 4.5l: removido `router.refresh()` que disparava em sequência
            // com `router.push()`. No Next 16 isso causava race condition entre
            // dois RSC fetches paralelos (payload da rota destino + payload da
            // rota atual), produzindo "An unexpected response was received from
            // the server" no client e travando a navegação no /edit. O
            // `router.push()` sozinho já busca dados frescos da rota destino.
            router.push(`/students/${studentId}`)

        } catch (err: any) {
            console.error('Error saving program:', err)
            setError(err.message || 'Erro ao salvar programa')
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
            const { data: newTemplate, error: createError } = await supabase
                .from('program_templates')
                // trainer_id é preenchido pelo trigger set_trainer_id (BEFORE INSERT)
                .insert({
                    name: templateName.trim(),
                    description: description.trim() || null,
                    duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
                    is_template: true,
                } as import('@kinevo/shared/types/database').Database['public']['Tables']['program_templates']['Insert'])
                .select('id')
                .single()

            if (createError) throw createError

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
                    const { data: savedItem, error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: savedWorkout.id,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
                            exercise_id: item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids || [],
                            sets: item.sets,
                            reps: item.reps,
                            rest_seconds: item.rest_seconds,
                            notes: item.notes,
                            item_config: item.item_config || {},
                        })
                        .select('id')
                        .single()

                    if (itemError) throw itemError

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
                                    item_config: child.item_config || {},
                                })
                            if (childError) throw childError
                        }
                    }
                }
            }

            setShowTemplateDialog(false)
            toast({ message: 'Modelo salvo na biblioteca!', type: 'success' })
        } catch (err: any) {
            console.error('Save template error:', err)
            setError(err.message || 'Erro ao salvar modelo')
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
                    {/* Left: Back + Name — flex-1 below lg, fixed (non-shrinking) responsive widths from lg up. The wider layout (with "Salvar Modelo" / px-5 buttons) only kicks in at min-[1700px]; below that we keep a compact configuration so the action button never gets clipped by the header's overflow-hidden. */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-[210px] xl:w-[230px] min-[1700px]:w-[280px]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/students/${studentId}`)}
                            className="w-9 h-9 rounded-full hover:bg-glass-bg-active text-k-text-tertiary hover:text-k-text-primary transition-all flex-shrink-0"
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
                                className={`bg-transparent border-none text-lg font-bold text-k-text-primary placeholder:text-k-text-quaternary focus:ring-0 p-0 w-full min-w-0 truncate transition-all cursor-text hover:border-b hover:border-dashed hover:border-k-text-quaternary focus:border-b focus:border-solid focus:border-violet-500 ${nameShake ? 'animate-[shake_0.5s_ease-in-out]' : ''
                                    } ${error && !name.trim() ? 'placeholder:text-red-400/60' : ''}`}
                            />
                            <button
                                onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                                className={`p-1 rounded-md transition-all shrink-0 ${isDescriptionOpen ? 'bg-violet-500/20 text-violet-400' : 'text-k-text-quaternary hover:text-k-text-tertiary hover:bg-glass-bg'
                                    }`}
                                title="Editar descrição"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Center: Condensed timeline (hidden on scroll). Compacts at lg, expands at xl. */}
                    <div className={`hidden lg:flex items-center gap-1.5 xl:gap-2 text-xs text-muted-foreground border-x border-k-border-subtle px-3 xl:px-6 shrink-0 transition-all duration-200 overflow-hidden ${isCanvasScrolled ? 'max-w-0 opacity-0 px-0 border-0' : 'max-w-[600px] opacity-100'}`}>
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        <span className="hidden xl:inline text-[10px] text-muted-foreground">Início</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => handleStartDateChange(e.target.value)}
                            className="bg-transparent border-none text-xs font-medium text-k-text-secondary focus:ring-0 p-0 [color-scheme:dark] w-[100px] xl:w-[110px] shrink-0"
                        />
                        <span className="text-k-border-subtle">→</span>
                        <span className="hidden xl:inline text-[10px] text-muted-foreground">Fim</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => handleEndDateChange(e.target.value)}
                            className={`bg-transparent border-none text-xs font-medium focus:ring-0 p-0 [color-scheme:dark] w-[100px] xl:w-[110px] shrink-0 transition-colors ${isEndDateFixed ? 'text-violet-400' : 'text-k-text-secondary'}`}
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
                            <span className="text-muted-foreground"><span className="xl:hidden">sem.</span><span className="hidden xl:inline">semanas</span></span>
                        </div>
                    </div>

                    {/* View mode icons — Check-in · Preview · Compare */}
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0 mr-3">
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
                        <button
                            onClick={builderViewMode === 'compare' ? handleExitCompare : handleEnterCompare}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150 ${
                                builderViewMode === 'compare'
                                    ? 'text-violet-600 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-500/[0.08]'
                                    : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:bg-[#F5F5F7]/60 dark:hover:bg-glass-bg/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                            }`}
                            title={builderViewMode === 'compare' ? 'Sair da comparação' : 'Comparar com treino anterior'}
                        >
                            <GitCompareArrows className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Save */}
                    <div className="flex items-center gap-1.5 lg:gap-3 flex-shrink-0">
                        {/* Terciário: Salvar Modelo — ghost text. Only shown at min-[1700px] since at narrower widths its ~120px would push the primary action button off-screen (2xl alone isn't wide enough — at 1536-1700px the layout still overflows). */}
                        <button
                            onClick={() => {
                                setTemplateName(name)
                                setShowTemplateDialog(true)
                            }}
                            disabled={saving}
                            className="hidden min-[1700px]:inline px-3 py-2 h-9 text-sm text-k-text-quaternary hover:text-k-text-primary transition-colors disabled:opacity-50"
                        >
                            Salvar Modelo
                        </button>

                        {/* Primário: Salvar Alterações — roxo sólido */}
                        <Button
                            onClick={() => saveProgram()}
                            disabled={saving}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-3 min-[1700px]:px-5 py-2 h-9 text-sm font-medium transition-all lg:min-w-[160px] whitespace-nowrap"
                        >
                            {saving ? (
                                <Loader2 className="animate-spin w-4 h-4" />
                            ) : (
                                'Salvar Alterações'
                            )}
                        </Button>
                    </div>
                </div>

                {/* Header-based Description Area */}
                {isDescriptionOpen && (
                    <div className="flex-shrink-0 bg-surface-primary border-b border-k-border-subtle px-8 py-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="max-w-3xl">
                            <label className="block text-xs font-semibold text-k-text-tertiary mb-2">Descrição do programa</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Adicione detalhes sobre o objetivo, metodologia ou observações gerais..."
                                className="w-full bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-k-border-primary rounded-xl px-4 py-3 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:ring-1 focus:ring-[#7C3AED]/20 dark:focus:ring-violet-500/50 focus:border-[#7C3AED] dark:focus:border-violet-500/30 transition-all min-h-[80px] resize-none"
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex-shrink-0 mx-6 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
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



                {/* Check-in expanded content panel */}
                {formTriggerTemplates.length > 0 && builderViewMode !== 'compare' && (
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
                                    <VolumeSummary workouts={workouts} />
                                    {/* Tabs */}
                                    <div className="flex items-center gap-1 p-4 overflow-x-auto no-scrollbar border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-surface-canvas">
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
                                                    onUpdateName={(newName) => updateWorkoutName(activeWorkout.id, newName)}
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
                                                    onRemoveFromSuperset={(supersetId, exerciseItemId) => removeFromSuperset(activeWorkout.id, supersetId, exerciseItemId)}
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
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-surface-canvas">
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
                                                                <span className="flex items-center gap-0.5 ml-1 border-l border-[#E8E8ED] dark:border-k-border-subtle pl-2">
                                                                    <span
                                                                        onClick={(e) => { e.stopPropagation(); duplicateWorkout(workout.id) }}
                                                                        className="p-0.5 rounded text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors cursor-pointer"
                                                                        title="Duplicar treino"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                        </svg>
                                                                    </span>
                                                                    {workouts.length > 1 && (
                                                                        <span
                                                                            onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id) }}
                                                                            className="p-0.5 rounded text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#FF3B30] dark:hover:text-red-400 transition-colors cursor-pointer"
                                                                            title="Excluir treino"
                                                                        >
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    <div className="ml-auto shrink-0">
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
                                            builderViewMode === 'preview' ? 'max-w-6xl flex gap-8' : 'max-w-3xl'
                                        }`}>
                                            <div className={builderViewMode === 'preview' ? 'flex-1 min-w-0' : ''}>
                                                {activeWorkout ? (
                                                    <WorkoutPanel
                                                        workout={activeWorkout}
                                                        exercises={localExercises}
                                                        onUpdateName={(newName) => updateWorkoutName(activeWorkout.id, newName)}
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
                                                        onRemoveFromSuperset={(supersetId, exerciseItemId) => removeFromSuperset(activeWorkout.id, supersetId, exerciseItemId)}
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFrequencyWarning(null)} />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                            <AlertCircle className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Treino sem dia agendado</h3>
                        <p className="text-sm text-k-text-tertiary text-center mb-1">
                            {frequencyWarning.workoutNames.length === 1
                                ? `O treino "${frequencyWarning.workoutNames[0]}" não tem dia da semana selecionado.`
                                : `Os treinos ${frequencyWarning.workoutNames.map(n => `"${n}"`).join(' e ')} não têm dia da semana selecionado.`
                            }
                        </p>
                        <p className="text-xs text-amber-400/80 text-center mb-4">
                            O aluno não verá {frequencyWarning.workoutNames.length === 1 ? 'esse treino' : 'esses treinos'} no calendário.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setFrequencyWarning(null)
                                    const firstMissing = workouts.find(w => !w.frequency || w.frequency.length === 0)
                                    if (firstMissing) setActiveWorkoutId(firstMissing.id)
                                }}
                                className="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl transition-colors border border-amber-500/20"
                            >
                                Corrigir agora
                            </button>
                            <button
                                onClick={frequencyWarning.onConfirm}
                                className="flex-1 py-3 bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary text-xs font-bold rounded-xl transition-colors border border-k-border-subtle"
                            >
                                Salvar assim mesmo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialog — save as template */}
            {showTemplateDialog && (
                <div className="fixed inset-0 z-modal flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTemplateDialog(false)} />
                    <div className="relative bg-surface-primary border border-k-border-subtle rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-base font-semibold text-k-text-primary mb-1">Salvar como Modelo</h3>
                        <p className="text-sm text-k-text-tertiary leading-relaxed mb-5">
                            O programa será salvo na biblioteca de modelos para reutilizar com outros alunos.
                        </p>

                        <div>
                            <label className="block text-[10px] font-bold text-k-text-quaternary mb-1.5">Nome do modelo</label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Ex: Hipertrofia 5x - Superior/Inferior"
                                className="w-full bg-white/[0.04] border border-k-border-subtle rounded-xl px-3 py-2.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 transition-colors"
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-6">
                            <Button
                                onClick={() => setShowTemplateDialog(false)}
                                variant="ghost"
                                className="rounded-full px-5 py-2 h-9 text-sm font-medium bg-white/[0.06] text-k-text-secondary hover:text-k-text-primary hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => saveAsTemplate()}
                                disabled={!templateName.trim() || savingTemplate}
                                className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-5 py-2 h-9 text-sm font-medium transition-all"
                            >
                                {savingTemplate ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar Modelo'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}
