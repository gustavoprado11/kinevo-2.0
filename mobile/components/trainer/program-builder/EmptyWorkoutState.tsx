import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { Dumbbell, Sparkles, Plus, FileText } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    cancelAnimation,
} from "react-native-reanimated";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";

interface EmptyWorkoutStateProps {
    workoutName: string;
    onAddExercise: () => void;
    onUseAI: () => void;
    onUseTemplate: () => void;
}

export function EmptyWorkoutState({
    workoutName,
    onAddExercise,
    onUseAI,
    onUseTemplate,
}: EmptyWorkoutStateProps) {
    const colors = useV2Colors();

    // Sparkle decorativo: rotate 360° contínuo em 4s, opacity 0.6.
    const rotation = useSharedValue(0);
    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 4000, easing: Easing.linear }),
            -1,
            false,
        );
        return () => {
            cancelAnimation(rotation);
        };
    }, [rotation]);

    const sparkleStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
        opacity: 0.6,
    }));

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 }}
        >
            {/* Tile do haltere com sparkle decorativo */}
            <View style={{ position: 'relative', marginBottom: 20 }}>
                <View style={{
                    width: 84,
                    height: 84,
                    borderRadius: 24,
                    backgroundColor: colors.surface.card2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: colors.purple[300],
                    shadowColor: colors.purple[600],
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.18,
                    shadowRadius: 16,
                    elevation: 4,
                }}>
                    <Dumbbell size={36} color={colors.purple[600]} strokeWidth={1.5} />
                </View>
                {/* Sparkle giratório no canto superior direito do tile */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        {
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            width: 26,
                            height: 26,
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        sparkleStyle,
                    ]}
                >
                    <Sparkles size={22} color={colors.purple[500]} strokeWidth={2} />
                </Animated.View>
            </View>

            {/* Título contextual */}
            <Text style={{
                fontSize: 20,
                fontWeight: "800",
                color: colors.text.primary,
                textAlign: "center",
                marginBottom: 8,
                letterSpacing: -0.3,
            }}>
                Comece o {workoutName}
            </Text>

            {/* Subtítulo */}
            <Text style={{
                fontSize: 13,
                color: colors.text.tertiary,
                textAlign: "center",
                lineHeight: 19,
                maxWidth: 280,
                marginBottom: 24,
            }}>
                Adicione exercícios manualmente, gere com IA a partir do perfil do aluno ou parte de um template salvo.
            </Text>

            {/* CTA primary full-width */}
            <PressableScale
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onAddExercise();
                }}
                pressScale={0.97}
                accessibilityRole="button"
                accessibilityLabel="Adicionar exercício"
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.purple[600],
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderRadius: 14,
                    gap: 8,
                    width: '100%',
                    maxWidth: 360,
                    shadowColor: colors.purple[600],
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.32,
                    shadowRadius: 14,
                    elevation: 8,
                }}
            >
                <Plus size={18} color={'#FFFFFF'} strokeWidth={2.5} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                    Adicionar exercício
                </Text>
            </PressableScale>

            {/* CTAs secondary 50/50 */}
            <View style={{
                flexDirection: 'row',
                gap: 10,
                marginTop: 10,
                width: '100%',
                maxWidth: 360,
            }}>
                <PressableScale
                    onPress={() => {
                        Haptics.selectionAsync();
                        onUseAI();
                    }}
                    pressScale={0.96}
                    accessibilityRole="button"
                    accessibilityLabel="Gerar com IA"
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.purple[100],
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        gap: 6,
                    }}
                >
                    <Sparkles size={15} color={colors.purple[600]} strokeWidth={2} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.purple[600] }}>
                        IA
                    </Text>
                </PressableScale>
                <PressableScale
                    onPress={() => {
                        Haptics.selectionAsync();
                        onUseTemplate();
                    }}
                    pressScale={0.96}
                    accessibilityRole="button"
                    accessibilityLabel="Usar template"
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surface.card,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        gap: 6,
                    }}
                >
                    <FileText size={15} color={colors.text.secondary} strokeWidth={2} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.secondary }}>
                        Template
                    </Text>
                </PressableScale>
            </View>
        </Animated.View>
    );
}
