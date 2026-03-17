'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    User, Target, Calendar, Clock, Dumbbell, ShieldAlert,
    Brain, Save, Loader2, Check, Plus, X, AlertCircle,
    ChevronDown, ChevronUp, Sparkles, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import { savePrescriptionProfile } from '@/actions/prescription/save-prescription-profile'

import type {
    TrainingLevel,
    PrescriptionGoal,
    MedicalRestriction,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

import { EQUIPMENT_OPTIONS } from '@kinevo/shared/types/prescription'
import { matchCondition, type ConditionMatchResult } from '@/lib/prescription/condition-mappings'

import type { RecentSession, ActiveProgram } from '@/actions/prescription/get-prescription-data'
import type { QuestionnaireData } from '@/lib/prescription/questionnaire-mapper'

// ============================================================================
// Props
// ============================================================================

interface PrescriptionProfileFormProps {
    studentId: string
    existingProfile: StudentPrescriptionProfile | null
    onSaved: (profile: StudentPrescriptionProfile) => void
    recentSessions: RecentSession[]
    activeProgram: ActiveProgram | null
    previousProgramCount: number
    lastFormSubmissionDate: string | null
    onGenerate: () => void
    compactMode?: boolean
    questionnaireData?: QuestionnaireData | null
}

// ============================================================================
// Labels
// ============================================================================

const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
}

const GOAL_LABELS: Record<PrescriptionGoal, string> = {
    hypertrophy: 'Hipertrofia',
    weight_loss: 'Perda de Peso',
    performance: 'Performance',
    health: 'Saúde',
}

const GOAL_EMOJIS: Record<PrescriptionGoal, string> = {
    hypertrophy: '🏋️',
    weight_loss: '🔥',
    performance: '⚡',
    health: '❤️',
}

const EQUIPMENT_LABELS: Record<string, string> = {
    academia_completa: 'Academia Completa',
    home_gym_basico: 'Home Gym Básico',
    home_gym_completo: 'Home Gym Completo',
    ao_ar_livre: 'Ao Ar Livre',
    apenas_peso_corporal: 'Apenas Peso Corporal',
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ============================================================================
// Helpers
// ============================================================================

function roundToStep(value: number, step: number): number {
    return Math.round(value / step) * step
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Distributes N training days evenly across the week (Mon-Sat preferred).
 * Returns sorted array of day indices (0=Sun, 1=Mon, ..., 6=Sat).
 */
function distributeTrainingDays(frequency: number): number[] {
    const COMMON_DISTRIBUTIONS: Record<number, number[]> = {
        2: [1, 4],              // Seg, Qui
        3: [1, 3, 5],          // Seg, Qua, Sex
        4: [1, 2, 4, 5],      // Seg, Ter, Qui, Sex
        5: [1, 2, 3, 4, 5],   // Seg a Sex
        6: [1, 2, 3, 4, 5, 6], // Seg a Sáb
    }
    return COMMON_DISTRIBUTIONS[frequency] || [1, 3, 5]
}

// ============================================================================
// Component
// ============================================================================

export function PrescriptionProfileForm({
    studentId,
    existingProfile,
    questionnaireData = null,
    onSaved,
    recentSessions,
    activeProgram,
    previousProgramCount,
    lastFormSubmissionDate,
    onGenerate,
    compactMode = false,
}: PrescriptionProfileFormProps) {
    // ── Detect state ──
    const isFirstPrescription = !existingProfile || (recentSessions.length === 0 && previousProgramCount === 0)

    // ── State (questionnaire values used as smart defaults) ──
    const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>(
        existingProfile?.training_level
        || questionnaireData?.suggested_level
        || 'beginner'
    )
    const [goal, setGoal] = useState<PrescriptionGoal>(
        existingProfile?.goal
        || (questionnaireData?.goal_from_student as PrescriptionGoal | undefined)
        || 'hypertrophy'
    )
    const [availableDays, setAvailableDays] = useState<number[]>(() => {
        if (existingProfile?.available_days && existingProfile.available_days.length > 0) {
            return existingProfile.available_days
        }
        if (questionnaireData?.suggested_frequency) {
            return distributeTrainingDays(questionnaireData.suggested_frequency)
        }
        return []
    })
    const [sessionDuration, setSessionDuration] = useState(() => {
        if (existingProfile?.session_duration_minutes) {
            return roundToStep(existingProfile.session_duration_minutes, 15)
        }
        if (questionnaireData?.suggested_duration) {
            return roundToStep(questionnaireData.suggested_duration, 15)
        }
        return 60
    })
    const [equipment, setEquipment] = useState<string[]>(() => {
        if (existingProfile?.available_equipment && existingProfile.available_equipment.length > 0) {
            return existingProfile.available_equipment
        }
        if (questionnaireData?.suggested_equipment) {
            return [questionnaireData.suggested_equipment]
        }
        return []
    })
    const [restrictions, setRestrictions] = useState<MedicalRestriction[]>(existingProfile?.medical_restrictions || [])
    const [cycleObservation, setCycleObservation] = useState(existingProfile?.cycle_observation || '')

    // Track if values were auto-filled from questionnaire
    const autoFilledFromQuestionnaire = !existingProfile && !!questionnaireData

    // New restriction form
    const [newRestriction, setNewRestriction] = useState('')
    const [newSeverity, setNewSeverity] = useState<MedicalRestriction['severity']>('mild')
    const [conditionPreview, setConditionPreview] = useState<ConditionMatchResult | null>(null)

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Context card expanded state (Estado B) — collapsed by default
    const [contextExpanded, setContextExpanded] = useState(false)
    const [formExpanded, setFormExpanded] = useState(false)

    // Compact mode: show only structural fields unless trainer expands
    const showFullForm = !compactMode || formExpanded

    // Reset saved indicator after 3s
    useEffect(() => {
        if (saved) {
            const timer = setTimeout(() => setSaved(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [saved])

    // ── Handlers ──
    const toggleDay = useCallback((day: number) => {
        setAvailableDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
        )
    }, [])

    const toggleEquipment = useCallback((eq: string) => {
        setEquipment(prev =>
            prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
        )
    }, [])

    const addRestriction = useCallback(() => {
        if (!newRestriction.trim()) return
        // Check for condition match before adding
        const match = matchCondition(newRestriction.trim())
        if (match && !conditionPreview) {
            // Show preview first — user must confirm or dismiss
            setConditionPreview(match)
            return
        }
        // Add without auto-populate (no match or user dismissed preview)
        setRestrictions(prev => [
            ...prev,
            {
                description: newRestriction.trim(),
                restricted_exercise_ids: [],
                restricted_muscle_groups: [],
                severity: newSeverity,
            },
        ])
        setNewRestriction('')
        setNewSeverity('mild')
        setConditionPreview(null)
    }, [newRestriction, newSeverity, conditionPreview])

    const applyConditionSuggestions = useCallback(() => {
        if (!conditionPreview || !newRestriction.trim()) return
        setRestrictions(prev => [
            ...prev,
            {
                description: newRestriction.trim(),
                restricted_exercise_ids: [],
                restricted_muscle_groups: [...conditionPreview.condition.cautious_muscle_groups],
                severity: newSeverity,
            },
        ])
        setNewRestriction('')
        setNewSeverity('mild')
        setConditionPreview(null)
    }, [conditionPreview, newRestriction, newSeverity])

    const dismissConditionPreview = useCallback(() => {
        setConditionPreview(null)
        // Add restriction without auto-populate
        if (!newRestriction.trim()) return
        setRestrictions(prev => [
            ...prev,
            {
                description: newRestriction.trim(),
                restricted_exercise_ids: [],
                restricted_muscle_groups: [],
                severity: newSeverity,
            },
        ])
        setNewRestriction('')
        setNewSeverity('mild')
    }, [newRestriction, newSeverity])

    const removeRestriction = useCallback((index: number) => {
        setRestrictions(prev => prev.filter((_, i) => i !== index))
    }, [])

    // ── Build save payload ──
    const buildSavePayload = useCallback(() => ({
        student_id: studentId,
        training_level: trainingLevel,
        goal,
        available_days: availableDays,
        session_duration_minutes: sessionDuration,
        available_equipment: equipment,
        favorite_exercise_ids: existingProfile?.favorite_exercise_ids || [],
        disliked_exercise_ids: existingProfile?.disliked_exercise_ids || [],
        medical_restrictions: restrictions,
        ai_mode: 'copilot' as const,
        cycle_observation: cycleObservation || undefined,
    }), [studentId, trainingLevel, goal, availableDays, sessionDuration, equipment, restrictions, cycleObservation, existingProfile])

    // ── Save (Estado A only) ──
    const handleSave = useCallback(async () => {
        setError(null)

        if (availableDays.length === 0) {
            setError('Selecione pelo menos 1 dia disponível.')
            return
        }

        setSaving(true)
        try {
            const result = await savePrescriptionProfile(buildSavePayload())

            if (!result.success) {
                setError(result.error || 'Erro ao salvar perfil.')
                return
            }

            if (result.profile) {
                onSaved(result.profile)
                setSaved(true)
            }
        } catch {
            setError('Erro inesperado ao salvar.')
        } finally {
            setSaving(false)
        }
    }, [availableDays, buildSavePayload, onSaved])

    // ── Save & Generate (Estado B) ──
    const handleSaveAndGenerate = useCallback(async () => {
        setError(null)

        if (availableDays.length === 0) {
            setError('Selecione pelo menos 1 dia disponível.')
            return
        }

        setGenerating(true)
        try {
            // 1. Save profile first
            const saveResult = await savePrescriptionProfile(buildSavePayload())

            // 2. If save fails, show error and do NOT proceed
            if (!saveResult.success) {
                setError(saveResult.error || 'Erro ao salvar perfil. Tente novamente.')
                setGenerating(false)
                return
            }

            if (saveResult.profile) {
                onSaved(saveResult.profile)
            }

            // 3. Only then call onGenerate
            onGenerate()
        } catch {
            setError('Erro inesperado ao salvar.')
            setGenerating(false)
        }
    }, [availableDays, buildSavePayload, onSaved, onGenerate])

    // ── Generate (Estado A — profile already saved) ──
    const handleGenerate = useCallback(() => {
        if (!existingProfile) {
            setError('Salve o perfil antes de gerar o programa.')
            return
        }
        onGenerate()
    }, [existingProfile, onGenerate])

    // ── Computed values for context card ──
    const completedSessions = recentSessions.filter(s => s.status === 'completed').length
    const adherenceRate = recentSessions.length > 0
        ? Math.round((completedSessions / recentSessions.length) * 100)
        : 0

    return (
        <div className="space-y-6">
            {/* ══════════════════════════════════════════════════════════════════
                Estado B: Card de contexto (aluno com histórico)
               ══════════════════════════════════════════════════════════════════ */}
            {!isFirstPrescription && (
                <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-violet-500/20 overflow-hidden">
                    <button
                        onClick={() => setContextExpanded(!contextExpanded)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                                <Brain className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-violet-300">
                                    Contexto do Aluno
                                </span>
                                <p className="text-[10px] text-k-text-quaternary">
                                    Dados que a IA vai considerar na prescrição
                                </p>
                            </div>
                        </div>
                        {contextExpanded
                            ? <ChevronUp className="w-4 h-4 text-k-text-quaternary" />
                            : <ChevronDown className="w-4 h-4 text-k-text-quaternary" />
                        }
                    </button>

                    <div
                        className="overflow-hidden transition-all duration-300"
                        style={{ maxHeight: contextExpanded ? '200px' : '0', opacity: contextExpanded ? 1 : 0 }}
                    >
                        <div className="px-6 pb-5 border-t border-violet-500/10 pt-4">
                            <div className="flex flex-wrap gap-3 sm:flex-nowrap sm:items-center sm:divide-x sm:divide-violet-500/10 sm:gap-0">
                                <ContextStat label="Sessões (4 sem)" value={`${recentSessions.length}`} />
                                <ContextStat
                                    label="Aderência"
                                    value={recentSessions.length > 0 ? `${adherenceRate}%` : '—'}
                                    valueClassName={
                                        recentSessions.length === 0 ? undefined
                                        : adherenceRate >= 70 ? 'text-emerald-400'
                                        : adherenceRate >= 40 ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }
                                />
                                <ContextStat label="Programas anteriores" value={`${previousProgramCount}`} />
                                <ContextStat
                                    label="Programa ativo"
                                    value={activeProgram?.name || 'Nenhum'}
                                    indicator={activeProgram ? 'active' : 'none'}
                                />
                                <ContextStat
                                    label="Última avaliação"
                                    value={lastFormSubmissionDate ? formatDate(lastFormSubmissionDate) : 'Nenhuma'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                Formulário principal
               ══════════════════════════════════════════════════════════════════ */}
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-k-border-subtle">
                    <h2 className="text-lg font-bold text-k-text-primary flex items-center gap-2">
                        <User className="w-5 h-5 text-violet-500" />
                        {compactMode && !formExpanded
                            ? 'Configuração Rápida'
                            : isFirstPrescription ? 'Anamnese do Aluno' : 'Configure o próximo ciclo'
                        }
                    </h2>
                    <p className="text-xs text-k-text-tertiary mt-1">
                        {compactMode && !formExpanded
                            ? 'Os formulários do aluno serão usados como contexto. Configure apenas o essencial abaixo.'
                            : isFirstPrescription
                                ? 'Configure o perfil do aluno. O Copiloto usará essas informações para personalizar o programa.'
                                : 'Defina o objetivo e a frequência. A IA vai usar o histórico para personalizar.'
                        }
                    </p>
                    {autoFilledFromQuestionnaire && (
                        <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <Check className="w-3 h-3" />
                            Preenchido com respostas do questionário
                        </span>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* ── Training Level (Estado A only) ── */}
                    {isFirstPrescription && showFullForm && (
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                                <Target className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                                Nível de Treino <span className="text-violet-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                {(Object.entries(TRAINING_LEVEL_LABELS) as [TrainingLevel, string][]).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setTrainingLevel(value)}
                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                            trainingLevel === value
                                                ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                                                : 'bg-glass-bg border-k-border-subtle text-k-text-tertiary hover:border-k-border-primary hover:text-k-text-secondary'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Goal (both states) ── */}
                    {showFullForm && (
                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                            <Target className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                            {isFirstPrescription ? 'Objetivo Principal' : 'Objetivo deste Ciclo'} <span className="text-violet-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(GOAL_LABELS) as [PrescriptionGoal, string][]).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setGoal(value)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                                        goal === value
                                            ? 'bg-violet-500/15 border-violet-500/30 text-violet-400 shadow-md'
                                            : 'bg-glass-bg border-k-border-subtle text-k-text-tertiary hover:border-k-border-primary hover:text-k-text-secondary hover:shadow-sm'
                                    }`}
                                >
                                    <span className="mr-1.5">{GOAL_EMOJIS[value]}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* ── Medical Restrictions (Estado A only) ── */}
                    {isFirstPrescription && showFullForm && (
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                                <ShieldAlert className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                                Restrições Físicas
                            </label>

                            {restrictions.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {restrictions.map((r, i) => (
                                        <div
                                            key={i}
                                            className={`px-3 py-2 rounded-xl border text-sm ${
                                                r.severity === 'severe'
                                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                                    : r.severity === 'moderate'
                                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="flex-1">{r.description}</span>
                                                <span className="text-[10px] font-bold opacity-70">
                                                    {r.severity === 'severe' ? 'Grave' : r.severity === 'moderate' ? 'Moderada' : 'Leve'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeRestriction(i)}
                                                    className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {r.restricted_muscle_groups.length > 0 && (
                                                <p className="text-[10px] opacity-60 mt-1">
                                                    Cautela: {r.restricted_muscle_groups.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newRestriction}
                                    onChange={e => setNewRestriction(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRestriction())}
                                    placeholder="Ex: Dor no joelho direito"
                                    className="flex-1 rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-2.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
                                />
                                <select
                                    value={newSeverity}
                                    onChange={e => setNewSeverity(e.target.value as MedicalRestriction['severity'])}
                                    className="rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-sm text-k-text-primary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
                                >
                                    <option value="mild">Leve</option>
                                    <option value="moderate">Moderada</option>
                                    <option value="severe">Grave</option>
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={addRestriction}
                                    disabled={!newRestriction.trim()}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Condition match preview card */}
                            {conditionPreview && (
                                <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <ShieldAlert className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-violet-300">
                                                Condição identificada: {conditionPreview.condition.label}
                                            </p>
                                            {conditionPreview.condition.cautious_muscle_groups.length > 0 && (
                                                <p className="text-xs text-k-text-tertiary mt-1">
                                                    Grupos com cautela: {conditionPreview.condition.cautious_muscle_groups.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {conditionPreview.condition.prescription_rules.length > 0 && (
                                        <ul className="space-y-1 pl-6">
                                            {conditionPreview.condition.prescription_rules.slice(0, 4).map((rule, i) => (
                                                <li key={i} className="text-xs text-k-text-tertiary flex items-start gap-1.5">
                                                    <Check className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                                                    <span>{rule}</span>
                                                </li>
                                            ))}
                                            {conditionPreview.condition.prescription_rules.length > 4 && (
                                                <li className="text-xs text-k-text-quaternary">
                                                    +{conditionPreview.condition.prescription_rules.length - 4} regras adicionais
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={applyConditionSuggestions}
                                            className="bg-violet-600 hover:bg-violet-500 text-white text-xs gap-1.5"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            Aplicar sugestões
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={dismissConditionPreview}
                                            className="text-xs border-k-border-primary text-k-text-tertiary"
                                        >
                                            Ignorar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Equipment (Estado A or compact mode) ── */}
                    {(isFirstPrescription || compactMode) && (
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                                <Dumbbell className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                                Equipamentos Disponíveis
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {EQUIPMENT_OPTIONS.map(eq => (
                                    <button
                                        key={eq}
                                        type="button"
                                        onClick={() => toggleEquipment(eq)}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                            equipment.includes(eq)
                                                ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                                                : 'bg-glass-bg border-k-border-subtle text-k-text-tertiary hover:border-k-border-primary hover:text-k-text-secondary'
                                        }`}
                                    >
                                        {EQUIPMENT_LABELS[eq] || eq}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Separator for "Este Ciclo" section in Estado A ── */}
                    {isFirstPrescription && showFullForm && (
                        <div className="border-t border-k-border-subtle pt-4">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-k-text-quaternary">
                                Este Ciclo
                            </span>
                        </div>
                    )}

                    {/* ── Available Days (both states) ── */}
                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                            <Calendar className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                            Dias Disponíveis <span className="text-violet-500">*</span>
                        </label>
                        <div className="flex gap-1.5">
                            {DAY_LABELS.map((label, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => toggleDay(index)}
                                    className={`flex-1 px-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 border ${
                                        availableDays.includes(index)
                                            ? 'bg-violet-600 border-violet-500 text-white scale-105'
                                            : 'bg-glass-bg border-k-border-subtle text-k-text-quaternary hover:border-k-border-primary hover:text-k-text-tertiary'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                            {availableDays.length > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/15 text-violet-400">
                                    {availableDays.length} dia{availableDays.length !== 1 ? 's' : ''}/semana
                                </span>
                            ) : (
                                <span className="text-[11px] text-k-text-quaternary">
                                    Selecione os dias disponíveis
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Session Duration (Estado A or compact mode) ── */}
                    {(isFirstPrescription || compactMode) && (
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                                <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                                Duração da Sessão (minutos)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={30}
                                    max={120}
                                    step={15}
                                    value={sessionDuration}
                                    onChange={e => setSessionDuration(Number(e.target.value))}
                                    className="flex-1 accent-violet-600 h-2"
                                />
                                <span className="w-12 text-center text-sm font-bold text-violet-400 bg-violet-500/10 rounded-lg px-2 py-1 border border-violet-500/20">
                                    {sessionDuration}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── Cycle Observation (both states) ── */}
                    {showFullForm && (
                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary">
                            <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                            Instruções adicionais
                        </label>
                        <textarea
                            value={cycleObservation}
                            onChange={e => setCycleObservation(e.target.value)}
                            placeholder="Ex: foco em posterior de coxa, evitar exercícios com barra, lesão no ombro direito..."
                            rows={3}
                            className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 resize-none transition-all"
                        />
                        <p className="text-[11px] text-k-text-quaternary mt-1">
                            (opcional) A IA vai considerar estas instruções na montagem
                        </p>
                    </div>
                    )}

                    {/* ── Toggle full form in compact mode ── */}
                    {compactMode && (
                        <button
                            type="button"
                            onClick={() => setFormExpanded(!formExpanded)}
                            className="w-full text-center text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors py-2"
                        >
                            {formExpanded ? (
                                <span className="flex items-center justify-center gap-1.5">
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    Ocultar campos adicionais
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-1.5">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    Personalizar nível, objetivo e restrições
                                </span>
                            )}
                        </button>
                    )}

                    {/* ── Actions ── */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-2">
                        {isFirstPrescription && !compactMode ? (
                            <>
                                {/* Estado A: Salvar + Gerar separados */}
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || availableDays.length === 0}
                                    variant="outline"
                                    className="border-k-border-primary text-k-text-secondary gap-2"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : saved ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Perfil'}
                                </Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!existingProfile || availableDays.length === 0}
                                    className="bg-violet-600 hover:bg-violet-500 text-white gap-2 w-full sm:w-auto group"
                                    title={!existingProfile ? 'Salve o perfil primeiro' : availableDays.length === 0 ? 'Selecione pelo menos 1 dia' : undefined}
                                >
                                    <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                                    Gerar Programa
                                </Button>
                            </>
                        ) : (
                            /* Estado B: Botão único que salva e gera */
                            <Button
                                onClick={handleSaveAndGenerate}
                                disabled={generating || availableDays.length === 0}
                                className="bg-violet-600 hover:bg-violet-500 text-white gap-2 w-full sm:w-auto group"
                                title={availableDays.length === 0 ? 'Selecione pelo menos 1 dia' : undefined}
                            >
                                {generating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                                )}
                                {generating ? 'Preparando...' : 'Gerar Programa'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Context stat helper (Estado B card)
// ============================================================================

function ContextStat({ label, value, valueClassName, indicator }: {
    label: string
    value: string
    valueClassName?: string
    indicator?: 'active' | 'none'
}) {
    return (
        <div className="flex-1 min-w-[calc(50%-6px)] sm:min-w-0 px-3 sm:px-4 py-2">
            <p className="text-[10px] font-medium text-k-text-quaternary truncate">{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
                {indicator === 'active' && (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
                {indicator === 'none' && (
                    <div className="w-2 h-2 rounded-full bg-k-text-quaternary/40 flex-shrink-0" />
                )}
                <p className={`text-2xl font-bold truncate ${valueClassName || 'text-k-text-primary'}`}>
                    {value}
                </p>
            </div>
        </div>
    )
}
