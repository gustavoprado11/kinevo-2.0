/**
 * AssistantModeToggle — alterna a Home entre Clássico e Assistente.
 *
 * Espelha o toggle "Clássico ↔ Assistente" do web. Item ativo ganha pill
 * branca + sombra; Assistente pinta em roxo (brand), Clássico em texto
 * primário. Usa tokens DS v2 + Plus Jakarta + haptics.
 */
import React from 'react';
import { Platform, Pressable, View, Text, type ViewStyle } from 'react-native';
import { LayoutGrid, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import type { AssistantMode } from '../../stores/assistantModeStore';

const { spacing, radius, shadows } = v2;

interface AssistantModeToggleProps {
    mode: AssistantMode;
    onChange: (mode: AssistantMode) => void;
}

export function AssistantModeToggle({ mode, onChange }: AssistantModeToggleProps) {
    const colors = useV2Colors();

    const handlePress = (next: AssistantMode) => () => {
        if (next === mode) return;
        Haptics.selectionAsync();
        onChange(next);
    };

    const activeShadow = Platform.OS === 'ios' ? shadows.xs.ios : shadows.xs.android;

    return (
        <View
            accessibilityRole="tablist"
            style={{
                flexDirection: 'row',
                padding: 4,
                gap: 4,
                backgroundColor: colors.surface.card2,
                borderRadius: radius.md,
            }}
        >
            <ToggleItem
                icon={LayoutGrid}
                label="Clássico"
                active={mode === 'classic'}
                activeColor={colors.text.primary}
                inactiveColor={colors.text.tertiary}
                activeBg={colors.surface.card}
                activeShadow={activeShadow}
                onPress={handlePress('classic')}
            />
            <ToggleItem
                icon={Sparkles}
                label="Assistente"
                active={mode === 'assistant'}
                activeColor={colors.purple[600]}
                inactiveColor={colors.text.tertiary}
                activeBg={colors.surface.card}
                activeShadow={activeShadow}
                onPress={handlePress('assistant')}
            />
        </View>
    );
}

function ToggleItem({
    icon: Icon,
    label,
    active,
    activeColor,
    inactiveColor,
    activeBg,
    activeShadow,
    onPress,
}: {
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    label: string;
    active: boolean;
    activeColor: string;
    inactiveColor: string;
    activeBg: string;
    activeShadow: ViewStyle;
    onPress: () => void;
}) {
    const color = active ? activeColor : inactiveColor;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={[
                {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing[2],
                    paddingVertical: 11,
                    borderRadius: radius.sm,
                    backgroundColor: active ? activeBg : 'transparent',
                },
                active && activeShadow,
            ]}
        >
            <Icon size={16} color={color} strokeWidth={active ? 1.9 : 1.8} />
            <Text
                style={{
                    fontFamily: active ? 'MonaSans_700Bold' : 'MonaSans_600SemiBold',
                    fontSize: 14,
                    color,
                    letterSpacing: -0.005,
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}
