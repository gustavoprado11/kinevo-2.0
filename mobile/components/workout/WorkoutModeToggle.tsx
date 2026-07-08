/**
 * WorkoutModeToggle — alterna a execução de treino entre "Lista completa" e
 * "Um por vez" (foco). Espelha o AssistantModeToggle: item ativo ganha pill
 * clara + sombra e pinta em roxo (brand); inativo em texto terciário.
 *
 * Gotcha RN 0.81: usa Pressable com style ESTÁTICO em array (nunca style-função
 * inline retornando objeto — não pinta backgroundColor no Fabric).
 */
import React from 'react';
import { Platform, Pressable, View, Text, type ViewStyle } from 'react-native';
import { List, Scan } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import type { WorkoutViewMode } from '../../stores/workoutViewModeStore';

const { spacing, radius, shadows } = v2;

interface WorkoutModeToggleProps {
    mode: WorkoutViewMode;
    onChange: (mode: WorkoutViewMode) => void;
}

export function WorkoutModeToggle({ mode, onChange }: WorkoutModeToggleProps) {
    const colors = useV2Colors();

    const handlePress = (next: WorkoutViewMode) => () => {
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
                padding: 3,
                gap: 2,
                backgroundColor: colors.surface.card2,
                borderRadius: radius.md,
            }}
        >
            <ToggleItem
                icon={List}
                label="Lista completa"
                active={mode === 'lista'}
                activeColor={colors.purple[700]}
                inactiveColor={colors.text.secondary}
                activeBg={colors.surface.card}
                activeShadow={activeShadow}
                onPress={handlePress('lista')}
            />
            <ToggleItem
                icon={Scan}
                label="Um por vez"
                active={mode === 'foco'}
                activeColor={colors.purple[700]}
                inactiveColor={colors.text.secondary}
                activeBg={colors.surface.card}
                activeShadow={activeShadow}
                onPress={handlePress('foco')}
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
                    gap: spacing[1] + 2,
                    paddingVertical: 8,
                    borderRadius: radius.sm,
                    backgroundColor: active ? activeBg : 'transparent',
                },
                active && activeShadow,
            ]}
        >
            <Icon size={15} color={color} strokeWidth={active ? 2 : 1.8} />
            <Text
                style={{
                    fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                    fontSize: 13,
                    color,
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}
