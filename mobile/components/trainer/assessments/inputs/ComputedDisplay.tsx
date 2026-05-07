import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '@/theme';

export interface ComputedDisplayProps {
    label: string;
    /** Pre-computed value, or null when inputs aren't ready yet. */
    value: number | null;
    unit?: string;
    formula_label?: string;
    description?: string;
    /** Optional classification badge text shown alongside (e.g. "Sobrepeso"). */
    classification_label?: string;
    classification_color?: string;
}

/**
 * Read-only display of a computed metric (BMI, RCQ etc). Inputs come from
 * earlier wizard steps; this component never edits the draft. Shown as a
 * card matching the input visual scale.
 */
export function ComputedDisplay({
    label,
    value,
    unit,
    formula_label,
    description,
    classification_label,
    classification_color,
}: ComputedDisplayProps) {
    const hasValue = value !== null && Number.isFinite(value);

    return (
        <View
            style={{
                backgroundColor: colors.status.presencialBg,
                borderRadius: 16,
                padding: 18,
                borderWidth: 1,
                borderColor: colors.status.presencial + '33',
                gap: 8,
            }}
            accessibilityRole="text"
            accessibilityLabel={
                hasValue
                    ? `${label}: ${(value as number).toFixed(2)}${unit ? ' ' + unit : ''}`
                    : `${label}: aguardando dados`
            }>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.status.presencial,
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                    }}>
                    {label}
                </Text>
                {formula_label && (
                    <Text style={{ fontSize: 11, color: colors.text.tertiary }}>{formula_label}</Text>
                )}
            </View>

            {hasValue ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text.primary }}>
                        {(value as number).toFixed(2)}
                    </Text>
                    {unit && (
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: colors.text.secondary,
                                marginBottom: 6,
                            }}>
                            {unit}
                        </Text>
                    )}
                </View>
            ) : (
                <Text style={{ fontSize: 16, color: colors.text.tertiary, fontWeight: '500' }}>
                    Faltam medidas
                </Text>
            )}

            {classification_label && (
                <View
                    style={{
                        alignSelf: 'flex-start',
                        backgroundColor: (classification_color ?? colors.brand.primary) + '22',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                    }}>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: classification_color ?? colors.brand.primary,
                        }}>
                        {classification_label}
                    </Text>
                </View>
            )}

            {description && (
                <Text style={{ fontSize: 12, color: colors.text.tertiary, lineHeight: 16 }}>
                    {description}
                </Text>
            )}
        </View>
    );
}
