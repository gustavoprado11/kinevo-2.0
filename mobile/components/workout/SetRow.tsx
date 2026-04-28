import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { SetType } from '@kinevo/shared/types/prescription';
import {
    buildWeightMetaLabel,
    formatWeightKg,
} from '@kinevo/shared/lib/prescription/set-scheme';
import { buildSetMetaLabel } from '@kinevo/shared/lib/prescription/set-meta-label';
import { SetTypeBadge } from './SetTypeBadge';

interface SetRowProps {
    index: number;
    weight: string;
    reps: string;
    isCompleted: boolean;
    onWeightChange: (value: string) => void;
    onRepsChange: (value: string) => void;
    onToggleComplete: () => void;
    previousWeight?: number;
    previousReps?: number;
    /** Per-set type prescribed by the trainer (badge to the left of #). Defaults to normal. */
    setType?: SetType;
    /** Per-set rep target prescribed by the trainer ("Meta: …" label above the reps input). */
    repsTarget?: string;
    /** Per-set absolute weight target in kg (rendered as "Meta: 80 kg" above the weight input). */
    weightTargetKg?: number | null;
    /** Per-set weight target as % of 1RM (rendered as "Meta: 75% 1RM"; combined with kg when both are set). */
    weightTargetPct1rm?: number | null;
    /** Reps in reserve target (Fase 4.5f). 0 is valid (= "to failure"). */
    rirTarget?: number | null;
    /** Tempo string, e.g. "3-1-1-0" (Fase 4.5f). Empty string treated as not prescribed. */
    tempoTarget?: string | null;
    /** When true, hides inputs / check button — preview / read-only rendering. */
    readOnly?: boolean;
}

const isClusterReps = (reps: string) => reps.includes('+');
const isAmrapReps = (reps: string) => /amrap|falha/i.test(reps);

export function SetRow({
    index,
    weight,
    reps,
    isCompleted,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
    previousWeight,
    previousReps,
    setType = 'normal',
    repsTarget,
    weightTargetKg,
    weightTargetPct1rm,
    rirTarget,
    tempoTarget,
    readOnly = false,
}: SetRowProps) {

    const handleToggle = () => {
        if (!isCompleted) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
            Haptics.selectionAsync();
        }
        onToggleComplete();
    };

    const hasPrevious = previousWeight !== undefined && previousReps !== undefined;
    const target = (repsTarget ?? '').trim();
    const hasTarget = target.length > 0;
    const cluster = hasTarget && isClusterReps(target);
    const amrap = setType === 'amrap' || (hasTarget && isAmrapReps(target));

    // Placeholder priority: target → previous → empty.
    const repsPlaceholder = (() => {
        if (amrap) return 'AMRAP';
        if (cluster) return target;
        if (hasTarget) return target;
        if (hasPrevious) return String(previousReps);
        return '';
    })();

    // Meta label shown above the reps row — unified via shared helper
    // (Fase 4.5f). Includes RIR and Tempo when prescribed. Synthesize an
    // explicit "AMRAP" string when the trainer set `set_type='amrap'` but
    // didn't put AMRAP-y text in `reps` — keeps the legacy detection rule
    // (setType OR reps content) intact.
    const metaInputReps = (() => {
        if (setType === 'amrap' && !isAmrapReps(target)) return 'AMRAP';
        return target;
    })();
    const metaLabelRaw = buildSetMetaLabel({
        reps: metaInputReps,
        rir: rirTarget ?? null,
        tempo: tempoTarget ?? null,
    });
    const metaLabel = metaLabelRaw.length > 0 ? metaLabelRaw : null;

    // Weight meta (kg / %1RM). Optional — null hides the label entirely.
    const weightMetaLabel = buildWeightMetaLabel(weightTargetKg, weightTargetPct1rm);
    const weightTargetKgFormatted = formatWeightKg(weightTargetKg);
    const hasWeightTarget = weightMetaLabel !== null;
    const weightPlaceholder = (() => {
        if (weightTargetKgFormatted !== null) return weightTargetKgFormatted;
        if (hasPrevious) return String(previousWeight);
        return 'kg';
    })();

    return (
        <View>
            <View style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 5,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    marginBottom: 4,
                },
                isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.06)' },
            ]}>
                {/* Set Number */}
                <View style={[
                    {
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 6,
                    },
                    isCompleted
                        ? { backgroundColor: 'rgba(124, 58, 237, 0.15)' }
                        : { backgroundColor: '#f1f5f9' },
                ]}>
                    <Text style={[
                        { fontSize: 12, fontWeight: '600' },
                        isCompleted ? { color: '#7c3aed' } : { color: '#64748b' },
                    ]}>
                        {index + 1}
                    </Text>
                </View>

                {/* Type badge — to the left of the previous-set column when present */}
                {setType !== 'normal' ? (
                    <View style={{ marginRight: 6 }}>
                        <SetTypeBadge setType={setType} compact />
                    </View>
                ) : null}

                {/* Previous set data */}
                <View style={{ width: setType !== 'normal' ? 42 : 58, alignItems: 'center', marginRight: 6 }}>
                    <Text style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: '#94a3b8',
                        fontVariant: ['tabular-nums'],
                    }}>
                        {hasPrevious
                            ? `${Number.isInteger(previousWeight) ? previousWeight : previousWeight!.toFixed(1)}×${previousReps}`
                            : '—'}
                    </Text>
                </View>

                {/* Weight cell — stacks "Meta: …" label above the input when prescribed. */}
                <View style={{ flex: 1, marginRight: 6 }}>
                    {weightMetaLabel ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#7c3aed',
                                textAlign: 'center',
                                marginBottom: 2,
                                letterSpacing: 0.2,
                            }}
                        >
                            {weightMetaLabel}
                        </Text>
                    ) : null}
                    <TextInput
                        style={[
                            {
                                height: 38,
                                backgroundColor: '#f5f5f7',
                                borderRadius: 10,
                                textAlign: 'center',
                                fontWeight: '600',
                                fontSize: 15,
                                color: '#0f172a',
                                fontVariant: ['tabular-nums'],
                            },
                            isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' },
                            readOnly && { opacity: 0.85 },
                        ]}
                        placeholder={weightPlaceholder}
                        placeholderTextColor={hasWeightTarget ? 'rgba(124, 58, 237, 0.55)' : (hasPrevious ? '#94a3b8' : '#cbd5e1')}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        value={weight}
                        onChangeText={onWeightChange}
                        editable={!isCompleted && !readOnly}
                    />
                </View>

                {/* Reps cell — stacks "Meta: …" label above the input. The
                 *  meta string can include RIR / Tempo (Fase 4.5f). Fase
                 *  4.5g: removido `numberOfLines` — preferimos quebrar em
                 *  N linhas a esconder informação prescrita. Linha quebra
                 *  naturalmente em telas estreitas (iPhone SE pode ir pra
                 *  3 linhas com "Cluster + RIR + Tempo"; aceitável). */}
                <View style={{ flex: 1, marginRight: 6 }}>
                    {metaLabel ? (
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#7c3aed',
                                textAlign: 'center',
                                marginBottom: 2,
                                letterSpacing: 0.2,
                            }}
                        >
                            {metaLabel}
                        </Text>
                    ) : null}
                    <TextInput
                        style={[
                            {
                                height: 38,
                                backgroundColor: '#f5f5f7',
                                borderRadius: 10,
                                textAlign: 'center',
                                fontWeight: '600',
                                fontSize: 15,
                                color: '#0f172a',
                                fontVariant: ['tabular-nums'],
                            },
                            isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' },
                            readOnly && { opacity: 0.85 },
                        ]}
                        placeholder={repsPlaceholder}
                        placeholderTextColor={hasTarget ? 'rgba(124, 58, 237, 0.55)' : (hasPrevious ? '#94a3b8' : '#cbd5e1')}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        value={reps}
                        onChangeText={onRepsChange}
                        editable={!isCompleted && !readOnly}
                    />
                </View>

                {/* Check Button — circular, gray → violet (hidden in readOnly) */}
                {readOnly ? (
                    <View style={{ width: 40, height: 40 }} />
                ) : (
                    <TouchableOpacity
                        onPress={handleToggle}
                        activeOpacity={0.7}
                        style={[
                            {
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                            },
                            isCompleted
                                ? { backgroundColor: '#7c3aed' }
                                : { backgroundColor: '#e8e8ed' },
                        ]}
                    >
                        {isCompleted ? (
                            <Check size={18} color="#fff" strokeWidth={3} />
                        ) : (
                            <View style={{
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                borderWidth: 2,
                                borderColor: '#c7c7cc',
                            }} />
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
