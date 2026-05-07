import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '@/theme';

export interface ResultStat {
    label: string;
    value: string;       // already formatted (e.g. "23.7" for BMI, "18.2%" for BF)
    classification?: string;
    classification_color?: string;
}

interface Props {
    title?: string;
    stats: ResultStat[];
}

/**
 * Headline card for the result screen — 2-column grid of computed metrics
 * with optional classification label below each.
 */
export function ResultStatsCard({ title, stats }: Props) {
    return (
        <View
            style={{
                backgroundColor: colors.background.card,
                borderRadius: 18,
                padding: 18,
                gap: 14,
            }}>
            {title && (
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.text.tertiary,
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                    }}>
                    {title}
                </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {stats.map((s) => (
                    <View key={s.label} style={{ width: '47%', gap: 4 }}>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: colors.text.tertiary,
                                textTransform: 'uppercase',
                                letterSpacing: 1.2,
                            }}>
                            {s.label}
                        </Text>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text.primary }}>
                            {s.value}
                        </Text>
                        {s.classification && (
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: s.classification_color ?? colors.text.secondary,
                                }}>
                                {s.classification}
                            </Text>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
}
