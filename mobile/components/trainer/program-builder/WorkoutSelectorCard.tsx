import React, { useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import { Plus } from "lucide-react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    cancelAnimation,
    Easing,
} from "react-native-reanimated";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";
import type { Workout } from "@/stores/program-builder-store";

const DAY_KEYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
const DAY_BACKEND_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface WorkoutSelectorCardProps {
    workout: Workout;
    isActive: boolean;
    onPress: () => void;
    onLongPress?: () => void;
}

export function WorkoutSelectorCard({ workout, isActive, onPress, onLongPress }: WorkoutSelectorCardProps) {
    const colors = useV2Colors();

    const { exerciseCount, totalSets } = useMemo(() => {
        // Apenas item_type === 'exercise' conta como "exerc." e contribui
        // pra "séries". Blocos de note/warmup/cardio são contabilizados em
        // outras métricas (não no chip do selector).
        const exerciseItems = workout.items.filter((it) => it.item_type === 'exercise');
        const exerciseCount = exerciseItems.length;
        const totalSets = exerciseItems.reduce((acc, it) => {
            const schemeLen = it.set_scheme?.length ?? 0;
            return acc + (schemeLen > 0 ? schemeLen : (it.sets ?? 0));
        }, 0);
        return { exerciseCount, totalSets };
    }, [workout.items]);

    return (
        <PressableScale
            onPress={onPress}
            onLongPress={onLongPress}
            pressScale={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={workout.name}
            accessibilityHint={onLongPress ? "Toque longo para excluir o treino" : undefined}
            style={{
                width: 168,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: isActive ? colors.purple[600] : colors.surface.card,
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? colors.purple[500] : colors.border.default,
                transform: [{ scale: isActive ? 1.02 : 1 }],
                ...(isActive ? {
                    shadowColor: colors.purple[600],
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.32,
                    shadowRadius: 14,
                    elevation: 8,
                } : {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 3,
                    elevation: 1,
                }),
            }}
        >
            {/* Nome */}
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: isActive ? '#FFFFFF' : colors.text.primary,
                    letterSpacing: -0.2,
                }}
                numberOfLines={1}
            >
                {workout.name}
            </Text>

            {/* Métricas */}
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: '500',
                    color: isActive ? 'rgba(255,255,255,0.75)' : colors.text.tertiary,
                    marginTop: 3,
                }}
                numberOfLines={1}
            >
                {exerciseCount} {exerciseCount === 1 ? 'exerc' : 'exerc'} · {totalSets} {totalSets === 1 ? 'série' : 'séries'}
            </Text>

            {/* Mini-chips dias da semana */}
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
                {DAY_BACKEND_KEYS.map((dayKey, idx) => {
                    const isDay = workout.frequency.includes(dayKey);
                    // Card active (purple bg): contraste claro entre dia ativo
                    // (white 25% + texto white) e dia inativo (white 10% + texto
                    // rgba 0.5). Card inactive (surface): purple sobre card2.
                    const chipBg = isActive
                        ? (isDay ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.10)')
                        : (isDay ? colors.purple[600] : colors.surface.card2);
                    const chipFg = isActive
                        ? (isDay ? '#FFFFFF' : 'rgba(255,255,255,0.5)')
                        : (isDay ? '#FFFFFF' : colors.text.quaternary);
                    return (
                        <View
                            key={dayKey}
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: 4,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: chipBg,
                            }}
                        >
                            <Text style={{
                                fontSize: 9,
                                fontWeight: '700',
                                color: chipFg,
                            }}>
                                {DAY_KEYS[idx]}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </PressableScale>
    );
}

interface WorkoutSelectorAddCardProps {
    onPress: () => void;
    /** Pulse sutil quando o programa ainda está vazio (nenhum item em nenhum treino). */
    pulse?: boolean;
}

export function WorkoutSelectorAddCard({ onPress, pulse = false }: WorkoutSelectorAddCardProps) {
    const colors = useV2Colors();
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (pulse) {
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
                ),
                -1,
                false,
            );
        } else {
            cancelAnimation(opacity);
            opacity.value = withTiming(1, { duration: 200 });
        }
        return () => {
            cancelAnimation(opacity);
        };
    }, [pulse, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.94}
            accessibilityRole="button"
            accessibilityLabel="Adicionar treino"
            style={{
                width: 120,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: colors.purple[300],
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 88,
            }}
        >
            <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
                <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: colors.purple[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                }}>
                    <Plus size={16} color={colors.purple[600]} strokeWidth={2.5} />
                </View>
                <Text style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: colors.purple[600],
                    textAlign: 'center',
                }}>
                    Novo treino
                </Text>
            </Animated.View>
        </PressableScale>
    );
}
