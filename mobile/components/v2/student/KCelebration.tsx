/**
 * KCelebration — overlay full-screen com confetti animado.
 *
 * Tipos:
 *   - pr: "🏆 NOVO PR!" / palette gold
 *   - workout-complete: "💪 Treino completo!" / palette purple
 *   - streak-milestone: "🔥 X semanas!" / palette warm
 *
 * Renderiza Modal transparente com BlurView de fundo + card central + pool
 * de partículas SVG caindo. Auto-dismiss em `autoDismiss` ms (default 4000).
 *
 * Performance: pool max 80 partículas (já clampado em utils/confetti).
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React, { useEffect, useMemo } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';
import { toRgba } from '../../../lib/brandColor';
import {
    generateConfettiParticles,
    type ConfettiParticle,
    type ConfettiPalette,
} from './utils/confetti';

const { spacing, radius } = v2;

export type KCelebrationType = 'pr' | 'workout-complete' | 'streak-milestone';

export interface KCelebrationProps {
    visible: boolean;
    type: KCelebrationType;
    title?: string;
    subtitle?: string;
    value?: string;
    onDismiss: () => void;
    onShare?: () => void;
    autoDismiss?: number;
}

const TYPE_CONFIG: Record<KCelebrationType, {
    defaultTitle: string;
    emoji: string;
    accent: string;
    accentBg: string;
    palette: ConfettiPalette;
}> = {
    'pr': {
        defaultTitle: 'NOVO PR!',
        emoji: '🏆',
        accent: '#F59E0B',
        accentBg: 'rgba(245,158,11,0.16)',
        palette: 'gold',
    },
    'workout-complete': {
        defaultTitle: 'Treino completo!',
        emoji: '💪',
        accent: '#7C3AED',
        accentBg: 'rgba(124,58,237,0.16)',
        palette: 'purple',
    },
    'streak-milestone': {
        defaultTitle: 'Streak milestone!',
        emoji: '🔥',
        accent: '#F59E0B',
        accentBg: 'rgba(245,158,11,0.16)',
        palette: 'warm',
    },
};

export function KCelebration({
    visible,
    type,
    title,
    subtitle,
    value,
    onDismiss,
    onShare,
    autoDismiss = 4000,
}: KCelebrationProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();
    const baseCfg = TYPE_CONFIG[type];
    // O accent do tipo 'workout-complete' é a marca do estúdio — rebrand via
    // colors.purple[N]. A palette de confetti ('purple') é decorativa (multi-hue)
    // e permanece intacta.
    const cfg = type === 'workout-complete'
        ? { ...baseCfg, accent: colors.purple[600], accentBg: toRgba(colors.purple[600], 0.16) }
        : baseCfg;

    const cardScale = useSharedValue(0.9);
    const cardOpacity = useSharedValue(0);
    const emojiScale = useSharedValue(0);

    const { width: viewportW, height: viewportH } = Dimensions.get('window');

    const particles = useMemo<ConfettiParticle[]>(
        () =>
            visible
                ? generateConfettiParticles(60, {
                      seed: Date.now() & 0xFFFF,
                      palette: cfg.palette,
                      viewportWidth: viewportW,
                  })
                : [],
        [visible, type, viewportW, cfg.palette],
    );

    useEffect(() => {
        if (!visible) {
            cardOpacity.value = 0;
            cardScale.value = 0.9;
            emojiScale.value = 0;
            return;
        }
        cardOpacity.value = withTiming(1, { duration: 240 });
        cardScale.value = withSpring(1, { damping: 12, stiffness: 140 });
        emojiScale.value = withDelay(120, withSpring(1, { damping: 8, stiffness: 120 }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

        if (autoDismiss > 0) {
            const t = setTimeout(() => onDismiss(), autoDismiss);
            return () => clearTimeout(t);
        }
        return;
    }, [visible, autoDismiss]);

    const cardStyle = useAnimatedStyle(() => ({
        opacity: cardOpacity.value,
        transform: [{ scale: cardScale.value }],
    }));
    const emojiStyle = useAnimatedStyle(() => ({
        transform: [{ scale: emojiScale.value }],
    }));

    if (!visible) return null;

    const cardBg = isDark ? colors.surface.card : '#FFFFFF';
    const titleColor = colors.text.primary;
    const subtitleColor = colors.text.secondary;
    const displayTitle = title ?? cfg.defaultTitle;

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.root}>
                <BlurView
                    intensity={40}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                />
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Fechar celebração"
                />

                {/* Confetti layer */}
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {particles.map((p, i) => (
                        <ConfettiPiece key={i} particle={p} viewportH={viewportH} />
                    ))}
                </View>

                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: cardBg,
                            borderColor: cfg.accentBg,
                        },
                        Platform.OS === 'ios'
                            ? {
                                  shadowColor: cfg.accent,
                                  shadowOffset: { width: 0, height: 12 },
                                  shadowOpacity: 0.32,
                                  shadowRadius: 32,
                              }
                            : { elevation: 16 },
                        cardStyle,
                    ]}
                    accessibilityRole="alert"
                    accessibilityLabel={`${displayTitle}${value ? `, ${value}` : ''}`}
                >
                    <Animated.Text style={[styles.emoji, emojiStyle]}>{cfg.emoji}</Animated.Text>

                    <Text style={[styles.title, { color: titleColor }]}>{displayTitle}</Text>

                    {subtitle ? (
                        <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
                    ) : null}

                    {value ? (
                        <LinearGradient
                            colors={[cfg.accent, cfg.accent]}
                            style={[styles.valuePill, { backgroundColor: cfg.accent }]}
                        >
                            <Text style={styles.valueText}>{value}</Text>
                        </LinearGradient>
                    ) : null}

                    <View style={styles.actionsRow}>
                        {onShare ? (
                            <Pressable
                                onPress={() => {
                                    Haptics.selectionAsync().catch(() => undefined);
                                    onShare();
                                }}
                                style={[styles.btn, styles.btnSecondary]}
                                accessibilityRole="button"
                                accessibilityLabel="Compartilhar"
                            >
                                <Text style={[styles.btnText, styles.btnSecondaryText]}>Compartilhar</Text>
                            </Pressable>
                        ) : null}
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => undefined);
                                onDismiss();
                            }}
                            style={[styles.btn, { backgroundColor: cfg.accent }]}
                            accessibilityRole="button"
                            accessibilityLabel="Continuar"
                        >
                            <Text style={[styles.btnText, styles.btnPrimaryText]}>Continuar</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

function ConfettiPiece({ particle, viewportH }: { particle: ConfettiParticle; viewportH: number }) {
    const translateY = useSharedValue(particle.y);
    const translateX = useSharedValue(0);
    const rotation = useSharedValue(particle.rotation);
    const opacity = useSharedValue(1);

    useEffect(() => {
        const dur = 2400 + (1 - particle.velocity) * 600;
        translateY.value = withDelay(
            particle.delay,
            withTiming(viewportH + 40, { duration: dur, easing: Easing.linear }),
        );
        translateX.value = withDelay(
            particle.delay,
            withTiming(particle.drift, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        );
        rotation.value = withDelay(
            particle.delay,
            withTiming(particle.rotation + 540, { duration: dur, easing: Easing.linear }),
        );
        opacity.value = withDelay(
            particle.delay + dur - 400,
            withTiming(0, { duration: 400 }),
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: particle.x,
                    top: 0,
                    width: particle.size,
                    height: particle.size,
                },
                animStyle,
            ]}
        >
            <Svg width={particle.size} height={particle.size}>
                <Rect
                    x={0}
                    y={0}
                    width={particle.size}
                    height={particle.size * 0.5}
                    fill={particle.color}
                    rx={1}
                />
            </Svg>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: '82%',
        maxWidth: 340,
        borderRadius: radius.xl,
        borderWidth: 1,
        paddingVertical: spacing[6],
        paddingHorizontal: spacing[5],
        alignItems: 'center',
    },
    emoji: {
        fontSize: 64,
        marginBottom: spacing[2],
    },
    title: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 28,
        letterSpacing: -1,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: 15,
        marginTop: 4,
        textAlign: 'center',
    },
    valuePill: {
        marginTop: spacing[4],
        paddingHorizontal: spacing[4],
        paddingVertical: 8,
        borderRadius: radius.pill,
    },
    valueText: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 18,
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[5],
        alignSelf: 'stretch',
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    btnSecondary: {
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    btnText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 14,
    },
    btnPrimaryText: { color: '#FFFFFF' },
    btnSecondaryText: { color: '#3F3F46' },
});
