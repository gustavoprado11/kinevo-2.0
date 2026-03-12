import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withDelay,
    withSequence,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CelebrationData {
    duration: string;
    completedSets: number;
    totalSets: number;
    totalVolume: number;
    rpe: number;
}

interface WorkoutCelebrationProps {
    visible: boolean;
    onComplete: () => void;
    data?: CelebrationData;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatVolume(kg: number): string {
    if (kg >= 1000) {
        return `${(kg / 1000).toFixed(1).replace('.0', '')} t`;
    }
    return `${Math.round(kg)} kg`;
}

function getContextualMessage(data?: CelebrationData): string {
    if (!data) return 'Mais um treino no histórico.';

    if (data.completedSets === data.totalSets && data.totalSets > 0) {
        return 'Treino 100% completo.';
    }
    if (data.rpe >= 9) {
        return 'Treino pesado. Descanse bem hoje.';
    }
    if (data.rpe <= 3) {
        return 'Sessão leve. Recuperação ativa.';
    }

    const defaults = [
        'Mais um treino no histórico.',
        'Consistência é o que conta.',
        'Cada sessão conta.',
        'Bom trabalho hoje.',
    ];
    // Deterministic based on volume so it doesn't change on re-render
    const index = Math.floor(data.totalVolume) % defaults.length;
    return defaults[index];
}

// ─── Particle Configuration ─────────────────────────────────────────────────────

interface ParticleConfig {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    delay: number;
    duration: number;
    size: number;
    maxOpacity: number;
}

function generateParticles(count: number): ParticleConfig[] {
    const particles: ParticleConfig[] = [];
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT * 0.32;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        const distance = 80 + Math.random() * 180;

        particles.push({
            startX: centerX - 3,
            startY: centerY,
            endX: centerX + Math.cos(angle) * distance,
            endY: centerY + Math.sin(angle) * distance - 60 - Math.random() * 80,
            delay: 200 + i * 40,
            duration: 1200 + Math.random() * 600,
            size: 4 + Math.random() * 4,
            maxOpacity: 0.4 + Math.random() * 0.4,
        });
    }

    return particles;
}

const PARTICLES = generateParticles(24);

// ─── Particle Component ─────────────────────────────────────────────────────────

function Particle({ config }: { config: ParticleConfig }) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            config.delay,
            withTiming(1, {
                duration: config.duration,
                easing: Easing.out(Easing.cubic),
            })
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(progress.value, [0, 1], [0, config.endX - config.startX]);
        const translateY = interpolate(progress.value, [0, 1], [0, config.endY - config.startY]);
        const opacity = interpolate(
            progress.value,
            [0, 0.08, 0.4, 0.7, 1],
            [0, config.maxOpacity, config.maxOpacity, config.maxOpacity * 0.3, 0]
        );
        const scale = interpolate(progress.value, [0, 0.1, 0.5, 1], [0, 1.3, 1, 0.4]);

        return {
            transform: [{ translateX }, { translateY }, { scale }],
            opacity,
        };
    });

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: config.startX,
                    top: config.startY,
                    width: config.size,
                    height: config.size,
                    borderRadius: config.size / 2,
                    backgroundColor: '#a78bfa',
                },
                animatedStyle,
            ]}
        />
    );
}

// ─── Stat Item ──────────────────────────────────────────────────────────────────

function StatItem({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.statItem}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function WorkoutCelebration({ visible, onComplete, data }: WorkoutCelebrationProps) {
    const overlayOpacity = useSharedValue(0);
    const checkScale = useSharedValue(0.3);
    const checkOpacity = useSharedValue(0);
    const glowScale = useSharedValue(0.5);
    const titleOpacity = useSharedValue(0);
    const statsOpacity = useSharedValue(0);
    const messageOpacity = useSharedValue(0);
    const buttonOpacity = useSharedValue(0);

    const contextualMessage = useMemo(() => getContextualMessage(data), [data]);

    useEffect(() => {
        if (!visible) {
            overlayOpacity.value = 0;
            checkScale.value = 0.3;
            checkOpacity.value = 0;
            glowScale.value = 0.5;
            titleOpacity.value = 0;
            statsOpacity.value = 0;
            messageOpacity.value = 0;
            buttonOpacity.value = 0;
            return;
        }

        // Phase 1 (0ms): Haptic + overlay fade in
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        overlayOpacity.value = withTiming(1, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });

        // Phase 1 (100ms): Check circle spring in
        checkOpacity.value = withDelay(
            100,
            withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
        );
        checkScale.value = withDelay(
            100,
            withSequence(
                withSpring(1.08, { damping: 8, stiffness: 150 }),
                withSpring(1, { damping: 12, stiffness: 120 })
            )
        );
        glowScale.value = withDelay(
            100,
            withSpring(1, { damping: 10, stiffness: 60 })
        );

        // Phase 2 (400ms): Title
        titleOpacity.value = withDelay(
            400,
            withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
        );

        // Phase 2 (600ms): Stats card
        statsOpacity.value = withDelay(
            600,
            withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
        );

        // Phase 2 (800ms): Contextual message
        messageOpacity.value = withDelay(
            800,
            withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
        );

        // Phase 3 (1500ms): Close button
        buttonOpacity.value = withDelay(
            1500,
            withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
        );
    }, [visible]);

    // ─── Animated Styles ────────────────────────────────────────────────────────

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    const checkContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
        opacity: checkOpacity.value,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: glowScale.value }],
        opacity: checkOpacity.value * 0.6,
    }));

    const titleStyle = useAnimatedStyle(() => ({
        opacity: titleOpacity.value,
    }));

    const statsStyle = useAnimatedStyle(() => ({
        opacity: statsOpacity.value,
    }));

    const messageStyle = useAnimatedStyle(() => ({
        opacity: messageOpacity.value,
    }));

    const buttonStyle = useAnimatedStyle(() => ({
        opacity: buttonOpacity.value,
    }));

    const particlesStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    const handleClose = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onComplete();
    }, [onComplete]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, overlayStyle]}>
            {/* Dark gradient background */}
            <LinearGradient
                colors={['#1a1a2e', '#16132d', '#0f0c29']}
                style={StyleSheet.absoluteFill}
            />

            {/* Particles */}
            <Animated.View style={[StyleSheet.absoluteFill, particlesStyle]} pointerEvents="none">
                {PARTICLES.map((particle, index) => (
                    <Particle key={index} config={particle} />
                ))}
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
                {/* Glow behind check */}
                <Animated.View style={[styles.checkGlow, glowStyle]} />

                {/* Check circle */}
                <Animated.View style={[styles.checkCircle, checkContainerStyle]}>
                    <Check size={44} color="#fff" strokeWidth={3} />
                </Animated.View>

                {/* Title */}
                <Animated.View style={titleStyle}>
                    <Text style={styles.title}>Treino concluído!</Text>
                </Animated.View>

                {/* Stats Card */}
                {data && (
                    <Animated.View style={[styles.statsCard, statsStyle]}>
                        <View style={styles.statsGrid}>
                            <StatItem value={data.duration} label="Duração" />
                            <StatItem
                                value={`${data.completedSets}/${data.totalSets}`}
                                label="Séries"
                            />
                            <StatItem value={formatVolume(data.totalVolume)} label="Volume" />
                            <StatItem value={`${data.rpe}/10`} label="RPE" />
                        </View>
                    </Animated.View>
                )}

                {/* Contextual message */}
                <Animated.View style={messageStyle}>
                    <Text style={styles.messageText}>{contextualMessage}</Text>
                </Animated.View>
            </View>

            {/* Close button */}
            <Animated.View style={[styles.bottomSection, buttonStyle]}>
                <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                    activeOpacity={0.7}
                >
                    <Text style={styles.closeText}>Fechar</Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },

    // Check circle
    checkGlow: {
        position: 'absolute',
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(124, 58, 237, 0.18)',
        top: SCREEN_HEIGHT * 0.32 - 65,
    },
    checkCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
        elevation: 12,
    },

    // Title
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.3,
        textAlign: 'center',
        marginBottom: 28,
    },

    // Stats card
    statsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 18,
        width: '100%',
        marginBottom: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '500',
    },

    // Message
    messageText: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.55)',
        fontWeight: '500',
        textAlign: 'center',
    },

    // Bottom
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 56,
        alignItems: 'center',
    },
    closeButton: {
        paddingVertical: 16,
        paddingHorizontal: 48,
    },
    closeText: {
        fontSize: 17,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
});
