/**
 * IntensityBadge — chip de intensidade (Leve / Moderado / Intenso).
 *
 * Title Case, sem ícone (a chama 🔥 anterior foi removida — ruído). Cores fixas
 * por nível (tokens-reference §INTENSIDADE), independentes de dark mode.
 */
import React from 'react';
import { View, Text } from 'react-native';
import type { IntensityLevel } from '../../lib/history';

const VARIANTS: Record<IntensityLevel, { bg: string; fg: string; label: string }> = {
    leve: { bg: '#ECFDF5', fg: '#047857', label: 'Leve' },
    moderado: { bg: '#FEF9C3', fg: '#854D0E', label: 'Moderado' },
    intenso: { bg: '#FFF4E5', fg: '#C2410C', label: 'Intenso' },
};

export function IntensityBadge({ level }: { level: IntensityLevel }) {
    const v = VARIANTS[level];
    return (
        <View
            style={{
                backgroundColor: v.bg,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                flexShrink: 0, // B2: nunca encolher/cortar o chip ("Inten…")
            }}
        >
            <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, color: v.fg }}>
                {v.label}
            </Text>
        </View>
    );
}
