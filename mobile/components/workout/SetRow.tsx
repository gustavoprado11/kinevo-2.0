import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { SetType } from '@kinevo/shared/types/prescription';
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

    // Meta label shown above the reps input — uses target when present.
    const metaLabel = (() => {
        if (amrap) return 'Meta: até a falha';
        if (cluster) return `Meta: ${target} · cluster`;
        if (hasTarget) return `Meta: ${target}`;
        return null;
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

                {/* Weight Input */}
                <TextInput
                    style={[
                        {
                            flex: 1,
                            height: 38,
                            backgroundColor: '#f5f5f7',
                            borderRadius: 10,
                            textAlign: 'center',
                            fontWeight: '600',
                            fontSize: 15,
                            color: '#0f172a',
                            marginRight: 6,
                            fontVariant: ['tabular-nums'],
                        },
                        isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' },
                        readOnly && { opacity: 0.85 },
                    ]}
                    placeholder={hasPrevious ? String(previousWeight) : 'kg'}
                    placeholderTextColor={hasPrevious ? '#94a3b8' : '#cbd5e1'}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                    value={weight}
                    onChangeText={onWeightChange}
                    editable={!isCompleted && !readOnly}
                />

                {/* Reps cell — stacks "Meta: …" label above the input. */}
                <View style={{ flex: 1, marginRight: 6 }}>
                    {metaLabel ? (
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
