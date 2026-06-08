import React, { useCallback, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/theme';
import * as Haptics from 'expo-haptics';

import { useAssessmentSession } from '../../../../hooks/useAssessmentSession';
import { useAssessmentSessionDraft } from '../../../../hooks/useAssessmentSessionDraft';
import { useAssessmentSessionLifecycle } from '../../../../hooks/useAssessmentSessionLifecycle';
import { useAssessmentDraftStore } from '../../../../stores/assessmentDraftStore';
import { MeasurementWizard, type RangePromptState } from '../../../../components/trainer/assessments/MeasurementWizard';
import { NumericUnitInput } from '../../../../components/trainer/assessments/inputs/NumericUnitInput';
import { BilateralNumericInput } from '../../../../components/trainer/assessments/inputs/BilateralNumericInput';
import { MultiAttemptInput } from '../../../../components/trainer/assessments/inputs/MultiAttemptInput';
import { ComputedDisplay } from '../../../../components/trainer/assessments/inputs/ComputedDisplay';
import { ProtocolWizard } from '../../../../components/trainer/assessments/inputs/ProtocolWizard';
import type { Sex } from '@kinevo/shared/lib/assessment-protocols';
import type {
    AssessmentTemplateSchema,
    AssessmentTest,
    MeasurementInput,
    MeasurementUnit,
} from '@kinevo/shared/types/assessments';
import { evaluateComputed, isComputedReady, readSubjectContext } from '../../../../lib/assessmentComputed';

/** Captures the parsed-but-not-yet-committed payload from each numeric/
 *  bilateral/multi input. The wizard footer button uses this to know
 *  whether it can advance, and to fire the commit. */
type PendingCommit =
    | { kind: 'numeric'; rows: MeasurementInput[]; outOfRange: { reason: 'below' | 'above'; value: number; label: string; unit: string } | null }
    | { kind: 'bilateral'; rows: MeasurementInput[] }
    | { kind: 'multi'; rows: MeasurementInput[] };

export default function MeasureScreen() {
    const router = useRouter();
    const { sessionId, testId } = useLocalSearchParams<{ sessionId: string; testId: string }>();
    const session = useAssessmentSession(sessionId ?? null);
    const draft = useAssessmentSessionDraft(sessionId ?? null);
    const lifecycle = useAssessmentSessionLifecycle();

    const [rangePrompt, setRangePrompt] = useState<RangePromptState | undefined>(undefined);
    const [pending, setPending] = useState<PendingCommit | null>(null);

    const schema: AssessmentTemplateSchema | null = draft.draft?.template_snapshot ?? null;

    const flatTests: AssessmentTest[] = useMemo(() => {
        if (!schema) return [];
        const out: AssessmentTest[] = [];
        for (const sec of schema.sections ?? []) for (const t of sec.tests ?? []) out.push(t);
        return out;
    }, [schema]);

    const stepIndex = useMemo(() => flatTests.findIndex((t) => t.id === testId), [flatTests, testId]);
    const test = stepIndex >= 0 ? flatTests[stepIndex] : null;

    // Reset the pending buffer whenever the active test changes.
    React.useEffect(() => {
        setPending(null);
        setRangePrompt(undefined);
    }, [testId]);

    const goToNextOrBack = useCallback(async () => {
        if (!sessionId) return;
        // Read the current draft from the store directly — the local
        // closure of `draft.draft` is stale because `replaceForTest` was
        // dispatched in the same tick and React hasn't re-rendered yet.
        const fresh = useAssessmentDraftStore.getState().drafts[sessionId];
        if (fresh && fresh.is_dirty) {
            await lifecycle.syncBatch(sessionId, fresh.measurements);
        }
        const nextTest = findNextTest(flatTests, fresh?.measurements ?? [], stepIndex);
        if (nextTest) {
            router.replace({
                pathname: '/assessments/[sessionId]/measure/[testId]',
                params: { sessionId, testId: nextTest.id },
            });
        } else {
            router.replace({ pathname: '/assessments/[sessionId]', params: { sessionId } });
        }
    }, [sessionId, lifecycle, flatTests, stepIndex, router]);

    const commitNumeric = useCallback(
        (rows: MeasurementInput[]) => {
            if (!sessionId || !test) return;
            draft.replaceForTest(test.id, rows);
            setPending(null);
            goToNextOrBack();
        },
        [sessionId, test, draft, goToNextOrBack],
    );

    const commitBilateral = useCallback(
        (rows: MeasurementInput[]) => {
            if (!sessionId || !test) return;
            draft.replaceForTest(test.id, rows);
            setPending(null);
            goToNextOrBack();
        },
        [sessionId, test, draft, goToNextOrBack],
    );

    const commitMulti = useCallback(
        (rows: MeasurementInput[]) => {
            if (!sessionId || !test) return;
            draft.replaceForTest(test.id, rows);
            draft.clearAttempts(test.id);
            setPending(null);
            goToNextOrBack();
        },
        [sessionId, test, draft, goToNextOrBack],
    );

    const commitProtocol = useCallback(
        (rows: MeasurementInput[]) => {
            if (!sessionId || !test) return;
            draft.replaceForTest(test.id, rows);
            goToNextOrBack();
        },
        [sessionId, test, draft, goToNextOrBack],
    );

    /**
     * Wizard "Próximo" handler. Looks at the local pending buffer and
     * commits it; if the value is out-of-range, surfaces the warning modal
     * first. Computed tests advance straight away (read-only).
     */
    const onWizardNext = useCallback(() => {
        if (!test) return;

        if (test.type === 'computed') {
            goToNextOrBack();
            return;
        }

        if (!pending) return;

        if (pending.kind === 'numeric') {
            if (pending.outOfRange) {
                const oor = pending.outOfRange;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                setRangePrompt({
                    visible: true,
                    label: oor.label,
                    value: oor.value,
                    unit: oor.unit,
                    reason: oor.reason,
                    onConfirm: () => {
                        setRangePrompt(undefined);
                        commitNumeric(pending.rows);
                    },
                    onCancel: () => setRangePrompt(undefined),
                });
                return;
            }
            commitNumeric(pending.rows);
            return;
        }

        if (pending.kind === 'bilateral') {
            commitBilateral(pending.rows);
            return;
        }

        if (pending.kind === 'multi') {
            commitMulti(pending.rows);
            return;
        }
    }, [test, pending, commitNumeric, commitBilateral, commitMulti, goToNextOrBack]);

    // M9: "Anterior" salva o valor digitado-mas-não-confirmado no draft antes de
    // voltar (o reset de `pending` ao trocar de teste o descartava). Persiste sem
    // navegar pra frente — diferente dos commit*, que chamam goToNextOrBack.
    const onWizardPrev = useCallback(() => {
        if (test && pending) {
            draft.replaceForTest(test.id, pending.rows);
            if (pending.kind === 'multi') draft.clearAttempts(test.id);
        }
        router.back();
    }, [test, pending, draft, router]);

    // If the remote session vanished, useAssessmentSession already wiped
    // the local draft. Bounce back to /forms — same UX as the checklist.
    React.useEffect(() => {
        if (!session.orphaned) return;
        router.replace('/(trainer-tabs)/forms');
    }, [session.orphaned, router]);

    if (!session.isLoading && !session.detail && !session.orphaned) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary, padding: 24 }}>
                <Text style={{ color: colors.text.secondary }}>Sessão não encontrada</Text>
            </View>
        );
    }
    if (!schema || !test) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary, padding: 24 }}>
                <Text style={{ color: colors.text.secondary }}>Carregando...</Text>
            </View>
        );
    }

    const studentName = (session.detail?.student as { name?: string } | null)?.name ?? '';

    // Protocol uses its own internal navigation; render outside the
    // MeasurementWizard chrome. ProtocolWizard reads sex from the session
    // context measurements.
    if (test.type === 'protocol') {
        const ctx = readSubjectContext(draft.draft?.measurements ?? []);
        const sex: Sex = ctx.sex ?? 'male';
        return (
            <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
                <ProtocolWizard
                    test_id={test.id}
                    protocol={test.protocol}
                    sex={sex}
                    label={test.label}
                    onCommit={commitProtocol}
                    onCancel={() => router.replace({ pathname: '/assessments/[sessionId]', params: { sessionId: sessionId ?? '' } })}
                />
            </View>
        );
    }

    const totalSteps = flatTests.length;
    const isLast = stepIndex === totalSteps - 1;
    const computedReady =
        test.type === 'computed' && isComputedReady(test, draft.draft?.measurements ?? []);
    const canAdvance = test.type === 'computed' ? computedReady : pending !== null;

    return (
        <MeasurementWizard
            title={test.label}
            subtitle={studentName}
            stepIndex={Math.max(0, stepIndex)}
            totalSteps={Math.max(1, totalSteps)}
            canAdvance={canAdvance}
            onPrev={onWizardPrev}
            onNext={onWizardNext}
            isLast={isLast}
            rangePrompt={rangePrompt}>
            {test.type === 'numeric_unit' && (
                <NumericUnitInput
                    test_id={test.id}
                    metric_key={test.metric_key}
                    label={test.label}
                    unit={test.unit}
                    hint={test.hint ?? defaultHintFor(test.metric_key, test.unit)}
                    warn_below={rangeFor(test.metric_key)?.below}
                    warn_above={rangeFor(test.metric_key)?.above}
                    /* `onCommit` still fires from the keyboard's submit. We
                       use it as a shortcut: same code path as the wizard's
                       Próximo button. */
                    onCommit={(m) => {
                        const r = rangeFor(test.metric_key);
                        const v = m.value_numeric;
                        const oor =
                            r && typeof v === 'number' && (v < r.below || v > r.above)
                                ? { reason: (v < r.below ? 'below' : 'above') as 'below' | 'above', value: v, label: test.label, unit: test.unit }
                                : null;
                        setPending({ kind: 'numeric', rows: [m], outOfRange: oor });
                        // Trigger the same flow as Próximo so submit-from-
                        // keyboard works.
                        if (oor) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            setRangePrompt({
                                visible: true,
                                label: oor.label,
                                value: oor.value,
                                unit: oor.unit,
                                reason: oor.reason,
                                onConfirm: () => {
                                    setRangePrompt(undefined);
                                    commitNumeric([m]);
                                },
                                onCancel: () => setRangePrompt(undefined),
                            });
                            return;
                        }
                        commitNumeric([m]);
                    }}
                    /* `onValidParsed` fires on every valid keystroke — keeps
                       the pending buffer (and Próximo button) in sync. */
                    onValidParsed={(value, isOutOfRange) => {
                        const r = rangeFor(test.metric_key);
                        const oor =
                            isOutOfRange && r
                                ? {
                                    reason: (value < r.below ? 'below' : 'above') as 'below' | 'above',
                                    value,
                                    label: test.label,
                                    unit: test.unit,
                                }
                                : null;
                        const m: MeasurementInput = {
                            metric_key: test.metric_key,
                            value_numeric: value,
                            value_unit: test.unit,
                            side: null,
                            attempt_number: 1,
                            is_selected: true,
                            raw_input: { test_id: test.id },
                        };
                        setPending({ kind: 'numeric', rows: [m], outOfRange: oor });
                    }}
                />
            )}

            {test.type === 'bilateral_numeric' && (
                <BilateralNumericInput
                    test_id={test.id}
                    metric_key={test.metric_key}
                    label={test.label}
                    unit={test.unit}
                    onCommit={commitBilateral}
                />
            )}

            {test.type === 'multi_attempt_numeric' && (
                <MultiAttemptInput
                    test_id={test.id}
                    metric_key={test.metric_key}
                    label={test.label}
                    unit={test.unit}
                    attempts={test.attempts}
                    selection_strategy={test.selection_strategy}
                    initialAttempts={draft.draft?.current_attempts[test.id]}
                    onAttemptsChange={(values) => draft.updateAttempts(test.id, values)}
                    onCommit={commitMulti}
                />
            )}

            {test.type === 'computed' && (() => {
                const r = evaluateComputed(test, draft.draft?.measurements ?? []);
                return (
                    <ComputedDisplay
                        label={test.label}
                        formula_label={formulaLabelFor(test.formula_id)}
                        unit={formulaUnitFor(test.formula_id)}
                        value={r.value}
                        description={r.error ?? undefined}
                    />
                );
            })()}
        </MeasurementWizard>
    );
}

function findNextTest(
    tests: AssessmentTest[],
    measurements: MeasurementInput[],
    fromIndex: number,
): AssessmentTest | null {
    const done = new Set<string>();
    for (const m of measurements) {
        const tid = (m.raw_input as { test_id?: string } | null | undefined)?.test_id;
        if (tid) done.add(tid);
    }
    for (let i = fromIndex + 1; i < tests.length; i++) {
        const t = tests[i]!;
        if (t.type === 'computed') continue;     // computed has no measurement
        if (!done.has(t.id)) return t;
    }
    for (let i = 0; i < tests.length; i++) {
        const t = tests[i]!;
        if (t.type === 'computed') continue;
        if (!done.has(t.id)) return t;
    }
    return null;
}

const RANGE_TABLE: Record<string, { below: number; above: number }> = {
    weight: { below: 30, above: 200 },
    height: { below: 1.4, above: 2.2 },
    waist_circumference: { below: 50, above: 150 },
    hip_circumference: { below: 50, above: 160 },
};

function rangeFor(metric_key: string): { below: number; above: number } | undefined {
    if (RANGE_TABLE[metric_key]) return RANGE_TABLE[metric_key];
    if (metric_key.startsWith('skinfold_')) return { below: 0, above: 50 };
    return undefined;
}

function defaultHintFor(metric_key: string, unit: MeasurementUnit | null): string | undefined {
    if (metric_key === 'height' || unit === 'm') {
        return 'Em metros — ex: 1,78 ou 1.78 (vírgula ou ponto OK).';
    }
    if (metric_key === 'weight' || unit === 'kg') {
        return 'Aceita vírgula ou ponto — ex: 75,4 ou 75.4.';
    }
    return undefined;
}

function formulaLabelFor(id: string): string {
    switch (id) {
        case 'bmi': return 'Quetelet';
        case 'rcq': return 'Cintura / quadril';
        default: return id;
    }
}

function formulaUnitFor(id: string): string | undefined {
    switch (id) {
        case 'bmi': return 'kg/m²';
        case 'rcq': return undefined;
        default: return undefined;
    }
}
