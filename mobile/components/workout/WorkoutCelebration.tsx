import React, { useEffect, useCallback } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withDelay,
    withSequence,
    Easing,
    runOnJS,
    interpolate,
} from 'react-native-reanimated';
import { Dumbbell, Zap, Flame, CheckCircle, Trophy } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WorkoutCelebrationProps {
    visible: boolean;
    onComplete: () => void;
}

// ─── Particle Configuration ────────────────────────────────────────────────────

interface ParticleConfig {
    icon: 'dumbbell' | 'zap' | 'flame' | 'check';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rotation: number;
    delay: number;
    duration: number;
    size: number;
    opacity: number;
}

function generateParticles(count: number): ParticleConfig[] {
    const icons: ParticleConfig['icon'][] = ['dumbbell', 'zap', 'flame', 'check'];
    const particles: ParticleConfig[] = [];

    for (let i = 0; i < count; i++) {
        const startX = SCREEN_WIDTH * 0.3 + Math.random() * SCREEN_WIDTH * 0.4;
        const startY = SCREEN_HEIGHT * 0.55 + Math.random() * SCREEN_HEIGHT * 0.1;

        // Spread particles outward and upward
        const spreadX = (Math.random() - 0.5) * SCREEN_WIDTH * 1.2;
        const spreadY = -(SCREEN_HEIGHT * 0.4 + Math.random() * SCREEN_HEIGHT * 0.35);

        particles.push({
            icon: icons[i % icons.length],
            startX,
            startY,
            endX: startX + spreadX,
            endY: startY + spreadY,
            rotation: (Math.random() - 0.5) * 30, // -15 to +15 degrees
            delay: 200 + Math.random() * 600,
            duration: 1400 + Math.random() * 800,
            size: 18 + Math.random() * 14,
            opacity: 0.3 + Math.random() * 0.5,
        });
    }

    return particles;
}

const PARTICLES = generateParticles(16);

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
        const opacity = interpolate(progress.value, [0, 0.1, 0.6, 1], [0, config.opacity, config.opacity, 0]);
        const scale = interpolate(progress.value, [0, 0.15, 0.5, 1], [0, 1.2, 1, 0.6]);
        const rotate = interpolate(progress.value, [0, 1], [0, config.rotation]);

        return {
            transform: [
                { translateX },
                { translateY },
                { scale },
                { rotate: `${rotate}deg` },
            ],
            opacity,
        };
    });

    const renderIcon = () => {
        const iconProps = { size: config.size, color: 'white', strokeWidth: 1.5 };
        switch (config.icon) {
            case 'dumbbell': return <Dumbbell {...iconProps} />;
            case 'zap': return <Zap {...iconProps} />;
            case 'flame': return <Flame {...iconProps} />;
            case 'check': return <CheckCircle {...iconProps} />;
        }
    };

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: config.startX,
                    top: config.startY,
                },
                animatedStyle,
            ]}
        >
            {renderIcon()}
        </Animated.View>
    );
}

// ─── Main Celebration Component ─────────────────────────────────────────────────

export function WorkoutCelebration({ visible, onComplete }: WorkoutCelebrationProps) {
    // Shared values
    const overlayOpacity = useSharedValue(0);
    const textScale = useSharedValue(0.8);
    const textOpacity = useSharedValue(0);
    const subtitleOpacity = useSharedValue(0);
    const trophyScale = useSharedValue(0.5);
    const trophyOpacity = useSharedValue(0);
    const exitOpacity = useSharedValue(1);

    const triggerComplete = useCallback(() => {
        onComplete();
    }, [onComplete]);

    useEffect(() => {
        if (!visible) {
            // Reset all values
            overlayOpacity.value = 0;
            textScale.value = 0.8;
            textOpacity.value = 0;
            subtitleOpacity.value = 0;
            trophyScale.value = 0.5;
            trophyOpacity.value = 0;
            exitOpacity.value = 1;
            return;
        }

        // ─── Phase 1: Fade in overlay (0ms → 300ms) ──────────────────────
        overlayOpacity.value = withTiming(1, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });

        // ─── Phase 2: Trophy background element (200ms) ──────────────────
        trophyOpacity.value = withDelay(
            200,
            withTiming(0.08, { duration: 500, easing: Easing.out(Easing.cubic) })
        );
        trophyScale.value = withDelay(
            200,
            withSpring(1, { damping: 12, stiffness: 80 })
        );

        // ─── Phase 3: Hero text spring in (300ms) ────────────────────────
        textOpacity.value = withDelay(
            300,
            withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
        );
        textScale.value = withDelay(
            300,
            withSequence(
                withSpring(1.05, { damping: 8, stiffness: 150 }),
                withSpring(1, { damping: 12, stiffness: 120 })
            )
        );

        // ─── Phase 4: Subtitle fade in (600ms) ──────────────────────────
        subtitleOpacity.value = withDelay(
            600,
            withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
        );

        // ─── Phase 5: Exit fade out (2500ms → 3000ms) ───────────────────
        exitOpacity.value = withDelay(
            2500,
            withTiming(0, {
                duration: 500,
                easing: Easing.in(Easing.cubic),
            }, (finished) => {
                if (finished) {
                    runOnJS(triggerComplete)();
                }
            })
        );
    }, [visible]);

    // ─── Animated Styles ─────────────────────────────────────────────────────────

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value * exitOpacity.value,
    }));

    const textStyle = useAnimatedStyle(() => ({
        transform: [{ scale: textScale.value }],
        opacity: textOpacity.value * exitOpacity.value,
    }));

    const subtitleStyle = useAnimatedStyle(() => ({
        opacity: subtitleOpacity.value * exitOpacity.value,
    }));

    const trophyStyle = useAnimatedStyle(() => ({
        transform: [{ scale: trophyScale.value }],
        opacity: trophyOpacity.value * exitOpacity.value,
    }));

    const particlesContainerStyle = useAnimatedStyle(() => ({
        opacity: exitOpacity.value,
    }));

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, overlayStyle]} pointerEvents="none">
            {/* Gradient Background */}
            <View style={styles.gradientTop} />
            <View style={styles.gradientBottom} />

            {/* Hero Trophy (background element) */}
            <Animated.View style={[styles.trophyContainer, trophyStyle]}>
                <Trophy size={200} color="white" strokeWidth={0.8} />
            </Animated.View>

            {/* Particles */}
            <Animated.View style={[styles.particlesContainer, particlesContainerStyle]}>
                {PARTICLES.map((particle, index) => (
                    <Particle key={index} config={particle} />
                ))}
            </Animated.View>

            {/* Center Text */}
            <View style={styles.textContainer}>
                <Animated.View style={textStyle}>
                    <Text style={styles.heroText}>Mandou bem!</Text>
                </Animated.View>
                <Animated.View style={subtitleStyle}>
                    <Text style={styles.subtitleText}>Treino concluído com sucesso</Text>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7c3aed', // violet-600
    },
    gradientTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.4,
        backgroundColor: 'rgba(139, 92, 246, 0.6)', // violet-500 overlay
    },
    gradientBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.4,
        backgroundColor: 'rgba(109, 40, 217, 0.4)', // violet-700 overlay
    },
    trophyContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    particlesContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    textContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    heroText: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitleText: {
        fontSize: 16,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 12,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
});
