import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import { AnatomyDiagram } from '../AnatomyDiagram';
import type {
    AssessmentProtocol,
    MeasurementInput,
} from '@kinevo/shared/types/assessments';
import {
    PROTOCOLS,
    type ProtocolDefinition,
    type Sex,
    type SkinfoldSite,
} from '@kinevo/shared/lib/assessment-protocols';

const SITE_LABELS: Record<SkinfoldSite, string> = {
    chest: 'Peitoral',
    abdomen: 'Abdominal',
    thigh: 'Coxa',
    triceps: 'Tríceps',
    subscapular: 'Subescapular',
    suprailiac: 'Supra-ilíaca',
    midaxillary: 'Axilar média',
    biceps: 'Bíceps',
    calf: 'Panturrilha',
};

export interface ProtocolWizardProps {
    test_id: string;
    protocol: AssessmentProtocol;
    sex: Sex;
    label: string;
    /** Initial values — used when reopening a partially captured protocol. */
    initialValues?: Partial<Record<SkinfoldSite, number>>;
    /**
     * Commit N rows (one per skinfold site), each as its own measurement
     * with `metric_key='skinfold_<site>'` and unit 'mm'. The engine sums
     * server-side at finalize time; we never persist the aggregate sum.
     */
    onCommit: (rows: MeasurementInput[]) => void;
    /** Called when the trainer aborts the sub-wizard via the back chevron at step 0. */
    onCancel?: () => void;
}

/**
 * Fullscreen sub-wizard for skinfold protocols (J&P 7, Petroski 4, etc).
 * One site per page; sub-progress dots at the top show position. Commit
 * produces granular MeasurementInput rows so server-side history is intact.
 */
export function ProtocolWizard({
    test_id,
    protocol,
    sex,
    label,
    initialValues,
    onCommit,
    onCancel,
}: ProtocolWizardProps) {
    const insets = useSafeAreaInsets();
    const def: ProtocolDefinition = PROTOCOLS[protocol];
    const sites = useMemo<SkinfoldSite[]>(() => {
        const entry = def.required_sites.find((r) => r.sex === sex);
        return entry ? entry.sites : [];
    }, [def, sex]);

    const [stepIdx, setStepIdx] = useState(0);
    const [values, setValues] = useState<Partial<Record<SkinfoldSite, string>>>(() => {
        const seed: Partial<Record<SkinfoldSite, string>> = {};
        for (const s of sites) {
            const v = initialValues?.[s];
            if (typeof v === 'number') seed[s] = String(v).replace('.', ',');
        }
        return seed;
    });

    const currentSite = sites[stepIdx];

    const parsed = useMemo<Partial<Record<SkinfoldSite, number>>>(() => {
        const out: Partial<Record<SkinfoldSite, number>> = {};
        for (const s of sites) {
            const raw = values[s];
            if (raw === undefined) continue;
            const n = Number(raw.replace(',', '.'));
            if (Number.isFinite(n) && n >= 0) out[s] = n;
        }
        return out;
    }, [values, sites]);

    const allDone = sites.every((s) => parsed[s] !== undefined);
    const currentDone = currentSite ? parsed[currentSite] !== undefined : false;

    const goPrev = useCallback(() => {
        Haptics.selectionAsync();
        if (stepIdx === 0) {
            onCancel?.();
            return;
        }
        setStepIdx((i) => Math.max(0, i - 1));
    }, [stepIdx, onCancel]);

    const goNext = useCallback(() => {
        if (!currentDone) return;
        Haptics.selectionAsync();
        setStepIdx((i) => Math.min(sites.length - 1, i + 1));
    }, [currentDone, sites.length]);

    const updateValue = useCallback((site: SkinfoldSite, text: string) => {
        setValues((prev) => ({ ...prev, [site]: text }));
    }, []);

    const reset = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setValues({});
        setStepIdx(0);
    }, []);

    const handleCommit = useCallback(() => {
        if (!allDone) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const rows: MeasurementInput[] = sites.map((site) => ({
            metric_key: `skinfold_${site}`,
            value_numeric: parsed[site] as number,
            value_unit: 'mm',
            side: null,
            attempt_number: 1,
            is_selected: true,
            raw_input: { test_id, protocol, site },
        }));
        onCommit(rows);
    }, [allDone, sites, parsed, test_id, protocol, onCommit]);

    if (sites.length === 0 || !currentSite) {
        return (
            <View style={{ padding: 16 }}>
                <Text style={{ color: colors.error.default }}>
                    Protocolo {protocol} não definido para sexo {sex}.
                </Text>
            </View>
        );
    }

    const currentRaw = values[currentSite] ?? '';
    const currentParsed = parsed[currentSite];

    return (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
                paddingTop: insets.top + 12,
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 80,
                gap: 16,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity
                    onPress={goPrev}
                    accessibilityRole="button"
                    accessibilityLabel={stepIdx === 0 ? 'Voltar' : 'Dobra anterior'}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 8 }}>
                    <ChevronLeft size={24} color={colors.text.secondary} />
                </TouchableOpacity>
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.text.tertiary,
                        textTransform: 'uppercase',
                        letterSpacing: 1.4,
                    }}>
                    {label} — {stepIdx + 1} / {sites.length}
                </Text>
                <TouchableOpacity
                    onPress={reset}
                    accessibilityRole="button"
                    accessibilityLabel="Reiniciar protocolo"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 8 }}>
                    <RotateCcw size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
            </View>

            {/* Sub-progress dots */}
            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                {sites.map((s, i) => (
                    <View
                        key={s}
                        style={{
                            width: i === stepIdx ? 18 : 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor:
                                parsed[s] !== undefined
                                    ? colors.brand.primary
                                    : i === stepIdx
                                        ? colors.brand.primary + '88'
                                        : colors.background.inset,
                        }}
                    />
                ))}
            </View>

            <AnatomyDiagram highlight_site={currentSite} />

            <Text
                style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: colors.text.primary,
                    textAlign: 'center',
                }}>
                {SITE_LABELS[currentSite]}
            </Text>

            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    backgroundColor: colors.background.card,
                    borderRadius: 16,
                    paddingHorizontal: 20,
                    paddingVertical: 18,
                    borderWidth: 1,
                    borderColor:
                        currentParsed !== undefined ? colors.brand.primary : colors.border.secondary,
                }}>
                <TextInput
                    value={currentRaw}
                    onChangeText={(t) => updateValue(currentSite, t)}
                    placeholder="0"
                    placeholderTextColor={colors.text.quaternary}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    accessibilityLabel={`${SITE_LABELS[currentSite]} em milímetros`}
                    style={{
                        flex: 1,
                        fontSize: 44,
                        lineHeight: 52,
                        fontWeight: '800',
                        color: colors.text.primary,
                        paddingVertical: 0,
                    }}
                />
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: colors.text.secondary,
                        marginLeft: 8,
                        marginBottom: 6,
                    }}>
                    mm
                </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
                {stepIdx < sites.length - 1 ? (
                    <TouchableOpacity
                        onPress={goNext}
                        disabled={!currentDone}
                        accessibilityRole="button"
                        accessibilityLabel="Próxima dobra"
                        accessibilityState={{ disabled: !currentDone }}
                        style={{
                            flex: 1,
                            backgroundColor: currentDone ? colors.brand.primary : colors.background.inset,
                            borderRadius: 14,
                            paddingVertical: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}>
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: '700',
                                color: currentDone ? colors.text.inverse : colors.text.tertiary,
                            }}>
                            Próxima
                        </Text>
                        <ChevronRight
                            size={18}
                            color={currentDone ? colors.text.inverse : colors.text.tertiary}
                        />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={handleCommit}
                        disabled={!allDone}
                        accessibilityRole="button"
                        accessibilityLabel="Confirmar protocolo"
                        accessibilityState={{ disabled: !allDone }}
                        style={{
                            flex: 1,
                            backgroundColor: allDone ? colors.brand.primary : colors.background.inset,
                            borderRadius: 14,
                            paddingVertical: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}>
                        <Check size={18} color={allDone ? colors.text.inverse : colors.text.tertiary} />
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: '700',
                                color: allDone ? colors.text.inverse : colors.text.tertiary,
                            }}>
                            Confirmar protocolo
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={{ fontSize: 11, color: colors.text.tertiary, textAlign: 'center' }}>
                {def.source_citation}
            </Text>
        </ScrollView>
    );
}
