import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '@/hooks/useV2Colors';
import type { AssessmentTest } from '@kinevo/shared/types/assessments';

interface Props {
    test: AssessmentTest;
    onEdit: () => void;
    onRemove: () => void;
}

// M10A/B2 — row de teste dentro de SectionCard. Tap no body abre
// TestPropertiesSheet pra editar; trash button remove.
export function TestRow({ test, onEdit, onRemove }: Props) {
    const colors = useV2Colors();
    const subtitle = formatSubtitle(test);
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.default,
            }}
        >
            <TouchableOpacity
                onPress={() => {
                    Haptics.selectionAsync();
                    onEdit();
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text.primary }}>
                        {test.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 1 }}>
                        {subtitle}
                    </Text>
                </View>
                <ChevronRight size={14} color={colors.text.quaternary} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onRemove();
                }}
                style={{ padding: 6 }}
                hitSlop={6}
            >
                <Trash2 size={14} color={colors.text.tertiary} />
            </TouchableOpacity>
        </View>
    );
}

function formatSubtitle(test: AssessmentTest): string {
    switch (test.type) {
        case 'numeric_unit':
            return `Numérico · ${test.unit}${test.required ? ' · obrigatório' : ''}`;
        case 'bilateral_numeric':
            return `Bilateral D/E · ${test.unit}`;
        case 'multi_attempt_numeric':
            return `${test.attempts} tentativas · ${test.unit} · ${formatStrategy(test.selection_strategy)}`;
        case 'computed':
            return `Calculado · ${test.metric_key}`;
        case 'protocol':
            return `Protocolo · ${test.protocol}`;
        default: {
            const _exhaustive: never = test;
            return String(_exhaustive);
        }
    }
}

function formatStrategy(s: 'best_max' | 'best_min' | 'median' | 'mean'): string {
    switch (s) {
        case 'best_max': return 'melhor (maior)';
        case 'best_min': return 'melhor (menor)';
        case 'median': return 'mediana';
        case 'mean': return 'média';
    }
}
