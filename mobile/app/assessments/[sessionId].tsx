import React, { useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import { useAssessmentSession } from '../../hooks/useAssessmentSession';
import { useAssessmentSessionDraft } from '../../hooks/useAssessmentSessionDraft';
import { useAssessmentSessionLifecycle } from '../../hooks/useAssessmentSessionLifecycle';
import { useAssessmentDraftStore } from '../../stores/assessmentDraftStore';
import { TestChecklistItem, type TestState } from '../../components/trainer/assessments/TestChecklistItem';
import { SessionStatusBadge } from '../../components/trainer/assessments/SessionStatusBadge';
import { toast } from '../../lib/toast';
import { calculateBodyComposition, FormulaInputError } from '@kinevo/shared/lib/assessment-protocols';
import type { BodyCompositionInput } from '@kinevo/shared/lib/assessment-protocols';
import type {
    AssessmentTemplateSchema,
    AssessmentTest,
    AssessmentSection,
    AssessmentProtocol,
    ComputedMetrics,
    MeasurementInput,
} from '@kinevo/shared/types/assessments';
import {
    buildComputedMetricsFromSchema,
    detectProtocol,
    evaluateComputed,
    extractSkinfoldsForEngine,
    isComputedReady,
    pickHeightM,
    pickWeightKg,
    readSubjectContext,
} from '../../lib/assessmentComputed';

type FlatTest = AssessmentTest & { section_title: string };

export default function SessionScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

    const session = useAssessmentSession(sessionId);
    const draft = useAssessmentSessionDraft(sessionId);
    const lifecycle = useAssessmentSessionLifecycle();

    const upsertDraft = useAssessmentDraftStore((s) => s.upsertDraft);
    const removeDraft = useAssessmentDraftStore((s) => s.removeDraft);
    const setActive = useAssessmentDraftStore((s) => s.setActiveSession);

    // Hydrate the local draft from the server payload on first mount when
    // there isn't one yet. This is also the entry point used by the pinned
    // "Em andamento" section to restore a crashed session.
    //
    // Sessions that are already `completed` or `cancelled` are read-only —
    // they must NOT show up as drafts in the "Em andamento" pinned section.
    // If a stale draft for one of those statuses exists (e.g. left over
    // from before a finalize, or hydrated by an older build), purge it so
    // the tab badge and pinned list settle.
    React.useEffect(() => {
        if (!sessionId || !session.detail) return;
        const remoteStatus = session.detail.session.status;
        const isReadOnly = remoteStatus === 'completed' || remoteStatus === 'cancelled';

        if (isReadOnly) {
            if (draft.draft) {
                removeDraft(sessionId);
            }
            // Clear active pointer too: an active session is meant to be
            // an in-progress one.
            setActive(null);
            return;
        }

        if (draft.draft) {
            setActive(sessionId);
            return;
        }
        const s = session.detail;
        const studentName =
            (s.student as { name?: string } | null)?.name ?? 'Aluno';
        const studentAvatar = (s.student as { avatar_url?: string | null } | null)?.avatar_url ?? null;
        upsertDraft({
            session_id: sessionId,
            student_id: s.session.student_id,
            student_name: studentName,
            student_avatar: studentAvatar,
            template_id: s.session.template_id,
            template_title: s.template?.title ?? null,
            template_snapshot:
                (s.session.template_snapshot as AssessmentTemplateSchema | null) ??
                ((s.template?.schema_json as AssessmentTemplateSchema | undefined) ?? null),
            status: s.session.status,
            // Measurements pulled from the server are already persisted —
            // mark them as synced so the next syncBatch only sends what the
            // trainer captures locally going forward.
            measurements: (((s.measurements ?? []) as unknown) as MeasurementInput[]).map((m) => ({
                ...m,
                raw_input: {
                    ...((m.raw_input as Record<string, unknown> | null | undefined) ?? {}),
                    _synced: true,
                },
            })),
            current_test_id: null,
            current_attempts: {},
            is_dirty: false,
            last_synced_at: new Date().toISOString(),
            notes: s.session.notes ?? '',
        });
        setActive(sessionId);
    }, [sessionId, session.detail, draft.draft, upsertDraft, removeDraft, setActive]);

    // Orphan handling: the remote session was deleted (or never created, or
    // RLS now forbids access). `useAssessmentSession` already cleaned the
    // local draft from the store; here we surface a toast and bounce back
    // to /forms so the user isn't stuck on an empty checklist.
    useEffect(() => {
        if (!session.orphaned) return;
        toast.error('Esta avaliação não existe mais — rascunho descartado');
        router.replace('/(trainer-tabs)/forms');
    }, [session.orphaned, router]);

    // For active sessions, the draft is the source of truth (includes any
    // unsynced measurements). For completed/cancelled sessions there's no
    // draft (intentionally — see Issue 9 fix), so fall back to the server
    // payload's template_snapshot/measurements.
    const remoteStatusForView = session.detail?.session.status;
    const isReadOnlyView =
        remoteStatusForView === 'completed' || remoteStatusForView === 'cancelled';

    const schema: AssessmentTemplateSchema | null = useMemo(() => {
        if (isReadOnlyView) {
            return (
                (session.detail?.session.template_snapshot as AssessmentTemplateSchema | null) ??
                ((session.detail?.template?.schema_json as AssessmentTemplateSchema | undefined) ?? null)
            );
        }
        return draft.draft?.template_snapshot ?? null;
    }, [isReadOnlyView, session.detail, draft.draft]);

    /** Effective measurements list — draft-backed when active, server-backed
     *  when read-only. Used for completedTestIds and value summaries. */
    const measurementsForView: MeasurementInput[] = useMemo(() => {
        if (isReadOnlyView) {
            return ((session.detail?.measurements ?? []) as unknown) as MeasurementInput[];
        }
        return draft.draft?.measurements ?? [];
    }, [isReadOnlyView, session.detail, draft.draft]);

    const flatTests: FlatTest[] = useMemo(() => {
        if (!schema) return [];
        const out: FlatTest[] = [];
        for (const sec of schema.sections ?? []) {
            for (const t of sec.tests ?? []) {
                out.push({ ...t, section_title: sec.title });
            }
        }
        return out;
    }, [schema]);

    const completedTestIds = useMemo(() => {
        const ids = new Set<string>();
        for (const m of measurementsForView) {
            const tid = (m.raw_input as { test_id?: string } | null | undefined)?.test_id;
            if (tid) ids.add(tid);
        }
        // Computed tests aren't checked off via measurements — they're
        // "complete" the moment all their inputs are filled.
        for (const t of flatTests) {
            if (t.type === 'computed' && isComputedReady(t, measurementsForView)) {
                ids.add(t.id);
            }
        }
        return ids;
    }, [measurementsForView, flatTests]);

    const requiredCount = flatTests.filter((t) => isRequired(t)).length;
    const completedRequiredCount = flatTests.filter((t) => isRequired(t) && completedTestIds.has(t.id)).length;
    const allRequiredDone = requiredCount === 0 || completedRequiredCount === requiredCount;

    const isDirty = draft.draft?.is_dirty ?? false;

    const goToTest = useCallback(
        (testId: string) => {
            if (!sessionId) return;
            Haptics.selectionAsync();
            router.push({
                pathname: '/assessments/[sessionId]/measure/[testId]',
                params: { sessionId, testId },
            });
        },
        [sessionId, router],
    );

    const onFinalize = useCallback(async () => {
        if (!sessionId || !draft.draft || !schema) return;
        if (!allRequiredDone) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            toast.error(`Faltam ${requiredCount - completedRequiredCount} medições obrigatórias`);
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        // Always read fresh from the store — local closures may be stale
        // if the trainer just committed a measurement and tapped Finalizar
        // before React re-rendered.
        const fresh = useAssessmentDraftStore.getState().drafts[sessionId];
        if (fresh?.is_dirty) {
            const ok = await lifecycle.syncBatch(sessionId, fresh.measurements);
            if (!ok) {
                toast.error('Sem conexão para sincronizar — tente novamente.');
                return;
            }
        }

        // Step 1: always compute the simple computed metrics declared in the
        // template (BMI, RCQ — independent of any ProtocolTest).
        let metrics: ComputedMetrics = buildComputedMetricsFromSchema(
            schema,
            draft.draft.measurements,
        );

        // Step 2: run the body-composition engine for body fat % + lean/fat
        // mass when sex/age are captured (CreateSessionModal step 3) and
        // either an explicit `protocol` test or matching skinfolds are
        // present in the measurements.
        const ctx = readSubjectContext(draft.draft.measurements);
        const weight = pickWeightKg(draft.draft.measurements);
        const height = pickHeightM(draft.draft.measurements);
        const protocolId = ctx.sex
            ? detectProtocol(schema, draft.draft.measurements, ctx.sex)
            : null;

        if (__DEV__) {
            console.log('[finalize] engine gate', {
                protocolId,
                sex: ctx.sex,
                age: ctx.age_years,
                weight,
                height,
                skinfoldKeys: draft.draft.measurements
                    .filter((m) => m.metric_key.startsWith('skinfold_'))
                    .map((m) => m.metric_key),
            });
        }

        if (protocolId && ctx.sex && ctx.age_years && weight && height) {
            const skinfolds_mm = extractSkinfoldsForEngine(draft.draft.measurements);
            const engineInput: BodyCompositionInput = {
                protocol: protocolId as AssessmentProtocol,
                anthropometric: {
                    weight_kg: weight,
                    height_m: height,
                    age_years: ctx.age_years,
                    sex: ctx.sex,
                },
                skinfolds_mm,
            };
            try {
                const r = calculateBodyComposition(engineInput);
                metrics = {
                    ...metrics,
                    body_density: r.body_density ?? undefined,
                    body_fat_percent: r.body_fat_percent,
                    fat_mass_kg: r.fat_mass_kg,
                    lean_mass_kg: r.lean_mass_kg,
                };
            } catch (err) {
                if (err instanceof FormulaInputError) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    toast.error(`Verifique os valores: ${err.field}`);
                    // Fall through and finalize with the simple metrics already
                    // gathered (BMI/RCQ from the template's computed tests).
                } else {
                    throw err;
                }
            }
        }

        const result = await lifecycle.finalize({
            session_id: sessionId,
            precomputedMetrics: metrics,
            notes: draft.draft.notes || null,
        });
        // The lifecycle hook may return null in two distinct cases:
        //  - genuine error (finalizeError populated)
        //  - benign "already completed" / "in-flight guard rejected" (no error)
        // Treat the second as success so the trainer doesn't see a misleading
        // toast; the desired terminal state is reached either way.
        if (!result && lifecycle.finalizeError) {
            toast.error(lifecycle.finalizeError);
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.success('Avaliação concluída');
        router.replace({
            pathname: '/assessments/[sessionId]/result',
            params: { sessionId },
        });
    }, [sessionId, draft.draft, schema, flatTests, allRequiredDone, isDirty, lifecycle, router, requiredCount]);

    if (!sessionId || session.isLoading || session.orphaned) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator color={colors.brand.primary} />
            </View>
        );
    }
    if (session.error || !session.detail) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background.primary }}>
                <AlertCircle size={32} color={colors.error.default} />
                <Text style={{ marginTop: 12, color: colors.text.secondary, textAlign: 'center' }}>
                    {session.error ?? 'Sessão não encontrada'}
                </Text>
            </View>
        );
    }

    const studentName = (session.detail.student as { name?: string } | null)?.name ?? 'Aluno';
    const isCompleted = session.detail.session.status === 'completed';

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    backgroundColor: colors.background.card,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.primary,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar">
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: colors.text.primary }}>
                            {studentName}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                            {session.detail.template?.title ?? 'Sem template'}
                        </Text>
                    </View>
                    <SessionStatusBadge kind={session.detail.session.status} />
                </View>

                {/* progress bar */}
                <View style={{ marginTop: 12, height: 4, backgroundColor: colors.background.inset, borderRadius: 2 }}>
                    <View
                        style={{
                            width: `${requiredCount === 0 ? 0 : (completedRequiredCount / requiredCount) * 100}%`,
                            height: 4,
                            backgroundColor: colors.status.presencial,
                            borderRadius: 2,
                        }}
                    />
                </View>
                <Text style={{ marginTop: 6, fontSize: 11, color: colors.text.tertiary }}>
                    {completedRequiredCount} de {requiredCount} testes obrigatórios
                </Text>

                {isDirty && !isCompleted && (
                    <View
                        style={{
                            marginTop: 10,
                            backgroundColor: colors.warning.light,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                        <ActivityIndicator size="small" color={colors.warning.default} />
                        <Text style={{ fontSize: 12, color: colors.warning.default, flex: 1 }}>
                            Sincronizando alterações...
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 18 }}>
                {flatTests.length === 0 && (
                    <View
                        style={{
                            backgroundColor: colors.background.card,
                            borderRadius: 14,
                            padding: 24,
                            alignItems: 'center',
                            gap: 8,
                        }}>
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: colors.text.secondary,
                                textAlign: 'center',
                            }}>
                            Este template não tem testes definidos
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                color: colors.text.tertiary,
                                textAlign: 'center',
                                lineHeight: 18,
                            }}>
                            Edite o template em Avaliações ▸ Templates para adicionar pelo menos um teste antes de capturar.
                        </Text>
                    </View>
                )}
                {(schema?.sections ?? []).map((sec: AssessmentSection) => (
                    <View key={sec.id} style={{ gap: 8 }}>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: colors.text.tertiary,
                                textTransform: 'uppercase',
                                letterSpacing: 1.2,
                            }}>
                            {sec.title}
                        </Text>
                        {sec.tests.map((t) => {
                            const state: TestState = completedTestIds.has(t.id) ? 'done' : 'pending';
                            const value_summary = state === 'done'
                                ? summarizeTest(t, measurementsForView)
                                : undefined;
                            return (
                                <TestChecklistItem
                                    key={t.id}
                                    testId={t.id}
                                    label={t.label}
                                    type_label={typeLabel(t)}
                                    state={state}
                                    value_summary={value_summary}
                                    isCurrent={!completedTestIds.has(t.id) && t.id === firstUncompletedId(flatTests, completedTestIds)}
                                    onPress={goToTest}
                                />
                            );
                        })}
                    </View>
                ))}
            </ScrollView>

            {/* Footer — finalize CTA */}
            {!isCompleted && (
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: insets.bottom + 12,
                        backgroundColor: colors.background.card,
                        borderTopWidth: 1,
                        borderTopColor: colors.border.primary,
                    }}>
                    <TouchableOpacity
                        onPress={onFinalize}
                        disabled={!allRequiredDone || lifecycle.finalizing}
                        accessibilityRole="button"
                        accessibilityLabel="Finalizar avaliação"
                        accessibilityState={{ disabled: !allRequiredDone || lifecycle.finalizing }}
                        style={{
                            backgroundColor: allRequiredDone && !lifecycle.finalizing ? colors.brand.primary : colors.background.inset,
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                        }}>
                        {lifecycle.finalizing ? (
                            <ActivityIndicator color={colors.text.inverse} />
                        ) : (
                            <>
                                <Check size={18} color={allRequiredDone ? colors.text.inverse : colors.text.tertiary} />
                                <Text style={{ fontSize: 16, fontWeight: '800', color: allRequiredDone ? colors.text.inverse : colors.text.tertiary }}>
                                    {allRequiredDone ? 'Finalizar avaliação' : `Faltam ${requiredCount - completedRequiredCount} testes`}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {isCompleted && (
                <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/assessments/[sessionId]/result', params: { sessionId } })}
                        style={{
                            backgroundColor: colors.brand.primary,
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: 'center',
                        }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text.inverse }}>
                            Ver resultado
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

function isRequired(t: AssessmentTest): boolean {
    if (t.type === 'computed') return false; // derived
    if ('required' in t && t.required === false) return false;
    return true;
}

function typeLabel(t: AssessmentTest): string {
    switch (t.type) {
        case 'numeric_unit': return `${t.unit}`;
        case 'bilateral_numeric': return `D/E (${t.unit})`;
        case 'multi_attempt_numeric': return `${t.attempts} tentativas (${t.unit})`;
        case 'computed': return 'Calculado';
        case 'protocol': return t.protocol.replace('_', ' ');
        default: return '';
    }
}

function firstUncompletedId(tests: FlatTest[], done: Set<string>): string | null {
    for (const t of tests) {
        if (!done.has(t.id) && t.type !== 'computed') return t.id;
    }
    return null;
}


/**
 * Right-aligned preview shown on a completed checklist row. Format follows
 * the test type:
 *   numeric_unit            → "75,4 kg" / "1,78 m"
 *   bilateral_numeric       → "E 32 / D 33"
 *   multi_attempt_numeric   → the selected attempt, e.g. "33,1 cm"
 *   computed                → engine result formatted, e.g. "25,5"
 *   protocol                → "soma 80 mm" with a graceful fallback
 */
function summarizeTest(t: AssessmentTest, ms: MeasurementInput[]): string | undefined {
    const rowsForTest = ms.filter(
        (m) => (m.raw_input as { test_id?: string } | null | undefined)?.test_id === t.id,
    );

    if (t.type === 'numeric_unit') {
        const m = rowsForTest[rowsForTest.length - 1];
        if (!m || typeof m.value_numeric !== 'number') return 'Concluído';
        return `${formatNumber(m.value_numeric)} ${t.unit}`;
    }

    if (t.type === 'bilateral_numeric') {
        const left = rowsForTest.find((m) => m.side === 'left')?.value_numeric;
        const right = rowsForTest.find((m) => m.side === 'right')?.value_numeric;
        if (typeof left === 'number' && typeof right === 'number') {
            return `E ${formatNumber(left)} / D ${formatNumber(right)}`;
        }
        return 'Concluído';
    }

    if (t.type === 'multi_attempt_numeric') {
        const selected = rowsForTest.find((m) => m.is_selected);
        if (selected && typeof selected.value_numeric === 'number') {
            return `${formatNumber(selected.value_numeric)} ${t.unit}`;
        }
        return 'Concluído';
    }

    if (t.type === 'computed') {
        const r = evaluateComputed(t, ms);
        if (r.value === null || !Number.isFinite(r.value)) return 'Concluído';
        return formatNumber(r.value);
    }

    if (t.type === 'protocol') {
        const sum = rowsForTest
            .filter((m) => typeof m.value_numeric === 'number')
            .reduce((acc, m) => acc + (m.value_numeric ?? 0), 0);
        if (sum > 0) return `Σ ${formatNumber(sum, 0)} mm`;
        return 'Concluído';
    }

    return 'Concluído';
}

function formatNumber(n: number, fractionDigits: number = 1): string {
    return n.toLocaleString('pt-BR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits === 0 ? 0 : 2,
    });
}
