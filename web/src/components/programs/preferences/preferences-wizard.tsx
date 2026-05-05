'use client'

/**
 * Wizard de onboarding das preferências de prescrição (4 passos).
 *
 * Mapping Step 1 → patch (campos visíveis + load_method):
 *
 *   Séries     → visible_fields += 'sets'
 *   Reps       → visible_fields += 'reps'
 *   Carga (kg) → visible_fields += 'load' (load_method candidato: 'kg')
 *   %1RM       → visible_fields += 'load' (load_method candidato: 'percent_1rm')
 *   RIR        → visible_fields += 'rir'
 *   RPE        → visible_fields += 'rpe'
 *   Cadência   → visible_fields += 'tempo'
 *   Descanso   → visible_fields += 'rest'
 *
 * Heurística de load_method: se EXATAMENTE um entre {kg, %1RM} foi
 * escolhido, usa ele. Caso contrário (zero ou ambos), preserva o
 * load_method atual. RIR/RPE não mexem em load_method (apenas adicionam
 * campos visíveis).
 *
 * Step 2: Descanso tem entrada única que copia para rest_compound_seconds
 * E rest_isolation_seconds. Refinamento de faixa fica em "Padrões de série".
 *
 * Estado: o wizard mantém os 4 valores em useState local. Só persiste no
 * "Concluir" ou "Pular" — não toca a store durante navegação.
 */

import { AnimatePresence, motion } from 'framer-motion'
import {
    Check,
    FileText,
    GitCompareArrows,
    ListChecks,
    Loader2,
    SlidersHorizontal,
    Smartphone,
    SquareDashed,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { markWizard } from '@/actions/trainer/mark-wizard-completed'
import { updatePrescriptionPreferences } from '@/actions/trainer/update-prescription-preferences'
import { useToast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import { Z } from '@/lib/z-index'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type {
    AddExerciseMode,
    DefaultView,
    DeepPartial,
    LoadMethod,
    PrescriptionPreferences,
    VisibleField,
} from '@/types/prescription-preferences'
import { ChipRow, type ChipOption } from './chip-row'

type WizardField =
    | 'Séries'
    | 'Reps'
    | 'Carga (kg)'
    | '%1RM'
    | 'RIR'
    | 'RPE'
    | 'Cadência'
    | 'Descanso'

const FIELD_OPTIONS: ChipOption<WizardField>[] = [
    { value: 'Séries', label: 'Séries' },
    { value: 'Reps', label: 'Reps' },
    { value: 'Carga (kg)', label: 'Carga (kg)' },
    { value: '%1RM', label: '%1RM' },
    { value: 'RIR', label: 'RIR' },
    { value: 'RPE', label: 'RPE' },
    { value: 'Cadência', label: 'Cadência' },
    { value: 'Descanso', label: 'Descanso' },
]

const SCHEME_PATTERN = /^\d+(-\d+)?$/

function preferencesToWizardFields(prefs: PrescriptionPreferences): WizardField[] {
    const out: WizardField[] = []
    const vf = prefs.set_defaults.visible_fields
    if (vf.includes('sets')) out.push('Séries')
    if (vf.includes('reps')) out.push('Reps')
    if (vf.includes('load')) {
        out.push(prefs.set_defaults.load_method === 'percent_1rm' ? '%1RM' : 'Carga (kg)')
    }
    if (vf.includes('rir')) out.push('RIR')
    if (vf.includes('rpe')) out.push('RPE')
    if (vf.includes('tempo')) out.push('Cadência')
    if (vf.includes('rest')) out.push('Descanso')
    return out
}

function deriveStep1Patch(
    selected: WizardField[],
    currentLoadMethod: LoadMethod,
): { visible_fields: VisibleField[]; load_method: LoadMethod } {
    const setOfFields = new Set<VisibleField>()
    let kgPicked = false
    let percentPicked = false

    for (const f of selected) {
        switch (f) {
            case 'Séries': setOfFields.add('sets'); break
            case 'Reps': setOfFields.add('reps'); break
            case 'Carga (kg)': setOfFields.add('load'); kgPicked = true; break
            case '%1RM': setOfFields.add('load'); percentPicked = true; break
            case 'RIR': setOfFields.add('rir'); break
            case 'RPE': setOfFields.add('rpe'); break
            case 'Cadência': setOfFields.add('tempo'); break
            case 'Descanso': setOfFields.add('rest'); break
        }
    }

    let load_method: LoadMethod = currentLoadMethod
    if (kgPicked && !percentPicked) load_method = 'kg'
    else if (percentPicked && !kgPicked) load_method = 'percent_1rm'

    return { visible_fields: Array.from(setOfFields), load_method }
}

interface BigCardOption<T extends string> {
    value: T
    title: string
    subtitle: string
    icon: React.ReactNode
}

function BigCardGrid<T extends string>({
    options,
    value,
    onChange,
    columns = 2,
}: {
    options: BigCardOption<T>[]
    value: T
    onChange: (next: T) => void
    columns?: number
}) {
    return (
        <div
            role="radiogroup"
            className={`grid gap-3 ${columns === 2 ? 'grid-cols-2' : ''}`}
        >
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(opt.value)}
                        className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-colors duration-150 ${
                            active
                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                                : 'border-k-border-subtle bg-surface-card hover:border-k-border-primary'
                        }`}
                    >
                        <div className={`${active ? 'text-violet-600 dark:text-violet-400' : 'text-k-text-tertiary'}`}>
                            {opt.icon}
                        </div>
                        <div className="space-y-0.5">
                            <p className={`text-sm font-medium ${active ? 'text-k-text-primary' : 'text-k-text-primary'}`}>
                                {opt.title}
                            </p>
                            <p className="text-xs text-k-text-tertiary">{opt.subtitle}</p>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

const STEP_COUNT = 4

export function PreferencesWizard() {
    const isOpen = usePrescriptionPreferencesStore((s) => s.isWizardOpen)
    const closeWizard = usePrescriptionPreferencesStore((s) => s.closeWizard)
    const preferences = usePrescriptionPreferencesStore((s) => s.preferences)
    const { toast } = useToast()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)

    // Estado local — só persiste no Concluir/Pular.
    const [step, setStep] = useState(1)
    const [selectedFields, setSelectedFields] = useState<WizardField[]>([])
    const [setsValue, setSetsValue] = useState('3')
    const [repsValue, setRepsValue] = useState('10')
    const [restValue, setRestValue] = useState('60')
    const [selectedMode, setSelectedMode] = useState<AddExerciseMode>('simplified')
    const [selectedView, setSelectedView] = useState<DefaultView>('preview')
    const [isSaving, setIsSaving] = useState(false)

    // Pre-população + reset ao abrir.
    const [wasOpen, setWasOpen] = useState(false)
    if (isOpen && !wasOpen) {
        setWasOpen(true)
        setStep(1)
        setSelectedFields(preferencesToWizardFields(preferences))
        setSetsValue(preferences.set_defaults.sets)
        setRepsValue(preferences.set_defaults.reps)
        setRestValue(String(preferences.set_defaults.rest_compound_seconds))
        setSelectedMode(preferences.add_exercise.open_mode)
        setSelectedView(preferences.visualization.default_view)
    } else if (!isOpen && wasOpen) {
        setWasOpen(false)
    }

    // Foco e ESC.
    useEffect(() => {
        if (!isOpen) return

        previousFocusRef.current = document.activeElement as HTMLElement | null

        const focusTimer = setTimeout(() => {
            const first = containerRef.current?.querySelector<HTMLElement>(
                'button[role="radio"], button[role="checkbox"], input',
            )
            first?.focus()
        }, 60)

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                void handleSkip()
            }
        }
        window.addEventListener('keydown', onKeyDown)

        return () => {
            window.removeEventListener('keydown', onKeyDown)
            clearTimeout(focusTimer)
            previousFocusRef.current?.focus()
        }
        // handleSkip muda referência a cada render, mas não queremos reanexar
        // o listener — capturamos via closure que chama o último estado.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Validação Step 2.
    const setsValid = SCHEME_PATTERN.test(setsValue.trim())
    const repsValid = SCHEME_PATTERN.test(repsValue.trim())
    const restNum = Number(restValue)
    const restValid = Number.isInteger(restNum) && restNum >= 0 && restNum <= 600
    const step2Valid = setsValid && repsValid && restValid

    const canAdvance = step === 2 ? step2Valid : true

    const handleSkip = async () => {
        if (isSaving) return
        track('prescription_preferences_wizard_skipped', { step })
        closeWizard()
        // Marca dismissed no servidor + atualiza store.
        const result = await markWizard('dismissed')
        if (result.success) {
            usePrescriptionPreferencesStore.getState().setPreferences(result.preferences)
        }
    }

    const handleComplete = async () => {
        if (isSaving) return
        track('prescription_preferences_wizard_completed')
        setIsSaving(true)
        const previous = usePrescriptionPreferencesStore.getState().preferences

        const step1 = deriveStep1Patch(selectedFields, previous.set_defaults.load_method)
        const restSeconds = Number(restValue)

        const patch: DeepPartial<PrescriptionPreferences> = {
            set_defaults: {
                sets: setsValue.trim(),
                reps: repsValue.trim(),
                rest_compound_seconds: restSeconds,
                rest_isolation_seconds: restSeconds,
                visible_fields: step1.visible_fields,
                load_method: step1.load_method,
            },
            add_exercise: {
                open_mode: selectedMode,
            },
            visualization: {
                default_view: selectedView,
            },
        }

        try {
            const result = await updatePrescriptionPreferences(patch)
            if (!result.success) {
                toast({ type: 'error', message: result.message ?? 'Erro ao salvar wizard.' })
                return
            }

            const wizardResult = await markWizard('completed')
            if (wizardResult.success) {
                usePrescriptionPreferencesStore.getState().setPreferences(wizardResult.preferences)
            } else {
                usePrescriptionPreferencesStore.getState().setPreferences(result.preferences)
            }
            closeWizard()
            toast({
                message: 'Tudo pronto. Você pode mudar isso a qualquer momento na engrenagem.',
            })
        } finally {
            setIsSaving(false)
        }
    }

    const goNext = () => {
        if (!canAdvance) return
        if (step < STEP_COUNT) setStep((s) => s + 1)
    }

    const isLastStep = step === STEP_COUNT

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center px-4"
                    style={{ zIndex: Z.TOPMOST }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="preferences-wizard-title"
                >
                    <motion.div
                        className="absolute inset-0 bg-black/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    />
                    <motion.div
                        ref={containerRef}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-[520px] bg-surface-card border border-k-border-primary rounded-2xl shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <header className="px-6 pt-6 pb-2">
                            <p className="text-xs text-k-text-tertiary uppercase tracking-wider">
                                Passo {step} de {STEP_COUNT}
                            </p>
                            <h2 id="preferences-wizard-title" className="text-lg font-medium text-k-text-primary mt-1">
                                {step === 1 && 'Quais campos você usa?'}
                                {step === 2 && 'Seus valores padrão'}
                                {step === 3 && 'Ao adicionar um exercício, prefere ver:'}
                                {step === 4 && 'Sua view favorita pra trabalhar:'}
                            </h2>
                        </header>

                        {/* Body */}
                        <div className="px-6 py-4">
                            {step === 1 && (
                                <div className="space-y-3">
                                    <ChipRow
                                        multi
                                        options={FIELD_OPTIONS}
                                        value={selectedFields}
                                        onChange={(next) => setSelectedFields(next)}
                                        ariaLabel="Campos da prescrição"
                                    />
                                    <p className="text-xs text-k-text-tertiary">
                                        Você pode mudar a qualquer momento na engrenagem.
                                    </p>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label htmlFor="wiz-sets" className="text-xs text-k-text-tertiary">Séries</label>
                                            <input
                                                id="wiz-sets"
                                                type="text"
                                                value={setsValue}
                                                onChange={(e) => setSetsValue(e.target.value)}
                                                className={`w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${setsValid ? 'border-k-border-subtle' : 'border-red-500'}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label htmlFor="wiz-reps" className="text-xs text-k-text-tertiary">Reps</label>
                                            <input
                                                id="wiz-reps"
                                                type="text"
                                                value={repsValue}
                                                onChange={(e) => setRepsValue(e.target.value)}
                                                className={`w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${repsValid ? 'border-k-border-subtle' : 'border-red-500'}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label htmlFor="wiz-rest" className="text-xs text-k-text-tertiary">Descanso (s)</label>
                                            <input
                                                id="wiz-rest"
                                                type="number"
                                                min={0}
                                                max={600}
                                                value={restValue}
                                                onChange={(e) => setRestValue(e.target.value)}
                                                className={`w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${restValid ? 'border-k-border-subtle' : 'border-red-500'}`}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-k-text-tertiary">
                                        Faixas (ex: 3–4 séries) você configura nas Preferências quando quiser refinar.
                                    </p>
                                </div>
                            )}

                            {step === 3 && (
                                <BigCardGrid<AddExerciseMode>
                                    value={selectedMode}
                                    onChange={setSelectedMode}
                                    options={[
                                        {
                                            value: 'simplified',
                                            title: 'Simplificado',
                                            subtitle: 'Faixa única (ex: 3×8-12).',
                                            icon: <SquareDashed className="w-6 h-6" />,
                                        },
                                        {
                                            value: 'set_editor',
                                            title: 'Editor de séries',
                                            subtitle: 'Cada série configurada individualmente.',
                                            icon: <SlidersHorizontal className="w-6 h-6" />,
                                        },
                                    ]}
                                />
                            )}

                            {step === 4 && (
                                <BigCardGrid<DefaultView>
                                    value={selectedView}
                                    onChange={setSelectedView}
                                    options={[
                                        {
                                            value: 'preview',
                                            title: 'Mock do celular',
                                            subtitle: 'Pré-visualização do app do aluno.',
                                            icon: <Smartphone className="w-6 h-6" />,
                                        },
                                        {
                                            value: 'compare',
                                            title: 'Comparador',
                                            subtitle: 'Lado a lado com programa anterior.',
                                            icon: <GitCompareArrows className="w-6 h-6" />,
                                        },
                                        {
                                            value: 'ai_prescribe',
                                            title: 'Texto',
                                            subtitle: 'Texto livre pra prescrição.',
                                            icon: <FileText className="w-6 h-6" />,
                                        },
                                        {
                                            value: 'normal',
                                            title: 'Checklist',
                                            subtitle: 'Editor padrão de itens.',
                                            icon: <ListChecks className="w-6 h-6" />,
                                        },
                                    ]}
                                />
                            )}
                        </div>

                        {/* Footer */}
                        <footer className="flex items-center justify-between px-6 py-4 border-t border-k-border-subtle">
                            <button
                                type="button"
                                onClick={() => void handleSkip()}
                                disabled={isSaving}
                                className="text-sm text-k-text-tertiary hover:text-k-text-primary transition-colors duration-150 disabled:opacity-50"
                            >
                                Pular
                            </button>

                            <div className="flex items-center gap-1.5" aria-label={`Passo ${step} de ${STEP_COUNT}`}>
                                {Array.from({ length: STEP_COUNT }).map((_, i) => (
                                    <span
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full ${
                                            i + 1 <= step ? 'bg-violet-600' : 'bg-k-border-primary'
                                        }`}
                                    />
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={isLastStep ? () => void handleComplete() : goNext}
                                disabled={!canAdvance || isSaving}
                                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors duration-150"
                            >
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
                                {isLastStep && !isSaving && <Check className="w-3.5 h-3.5" aria-hidden />}
                                {isLastStep ? 'Concluir' : 'Próximo'}
                            </button>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
