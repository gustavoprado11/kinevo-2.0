/**
 * CreditMeter — pill compacta com os créditos de IA restantes no período.
 * Alimentada pelo `summary` (AiUsageSummary) do useAssistantChat. Fica vermelha
 * quando a cota acaba. Esconde-se enquanto o summary não carregou.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useV2Colors } from '../../hooks/useV2Colors';
import type { AiUsageSummary } from '../../hooks/useAssistantChat';

export function CreditMeter({ summary }: { summary: AiUsageSummary | null }) {
    const colors = useV2Colors();
    if (!summary) return null;

    const exhausted = summary.exhausted || summary.creditsRemaining <= 0;
    const fg = exhausted ? colors.semantic.danger.fg : colors.purple[600];
    const bg = exhausted ? colors.semantic.danger.bg : colors.purple[50];

    return (
        <View
            accessibilityRole="text"
            accessibilityLabel={`${summary.creditsRemaining} de ${summary.creditsTotal} créditos de IA restantes`}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: bg,
                borderRadius: 9,
                paddingHorizontal: 8,
                paddingVertical: 4,
            }}
        >
            <Zap size={12} color={fg} strokeWidth={2.2} />
            <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 11.5, color: fg }}>
                {summary.creditsRemaining}
            </Text>
        </View>
    );
}
