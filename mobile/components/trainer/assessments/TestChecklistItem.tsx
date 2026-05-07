import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Check, ChevronRight, Circle } from 'lucide-react-native';
import { colors } from '@/theme';

export type TestState = 'pending' | 'in_progress' | 'done';

interface Props {
    testId: string;
    label: string;
    type_label?: string;       // e.g. "3 dobras" or "Antropometria"
    state: TestState;
    /** Captured value preview shown to the right when the test is done.
     *  Examples: "75,4 kg", "1,78 m", "E 32 / D 33", "33,1 cm",
     *  "25,5", "Concluído". */
    value_summary?: string;
    /** Indicates this is the current focus (highlighted purple). */
    isCurrent?: boolean;
    onPress: (testId: string) => void;
}

export function TestChecklistItem({ testId, label, type_label, state, value_summary, isCurrent, onPress }: Props) {
    const done = state === 'done';
    const icon = done ? (
        <Check size={18} color={colors.text.inverse} />
    ) : (
        <Circle size={18} color={isCurrent ? colors.brand.primary : colors.text.quaternary} strokeWidth={1.8} />
    );
    const iconBg = done
        ? colors.status.active
        : isCurrent
            ? colors.brand.primary + '22'
            : colors.background.inset;

    return (
        <TouchableOpacity
            onPress={() => onPress(testId)}
            activeOpacity={0.85}
            disabled={done}
            accessibilityRole="button"
            accessibilityLabel={`${label} — ${done ? 'concluído' : isCurrent ? 'em andamento' : 'pendente'}`}
            accessibilityState={{ disabled: done, selected: isCurrent }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                backgroundColor: colors.background.card,
                borderRadius: 14,
                borderWidth: isCurrent ? 1 : 0,
                borderColor: isCurrent ? colors.brand.primary : 'transparent',
                opacity: done ? 0.7 : 1,
            }}>
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: iconBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: done ? colors.text.tertiary : colors.text.primary,
                    }}>
                    {label}
                </Text>
                {type_label && (
                    <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 2 }}>
                        {type_label}
                    </Text>
                )}
            </View>
            {done && value_summary ? (
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: colors.text.primary,
                        marginLeft: 8,
                    }}>
                    {value_summary}
                </Text>
            ) : null}
            {!done && <ChevronRight size={18} color={colors.text.tertiary} />}
        </TouchableOpacity>
    );
}
