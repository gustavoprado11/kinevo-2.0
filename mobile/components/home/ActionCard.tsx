import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Dumbbell, ChevronRight, Coffee, Check, Play } from "lucide-react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    Easing,
    cancelAnimation,
} from "react-native-reanimated";
import { PressableScale } from "../shared/PressableScale";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Breathing Share Button ──
function BreatheShareButton({ onPress }: { onPress: () => void }) {
    const scale = useSharedValue(1);
    const isPressed = useSharedValue(false);

    useEffect(() => {
        // Start breathe loop
        scale.value = withRepeat(
            withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        isPressed.value = true;
        cancelAnimation(scale);
        scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePressOut = () => {
        isPressed.value = false;
        // Return to 1.0 then restart breathe
        scale.value = withSpring(1, { damping: 12, stiffness: 200 }, (finished) => {
            if (finished) {
                scale.value = withRepeat(
                    withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    -1,
                    true
                );
            }
        });
    };

    return (
        <AnimatedPressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
                animatedStyle,
                {
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(124, 58, 237, 0.18)',
                },
            ]}
        >
            <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '700' }}>
                Compartilhar
            </Text>
        </AnimatedPressable>
    );
}

type TimeContext = 'today' | 'past' | 'future';

interface ActionCardProps {
    workout?: {
        id: string;
        name: string;
        items?: { length: number };
        notes?: string;
    } | null;
    isCompleted?: boolean;
    isMissed?: boolean;
    title?: string;
    timeContext?: TimeContext;
    onPress?: () => void;
    onShare?: () => void;
}

const BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    scheduled: { label: 'AGENDADO', bg: '#f1f5f9', text: '#64748b' },
    predicted: { label: 'PREVISTO', bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
    completed: { label: 'REALIZADO', bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
    missed: { label: 'PERDIDO', bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

export function ActionCard({ workout, isCompleted, isMissed, title, timeContext = 'today', onPress, onShare }: ActionCardProps) {
    const sectionTitle = title || "Hoje";

    if (!workout) {
        // ── Rest Day Card ──
        return (
            <View style={{ marginBottom: 32 }}>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                <View style={styles.cardShell}>
                    <View style={styles.cardInner}>
                        <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                            <Coffee size={24} color="#10b981" strokeWidth={1.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>Descanso Merecido</Text>
                            <Text style={styles.cardSubtitle}>
                                Recupere suas energias para o próximo treino.
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    if (isCompleted) {
        // ── Completed Workout Card — Success Glow + Breathe Share ──
        return (
            <View style={{ marginBottom: 28 }}>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                <PressableScale
                    onPress={onPress}
                    pressScale={0.96}
                    style={{
                        borderRadius: 24,
                        overflow: 'hidden',
                        shadowColor: '#10b981',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 16,
                        elevation: 4,
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 18,
                            paddingHorizontal: 20,
                            borderRadius: 24,
                            borderWidth: 1,
                            borderColor: 'rgba(16, 185, 129, 0.15)',
                            // Emerald glow gradient simulation — white to emerald-50
                            backgroundColor: '#f0fdf9',
                        }}
                    >
                        {/* Check icon — elevated medal */}
                        <View
                            style={{
                                height: 48,
                                width: 48,
                                borderRadius: 24,
                                backgroundColor: '#dcfce7',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 16,
                                shadowColor: '#10b981',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                        >
                            <Check size={22} color="#16a34a" strokeWidth={2.5} />
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{workout.name}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#16a34a' }}>
                                Concluído com sucesso!
                            </Text>
                        </View>

                        {/* Breathe share button */}
                        {onShare && <BreatheShareButton onPress={onShare} />}
                    </View>
                </PressableScale>
            </View>
        );
    }

    if (isMissed) {
        // ── Missed Workout Card with Squish ──
        return (
            <View style={{ marginBottom: 28 }}>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                <PressableScale
                    onPress={onPress}
                    pressScale={0.96}
                    style={styles.cardShell}
                >
                    <View
                        style={[
                            styles.cardInner,
                            { borderColor: 'rgba(239, 68, 68, 0.15)' },
                        ]}
                    >
                        <View style={[styles.iconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                            <Text style={{ fontSize: 20, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{workout.name}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: '#ef4444' }}>
                                Treino não realizado
                            </Text>
                        </View>
                    </View>
                </PressableScale>
            </View>
        );
    }

    // ── Active / Future Workout Card with Squish ──
    const badgeKey = timeContext === 'future' ? 'predicted' : 'scheduled';
    const badge = BADGE_CONFIG[badgeKey];
    const isDisabledFuture = timeContext === 'future';

    return (
        <View style={{ marginBottom: 32 }}>
            <Text style={styles.sectionTitle}>{title || "Treino de Hoje"}</Text>
            <PressableScale
                onPress={isDisabledFuture ? undefined : onPress}
                disabled={isDisabledFuture}
                pressScale={0.96}
                style={[
                    styles.cardShell,
                    { opacity: isDisabledFuture ? 0.7 : 1 },
                ]}
            >
                <View style={styles.heroCardInner}>
                    {/* Top row: Icon + Tag */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <View
                            style={{
                                height: 44,
                                width: 44,
                                borderRadius: 22,
                                backgroundColor: 'rgba(124, 58, 237, 0.08)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Dumbbell size={20} color="#7c3aed" />
                        </View>
                        <View
                            style={{
                                backgroundColor: badge.bg,
                                paddingHorizontal: 12,
                                paddingVertical: 5,
                                borderRadius: 20,
                            }}
                        >
                            <Text
                                style={{
                                    color: badge.text,
                                    fontSize: 9,
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: 2.5,
                                }}
                            >
                                {badge.label}
                            </Text>
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 6 }}>
                        {workout.name}
                    </Text>

                    {/* Notes */}
                    {workout.notes && (
                        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }} numberOfLines={1}>
                            {workout.notes}
                        </Text>
                    )}

                    {/* Bottom row: Exercise count + Arrow/Button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                            {workout.items?.length || 0} exercícios
                        </Text>
                        {!isDisabledFuture && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#7c3aed',
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 16,
                                    shadowColor: '#8b5cf6',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 8,
                                    elevation: 4,
                                    gap: 6,
                                }}
                            >
                                <Play size={16} color="white" fill="white" />
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Iniciar</Text>
                            </View>
                        )}
                    </View>
                </View>
            </PressableScale>
        </View>
    );
}

// ── Shared styles ──
const styles = {
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: '#0f172a',
        marginBottom: 14,
        letterSpacing: 0.5,
    },
    cardShell: {
        borderRadius: 24,
        overflow: 'hidden' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardInner: {
        backgroundColor: '#ffffff',
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    heroCardInner: {
        backgroundColor: '#ffffff',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    iconBadge: {
        height: 48,
        width: 48,
        borderRadius: 14,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginRight: 16,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: '#0f172a',
        marginBottom: 3,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
};
