/**
 * AssistantMessageBubble — bolha de mensagem do chat do Assistente.
 *
 *  - role "user": alinhada à direita, fundo roxo-claro, cantos 20/20/6/20.
 *  - role "assistant": alinhada à esquerda, avatar Sparkles (gradiente) +
 *    texto fluido. Aceita `children` (cards de ferramenta) abaixo do texto.
 *
 * Tokens DS v2 + Plus Jakarta.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing } = v2;

interface AssistantMessageBubbleProps {
    role: 'user' | 'assistant';
    text?: string;
    children?: React.ReactNode;
}

export function AssistantMessageBubble({ role, text, children }: AssistantMessageBubbleProps) {
    const colors = useV2Colors();

    if (role === 'user') {
        return (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View
                    style={{
                        maxWidth: '82%',
                        backgroundColor: colors.purple[100],
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        borderBottomRightRadius: 6,
                        borderBottomLeftRadius: 20,
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'MonaSans_500Medium',
                            fontSize: 14,
                            lineHeight: 20,
                            color: colors.purple[900],
                        }}
                    >
                        {text}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <LinearGradient
                colors={[colors.purple[500], colors.purple[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Sparkles size={16} color="#FFFFFF" strokeWidth={1.6} />
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0, gap: spacing[3] }}>
                {text ? (
                    <Text
                        style={{
                            fontFamily: 'MonaSans_500Medium',
                            fontSize: 14,
                            lineHeight: 22,
                            color: colors.text.secondary,
                        }}
                    >
                        {text}
                    </Text>
                ) : null}
                {children}
            </View>
        </View>
    );
}
