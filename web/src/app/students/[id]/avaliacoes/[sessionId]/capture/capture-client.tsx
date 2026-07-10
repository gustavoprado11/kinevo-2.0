'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { MeasurementWizardWeb, type RangePromptState } from '@/components/assessments/capture/MeasurementWizardWeb'
import { NumericUnitInputWeb } from '@/components/assessments/capture/NumericUnitInputWeb'
import { BilateralNumericInputWeb } from '@/components/assessments/capture/BilateralNumericInputWeb'
import { MultiAttemptInputWeb } from '@/components/assessments/capture/MultiAttemptInputWeb'
import { ComputedDisplayWeb } from '@/components/assessments/capture/ComputedDisplayWeb'
import { ProtocolWizardWeb } from '@/components/assessments/capture/ProtocolWizardWeb'
import {
    loadCaptureDraft,
    saveCaptureDraft,
    clearCaptureDraft,
} from '@/components/assessments/capture/capture-draft'
import {
    buildComputedMetricsFromSchema,
    detectProtocol,
    evaluateComputed,
    extractSkinfoldsForEngine,
    pickHeightM,
    pickWeightKg,
    readSubjectContext,
} from '@/lib/assessment-computed'
import { saveAssessmentMeasurements } from '@/actions/assessments/save-measurements'
import { finalizeAssessmentSession } from '@/actions/assessments/finalize-session'
import {
    calculateBodyComposition,
    FormulaInputError,
    type BodyCompositionInput,
} from '@kinevo/shared/lib/assessment-protocols'
import type {
    AssessmentTemplateSchema,
    AssessmentTest,
    AssessmentSection,
    AssessmentProtocol,
    ComputedMetrics,
    MeasurementInput,
} from '@kinevo/shared/types/assessments'

interface CaptureClientProps {
    studentId: string
    sessionId: string
    studentName: string
    studentAvatar: string | null
    templateTitle: string
    schema: AssessmentTemplateSchema
    initialMeasurements: MeasurementInput[]
    notes: string | null
}

type FlatTest = AssessmentTest & { section_title: string }

// M10B — orquestrador do MeasurementWizardWeb. State machine sequencial
// pelos flatTests do schema. Mantém measurements local (hydrate de server +
// localStorage draft), commit por step, finalize chama saveAssessmentMeasurements
// + finalizeAssessmentSession e redireciona pra /result.
export function CaptureClient({
    studentId,
    sessionId,
    studentName,
    studentAvatar,
    templateTitle,
    schema,
    initialMeasurements,
    notes,
}: CaptureClientProps) {
    const router = useRouter()
    const { toast } = useToast()

    // Hydrate: prioriza localStorage draft (mais recente que server), senão usa server payload.
    const [measurements, setMeasurements] = useState<MeasurementInput[]>(() => {
        if (typeof window === 'undefined') return initialMeasurements
        const draft = loadCaptureDraft(sessionId)
        return draft ?? initialMeasurements
    })
    const [stepIdx, setStepIdx] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [rangePrompt, setRangePrompt] = useState<RangePromptState | undefined>(undefined)

    // Auto-save draft em cada mutation
    useEffect(() => {
        saveCaptureDraft(sessionId, measurements)
    }, [sessionId, measurements])

    const flatTests: FlatTest[] = useMemo(() => {
        const out: FlatTest[] = []
        for (const sec of (schema.sections ?? []) as AssessmentSection[]) {
            for (const t of sec.tests ?? []) {
                out.push({ ...t, section_title: sec.title })
            }
        }
        return out
    }, [schema])

    const totalSteps = flatTests.length
    const currentTest = flatTests[stepIdx]
    const isLast = stepIdx === totalSteps - 1

    // Append measurement(s), substituindo entries com mesmo test_id quando o
    // trainer refaz uma medição (last-write-wins por test_id).
    const commitMeasurements = useCallback((rows: MeasurementInput[]) => {
        const testId = (rows[0]?.raw_input as { test_id?: string } | null | undefined)?.test_id
        setMeasurements(prev => {
            const filtered = testId
                ? prev.filter(m => (m.raw_input as { test_id?: string } | null | undefined)?.test_id !== testId)
                : prev
            return [...filtered, ...rows]
        })
    }, [])

    const advance = useCallback(() => {
        if (stepIdx < totalSteps - 1) {
            setStepIdx(i => i + 1)
        }
    }, [stepIdx, totalSteps])

    const goBack = useCallback(() => {
        if (stepIdx > 0) {
            setStepIdx(i => i - 1)
        } else {
            router.push(`/students/${studentId}/avaliacoes/${sessionId}`)
        }
    }, [stepIdx, router, studentId, sessionId])

    const handleFinalize = useCallback(async () => {
        if (submitting) return
        setSubmitting(true)
        try {
            // 1. Save measurements
            const saveResult = await saveAssessmentMeasurements({ sessionId, measurements })
            if (!saveResult.success) {
                toast({ type: 'error', message: saveResult.error ?? 'Erro ao salvar medições' })
                return
            }

            // 2. Build computed metrics (BMI, RCQ from template)
            let metrics: ComputedMetrics = buildComputedMetricsFromSchema(schema, measurements)

            // 3. Run body composition engine when sex/age + protocol + skinfolds are present
            const ctx = readSubjectContext(measurements)
            const weight = pickWeightKg(measurements)
            const height = pickHeightM(measurements)
            const protocolId = ctx.sex
                ? detectProtocol(schema, measurements, ctx.sex)
                : null

            if (protocolId && ctx.sex && ctx.age_years && weight && height) {
                const skinfolds_mm = extractSkinfoldsForEngine(measurements)
                const engineInput: BodyCompositionInput = {
                    protocol: protocolId as AssessmentProtocol,
                    anthropometric: {
                        weight_kg: weight,
                        height_m: height,
                        age_years: ctx.age_years,
                        sex: ctx.sex,
                    },
                    skinfolds_mm,
                }
                try {
                    const r = calculateBodyComposition(engineInput)
                    metrics = {
                        ...metrics,
                        body_density: r.body_density ?? undefined,
                        body_fat_percent: r.body_fat_percent,
                        fat_mass_kg: r.fat_mass_kg,
                        lean_mass_kg: r.lean_mass_kg,
                    }
                } catch (err) {
                    if (err instanceof FormulaInputError) {
                        toast({
                            type: 'error',
                            message: `Verifique os valores: ${err.field}`,
                        })
                        // Continua finalizando com BMI/RCQ — mesmo comportamento do mobile.
                    } else {
                        throw err
                    }
                }
            }

            // 4. Finalize
            const finalizeResult = await finalizeAssessmentSession({
                sessionId,
                computedMetrics: metrics,
                notes: notes,
            })
            if (!finalizeResult.success) {
                toast({ type: 'error', message: finalizeResult.error ?? 'Erro ao finalizar avaliação' })
                return
            }

            // 5. Cleanup local + redirect
            clearCaptureDraft(sessionId)
            toast({ type: 'success', message: 'Avaliação concluída' })
            router.replace(`/students/${studentId}/avaliacoes/${sessionId}/result`)
        } catch (err) {
            console.error('[capture-client] finalize error:', err)
            toast({
                type: 'error',
                message: err instanceof Error ? err.message : 'Erro inesperado ao finalizar',
            })
        } finally {
            setSubmitting(false)
        }
    }, [submitting, sessionId, measurements, schema, notes, studentId, router, toast])

    // ─── Per-step canAdvance + render ────────────────────────────
    const stepRender = useMemo(() => {
        if (!currentTest) {
            return { canAdvance: false, content: null as React.ReactNode }
        }
        return renderStep(currentTest, measurements, commitMeasurements, setRangePrompt)
    }, [currentTest, measurements, commitMeasurements])

    if (totalSteps === 0) {
        return (
            <div className="mx-auto max-w-2xl py-12 text-center">
                <h2 className="text-base font-semibold text-k-text-primary">Template vazio</h2>
                <p className="mt-2 text-sm text-k-text-tertiary">
                    Esse template não tem testes. Volte ao detalhe da sessão pra editar.
                </p>
                <button
                    type="button"
                    onClick={() => router.push(`/students/${studentId}/avaliacoes/${sessionId}`)}
                    className="mt-4 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
                >
                    Voltar
                </button>
            </div>
        )
    }

    return (
        <MeasurementWizardWeb
            title={currentTest!.section_title + ' · ' + currentTest!.label}
            subtitle={`${studentName} — ${templateTitle}`}
            stepIndex={stepIdx}
            totalSteps={totalSteps}
            canAdvance={stepRender.canAdvance && !submitting}
            onPrev={goBack}
            onNext={isLast ? handleFinalize : advance}
            isLast={isLast}
            rangePrompt={rangePrompt}
        >
            {/* key por teste: sem isso o React reusa a instância do input entre
                steps do mesmo tipo e o valor digitado vazava pro step seguinte. */}
            <Fragment key={currentTest!.id}>{stepRender.content}</Fragment>
        </MeasurementWizardWeb>
    )
}

// Per-test rendering helper. Returns content + whether the wizard can advance
// from this step (drives the "Próximo" enable state).
function renderStep(
    test: FlatTest,
    measurements: MeasurementInput[],
    commit: (rows: MeasurementInput[]) => void,
    setRangePrompt: (p: RangePromptState | undefined) => void,
): { canAdvance: boolean; content: React.ReactNode } {
    const captured = measurementsForTest(measurements, test.id)

    switch (test.type) {
        case 'numeric_unit': {
            const initial = captured[0]?.value_numeric ?? null
            const isCommitted = captured.length > 0
            return {
                canAdvance: isCommitted,
                content: (
                    <NumericUnitInputWeb
                        test_id={test.id}
                        metric_key={test.metric_key}
                        label={test.label}
                        unit={test.unit}
                        hint={test.hint}
                        warn_below={test.min}
                        warn_above={test.max}
                        initialValue={initial}
                        onCommit={m => commit([m])}
                    />
                ),
            }
        }
        case 'bilateral_numeric': {
            const left = captured.find(m => m.side === 'left')?.value_numeric ?? null
            const right = captured.find(m => m.side === 'right')?.value_numeric ?? null
            const isCommitted = captured.length >= 2
            return {
                canAdvance: isCommitted,
                content: (
                    <BilateralNumericInputWeb
                        test_id={test.id}
                        metric_key={test.metric_key}
                        label={test.label}
                        unit={test.unit}
                        initialLeft={left}
                        initialRight={right}
                        onCommit={rows => commit(rows)}
                        onValidChange={(valid, lr) => {
                            if (valid && lr) {
                                // Auto-commit: ambos preenchidos → grava no estado pra advance liberar.
                                commit([
                                    {
                                        metric_key: test.metric_key,
                                        value_numeric: lr.left,
                                        value_unit: test.unit,
                                        side: 'left',
                                        attempt_number: 1,
                                        is_selected: true,
                                        raw_input: { test_id: test.id },
                                    },
                                    {
                                        metric_key: test.metric_key,
                                        value_numeric: lr.right,
                                        value_unit: test.unit,
                                        side: 'right',
                                        attempt_number: 1,
                                        is_selected: true,
                                        raw_input: { test_id: test.id },
                                    },
                                ])
                            }
                        }}
                    />
                ),
            }
        }
        case 'multi_attempt_numeric': {
            const initialAttempts = captured
                .map(m => m.value_numeric as number)
                .filter(n => Number.isFinite(n))
            const isCommitted = captured.length >= test.attempts
            return {
                canAdvance: isCommitted,
                content: (
                    <MultiAttemptInputWeb
                        test_id={test.id}
                        metric_key={test.metric_key}
                        label={test.label}
                        unit={test.unit}
                        attempts={test.attempts}
                        selection_strategy={test.selection_strategy}
                        initialAttempts={initialAttempts}
                        onCommit={rows => commit(rows)}
                    />
                ),
            }
        }
        case 'computed': {
            const r = evaluateComputed(test, measurements)
            return {
                // Computed steps "advance" sempre — não exigem commit (medição vem dos inputs).
                canAdvance: true,
                content: (
                    <ComputedDisplayWeb
                        label={test.label}
                        value={r.value}
                        formula_label={test.formula_id}
                        description={r.error ?? undefined}
                    />
                ),
            }
        }
        case 'protocol': {
            const ctx = readSubjectContext(measurements)
            if (!ctx.sex) {
                return {
                    canAdvance: false,
                    content: (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                            Sexo biológico do aluno não foi informado na criação da sessão.
                            Cancele e crie uma nova avaliação com sexo definido.
                        </div>
                    ),
                }
            }
            // Initial values (skinfolds já capturados pra esse protocol)
            const initialValues: Record<string, number> = {}
            for (const m of measurements) {
                if (!m.metric_key.startsWith('skinfold_')) continue
                if (typeof m.value_numeric !== 'number') continue
                const site = m.metric_key.slice('skinfold_'.length)
                initialValues[site] = m.value_numeric
            }
            const isCommitted = (measurements.filter(m => m.metric_key.startsWith('skinfold_')).length) > 0
            return {
                canAdvance: isCommitted,
                content: (
                    <ProtocolWizardWeb
                        test_id={test.id}
                        protocol={test.protocol}
                        sex={ctx.sex}
                        label={test.label}
                        initialValues={initialValues as Partial<Record<import('@kinevo/shared/lib/assessment-protocols').SkinfoldSite, number>>}
                        onCommit={rows => commit(rows)}
                    />
                ),
            }
        }
        default: {
            const _exhaustive: never = test
            return { canAdvance: true, content: <div /> }
        }
    }

    // Suppress unused `setRangePrompt` warning — reserved pra futuras
    // confirmações range warning.
    void setRangePrompt
}

function measurementsForTest(measurements: MeasurementInput[], testId: string): MeasurementInput[] {
    return measurements.filter(m =>
        (m.raw_input as { test_id?: string } | null | undefined)?.test_id === testId,
    )
}
