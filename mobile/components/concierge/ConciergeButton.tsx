// Botão icon-only do Concierge — espelho do botão na web, no header da
// biblioteca de exercícios do trainer mobile. Pulse verde como badge
// sinaliza "equipe disponível" sem texto extra.
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Video } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '../../hooks/useV2Colors';

interface ConciergeButtonProps {
    onPress: () => void;
}

export function ConciergeButton({ onPress }: ConciergeButtonProps) {
    const colors = useV2Colors();
    return (
        <TouchableOpacity
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel="Concierge — pedir biblioteca pronta em 24h"
            style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.purple[100],
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
            }}
        >
            <Video size={18} color={colors.purple[600]} strokeWidth={2} />
            <View
                style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#10B981',
                    borderWidth: 2,
                    borderColor: colors.surface.card,
                }}
            />
        </TouchableOpacity>
    );
}
