import React, { useCallback } from 'react';
import { View, Text, TextInput } from 'react-native';
import { colors } from '@/theme';
import * as Haptics from 'expo-haptics';
import { useAssessmentMeasurementForm } from '../../../../hooks/useAssessmentMeasurementForm';
import type { MeasurementInput, MeasurementUnit } from '@kinevo/shared/types/assessments';

export interface NumericUnitInputProps {
    test_id: string;
    metric_key: string;
    label: string;
    unit: MeasurementUnit;
    hint?: string;
    warn_below?: number;
    warn_above?: number;
    initialValue?: number | null;
    onCommit: (m: MeasurementInput) => void;
    /** Called whenever input becomes valid + parsed; lets parent decide
     *  whether to surface a range warning before committing. */
    onValidParsed?: (value: number, isOutOfRange: boolean) => void;
}

/**
 * Single-value numeric input with big-display visuals. Decimal-pad keyboard.
 * Range warning is exposed via callbacks — the wizard owns the modal UX.
 */
export function NumericUnitInput({
    test_id,
    metric_key,
    label,
    unit,
    hint,
    warn_below,
    warn_above,
    initialValue,
    onCommit,
    onValidParsed,
}: NumericUnitInputProps) {
    const form = useAssessmentMeasurementForm({
        test_id,
        metric_key,
        unit,
        warn_below,
        warn_above,
    });

    React.useEffect(() => {
        if (initialValue != null) {
            form.onChangeText(String(initialValue).replace('.', ','));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = useCallback(
        (text: string) => {
            form.onChangeText(text);
        },
        [form],
    );

    const handleSubmit = useCallback(() => {
        const m = form.toMeasurementInput();
        if (!m) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCommit(m);
    }, [form, onCommit]);

    React.useEffect(() => {
        if (form.state.isValid && form.state.parsed !== null && onValidParsed) {
            onValidParsed(form.state.parsed, form.state.isOutOfRange);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.state.parsed, form.state.isOutOfRange]);

    return (
        <View style={{ gap: 12 }}>
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                }}
                accessibilityRole="text">
                {label}
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
                    borderColor: form.state.isOutOfRange
                        ? colors.warning.default
                        : form.state.isValid
                            ? colors.brand.primary
                            : colors.border.secondary,
                }}>
                <TextInput
                    value={form.state.rawValue}
                    onChangeText={handleChange}
                    onSubmitEditing={handleSubmit}
                    placeholder="0"
                    placeholderTextColor={colors.text.quaternary}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    returnKeyType="done"
                    accessibilityLabel={`${label} em ${unit}`}
                    style={{
                        flex: 1,
                        fontSize: 44,
                        lineHeight: 52,
                        fontWeight: '800',
                        color: colors.text.primary,
                        paddingVertical: 0,
                        textAlignVertical: 'bottom',
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
                    {unit}
                </Text>
            </View>

            {hint && (
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.text.tertiary,
                        lineHeight: 18,
                    }}>
                    {hint}
                </Text>
            )}

            {form.state.isOutOfRange && (
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.warning.default,
                        fontWeight: '600',
                    }}
                    accessibilityRole="alert">
                    {form.state.rangeReason === 'below'
                        ? 'Valor parece muito baixo — confirme antes de prosseguir'
                        : 'Valor parece muito alto — confirme antes de prosseguir'}
                </Text>
            )}
        </View>
    );
}
