'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    User, Target, Calendar, Clock, Dumbbell, ShieldAlert,
    Brain, Save, Loader2, Check, Plus, X, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import { savePrescriptionProfile } from '@/actions/prescription/save-prescription-profile'

import type {
    TrainingLevel,
    PrescriptionGoal,
    AiMode,
    MedicalRestriction,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

import { EQUIPMENT_OPTIONS } from '@kinevo/shared/types/prescription'

// ============================================================================
// Props
// ============================================================================

interface PrescriptionProfileFormProps {
    studentId: string
    existingProfile: StudentPrescriptionProfile | null
    onSaved: (profile: StudentPrescriptionProfile) => void
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

const AI_MODE_LABELS: Record<AiMode, { label: string; desc: string }> = {
    auto: { label: 'Automático', desc: 'IA decide o nível de autonomia' },
    copilot: { label: 'Copiloto', desc: 'IA sugere, você edita' },
    assistant: { label: 'Assistente', desc: 'Você compõe, IA apoia' },
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
// Component
// ============================================================================

export function PrescriptionProfileForm({
    studentId,
    existingProfile,
    onSaved,
}: PrescriptionProfileFormProps) {
    // ── State ──
    const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>(existingProfile?.training_level || 'beginner')
    const [goal, setGoal] = useState<PrescriptionGoal>(existingProfile?.goal || 'hypertrophy')
    const [availableDays, setAvailableDays] = useState<number[]>(existingProfile?.available_days || [])
    const [sessionDuration, setSessionDuration] = useState(existingProfile?.session_duration_minutes || 60)
    const [equipment, setEquipment] = useState<string[]>(existingProfile?.available_equipment || [])
    const [aiMode, setAiMode] = useState<AiMode>(existingProfile?.ai_mode || 'auto')
    const [restrictions, setRestrictions] = useState<MedicalRestriction[]>(existingProfile?.medical_restrictions || [])

    // New restriction form
    const [newRestriction, setNewRestriction] = useState('')
    const [newSeverity, setNewSeverity] = useState<MedicalRestriction['severity']>('mild')

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

    // ── Save ──
    const handleSave = useCallback(async () => {
        setError(null)

        if (availableDays.length === 0) {
            setError('Selecione pelo menos 1 dia disponível.')
            return
        }

        setSaving(true)
        try {
            const result = await savePrescriptionProfile({
                student_id: studentId,
                training_level: trainingLevel,
                goal,
                available_days: availableDays,
                session_duration_minutes: sessionDuration,
                available_equipment: equipment,
                favorite_exercise_ids: [],
                disliked_exercise_ids: [],
                medical_restrictions: restrictions,
                ai_mode: aiMode,
            })

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
    }, [studentId, trainingLevel, goal, availableDays, sessionDuration, equipment, restrictions, aiMode, onSaved])

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-k-border-subtle">
                <h2 className="text-lg font-bold text-k-text-primary flex items-center gap-2">
                    <User className="w-5 h-5 text-violet-500" />
                    Anamnese do Aluno
                </h2>
                <p className="text-xs text-k-text-tertiary mt-1">
                    Preencha o perfil para a IA gerar um programa personalizado.
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Error */}
                {error && (
                    <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* ── Training Level ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
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

                {/* ── Goal ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
                        <Target className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                        Objetivo <span className="text-violet-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(GOAL_LABELS) as [PrescriptionGoal, string][]).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setGoal(value)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                    goal === value
                                        ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                                        : 'bg-glass-bg border-k-border-subtle text-k-text-tertiary hover:border-k-border-primary hover:text-k-text-secondary'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Available Days ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                        Dias Disponíveis <span className="text-violet-500">*</span>
                    </label>
                    <div className="flex gap-1.5">
                        {DAY_LABELS.map((label, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => toggleDay(index)}
                                className={`flex-1 px-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                    availableDays.includes(index)
                                        ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                                        : 'bg-glass-bg border-k-border-subtle text-k-text-quaternary hover:border-k-border-primary hover:text-k-text-tertiary'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-k-text-quaternary mt-1.5">
                        {availableDays.length} dia{availableDays.length !== 1 ? 's' : ''} selecionado{availableDays.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* ── Session Duration ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                        Duração da Sessão (minutos)
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={20}
                            max={120}
                            step={5}
                            value={sessionDuration}
                            onChange={e => setSessionDuration(Number(e.target.value))}
                            className="flex-1 accent-violet-600 h-2"
                        />
                        <span className="w-12 text-center text-sm font-bold text-violet-400 bg-violet-500/10 rounded-lg px-2 py-1 border border-violet-500/20">
                            {sessionDuration}
                        </span>
                    </div>
                </div>

                {/* ── Equipment ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
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

                {/* ── Medical Restrictions ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
                        <ShieldAlert className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                        Restrições Médicas
                    </label>

                    {/* Existing restrictions */}
                    {restrictions.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {restrictions.map((r, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                                        r.severity === 'severe'
                                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                            : r.severity === 'moderate'
                                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                    }`}
                                >
                                    <span className="flex-1">{r.description}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
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
                            ))}
                        </div>
                    )}

                    {/* Add restriction */}
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
                </div>

                {/* ── AI Mode ── */}
                <div>
                    <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest">
                        <Brain className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                        Modo da IA
                    </label>
                    <div className="space-y-2">
                        {(Object.entries(AI_MODE_LABELS) as [AiMode, { label: string; desc: string }][]).map(([value, { label, desc }]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setAiMode(value)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
                                    aiMode === value
                                        ? 'bg-violet-500/15 border-violet-500/30'
                                        : 'bg-glass-bg border-k-border-subtle hover:border-k-border-primary'
                                }`}
                            >
                                <span className={`text-sm font-semibold ${aiMode === value ? 'text-violet-400' : 'text-k-text-secondary'}`}>
                                    {label}
                                </span>
                                <span className="text-xs text-k-text-quaternary ml-2">
                                    {desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Save Button ── */}
                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving || availableDays.length === 0}
                        className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
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
                </div>
            </div>
        </div>
    )
}
