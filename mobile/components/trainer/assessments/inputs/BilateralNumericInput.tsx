import React, { useCallback } from 'react';
import { View, Text, TextInput } from 'react-native';
import { colors } from '@/theme';
import * as Haptics from 'expo-haptics';
import type { MeasurementInput, MeasurementUnit } from '@kinevo/shared/types/assessments';

export interface BilateralNumericInputProps {
    test_id: string;
    metric_key: string;
    label: string;
    unit: MeasurementUnit;
    hint?: string;
    onCommit: (measurements: MeasurementInput[]) => void;
    initialLeft?: number | null;
    initialRight?: number | null;
}

/**
 * Two side-by-side numeric inputs (left / right) for bilateral measurements
 * (arms, legs, etc). Commits as TWO MeasurementInput rows sharing
 * `metric_key` and differing on `side`.
 */
export function BilateralNumericInput({
    test_id,
    metric_key,
    label,
    unit,
    hint,
    onCommit,
    initialLeft,
    initialRight,
}: BilateralNumericInputProps) {
    const [leftRaw, setLeftRaw] = React.useState(initialLeft != null ? String(initialLeft).replace('.', ',') : '');
    const [rightRaw, setRightRaw] = React.useState(initialRight != null ? String(initialRight).replace('.', ',') : '');

    const left = parseDecimal(leftRaw);
    const right = parseDecimal(rightRaw);
    const isValid = left !== null && right !== null;

    const handleSubmit = useCallback(() => {
        if (left === null || right === null) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCommit([
            {
                metric_key,
                value_numeric: left,
                value_unit: unit,
                side: 'left',
                attempt_number: 1,
                is_selected: true,
                raw_input: { test_id },
            },
            {
                metric_key,
                value_numeric: right,
                value_unit: unit,
                side: 'right',
                attempt_number: 1,
                is_selected: true,
                raw_input: { test_id },
            },
        ]);
    }, [left, right, metric_key, unit, test_id, onCommit]);

    return (
        <View style={{ gap: 12 }}>
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                }}>
                {label}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
                <SidePad
                    label="Esquerdo"
                    value={leftRaw}
                    onChange={setLeftRaw}
                    onSubmit={handleSubmit}
                    valid={left !== null}
                    unit={unit}
                />
                <SidePad
                    label="Direito"
                    value={rightRaw}
                    onChange={setRightRaw}
                    onSubmit={handleSubmit}
                    valid={right !== null}
                    unit={unit}
                />
            </View>

            {hint && (
                <Text style={{ fontSize: 13, color: colors.text.tertiary, lineHeight: 18 }}>
                    {hint}
                </Text>
            )}

            {/* Externally read by parent via committed callback; nothing
                to render below. The wizard's footer provides the action button. */}
            <View accessibilityElementsHidden style={{ height: 0 }} />
            {isValid && null}
        </View>
    );
}

function SidePad(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    valid: boolean;
    unit: MeasurementUnit;
}) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.background.card,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: props.valid ? colors.brand.primary : colors.border.secondary,
            }}>
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                }}>
                {props.label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
                <TextInput
                    value={props.value}
                    onChangeText={props.onChange}
                    onSubmitEditing={props.onSubmit}
                    placeholder="0"
                    placeholderTextColor={colors.text.quaternary}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    accessibilityLabel={`${props.label} em ${props.unit}`}
                    style={{
                        flex: 1,
                        fontSize: 36,
                        lineHeight: 44,
                        fontWeight: '800',
                        color: colors.text.primary,
                        paddingVertical: 0,
                    }}
                />
                <Text
                    style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: colors.text.secondary,
                        marginLeft: 6,
                        marginBottom: 4,
                    }}>
                    {props.unit}
                </Text>
            </View>
        </View>
    );
}

function parseDecimal(text: string): number | null {
    if (!text || !text.trim()) return null;
    const n = Number(text.trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}
