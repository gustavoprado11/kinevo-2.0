import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Activity, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '@/hooks/useV2Colors';
import { toRgba } from '@/lib/brandColor';
import type { TrainerAssessmentTemplate } from '../../../hooks/useTrainerAssessmentTemplates';

interface Props {
    template: TrainerAssessmentTemplate;
    onPress: (template: TrainerAssessmentTemplate) => void;
}

// M11/B2 — card de assessment template. Tap → drill-down pra edit (system
// templates abrem read-only no edit screen, com clone-on-save no AssessmentBuilderScreen).
export function AssessmentTemplateCard({ template, onPress }: Props) {
    const colors = useV2Colors();
    const isSystem = template.trainer_id === null;
    const sectionLabel = template.section_count === 1 ? 'seção' : 'seções';

    return (
        <TouchableOpacity
            onPress={() => {
                Haptics.selectionAsync();
                onPress(template);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${template.title}, ${template.section_count} ${sectionLabel}`}
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: colors.border.default,
            }}
        >
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: toRgba(colors.purple[600], 20 / 255),
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Activity size={20} color={colors.purple[600]} />
            </View>

            <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                        numberOfLines={1}
                        style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: '700',
                            color: colors.text.primary,
                        }}
                    >
                        {template.title}
                    </Text>
                    <View
                        style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: isSystem ? toRgba(colors.purple[600], 21 / 255) : colors.neutral[100],
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: isSystem ? colors.purple[600] : colors.text.secondary,
                            }}
                        >
                            {isSystem ? 'Kinevo' : 'Meu'}
                        </Text>
                    </View>
                </View>
                <Text style={{ fontSize: 12, color: colors.text.tertiary }}>
                    {template.section_count} {sectionLabel}
                </Text>
            </View>

            <ChevronRight size={16} color={colors.text.quaternary} />
        </TouchableOpacity>
    );
}
