import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    AccessibilityInfo,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Share2, Check, Clock, TrendingUp, Trophy } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShareWorkoutModal } from './ShareWorkoutModal';
import { MaxLoadsTemplate } from './sharing/MaxLoadsTemplate';
import { FullWorkoutTemplate } from './sharing/FullWorkoutTemplate';
import { ShareableCardProps } from './sharing/types';
import { WorkoutHealthCard } from './WorkoutHealthCard';
import { useWorkoutHealthSummary } from '../../hooks/useWorkoutHealthSummary';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SuccessModalData extends ShareableCardProps {
    sessionId?: string;
}

interface WorkoutSuccessModalProps {
    visible: boolean;
    onClose: () => void;
    data?: SuccessModalData;
}

const CARD_ASPECT_RATIO = 568 / 320;

function formatRelativeDate(dateStr: string): string {
    const today = new Date().toLocaleDateString('pt-BR');
    if (dateStr === today) return 'Hoje';
    return dateStr;
}

function formatDurationShort(duration: string): string {
    const parts = duration.split(':');
    if (parts.length === 2) {
        const mins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        if (mins < 60) return `${mins}min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return duration;
}

function HealthCardSlot({ sessionId }: { sessionId: string }) {
    const { data } = useWorkoutHealthSummary(sessionId);
    if (!data) return null;
    return <WorkoutHealthCard summary={data} />;
}

function formatVolumeShort(kg: number): string {
    if (kg >= 1000) {
        return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}t`;
    }
    return `${Math.round(kg)}kg`;
}

export function WorkoutSuccessModal({ visible, onClose, data }: WorkoutSuccessModalProps) {
    const { width: screenWidth } = useWindowDimensions();
    const CARD_PREVIEW_WIDTH = screenWidth * 0.66;
    const CARD_PREVIEW_HEIGHT = CARD_PREVIEW_WIDTH * CARD_ASPECT_RATIO;
    const insets = useSafeAreaInsets();
    const [shareModalVisible, setShareModalVisible] = useState(false);

    // ── Animation shared values ──
    const ring1Scale = useSharedValue(0);
    const ring1Opacity = useSharedValue(0);
    const ring2Scale = useSharedValue(0);
    const ring2Opacity = useSharedValue(0);
    const ring3Scale = useSharedValue(0);
    const ring3Opacity = useSharedValue(0);

    const checkScale = useSharedValue(0);
    const heroOpacity = useSharedValue(0);
    const heroTranslate = useSharedValue(40);
    const cardOpacity = useSharedValue(0);
    const cardTranslate = useSharedValue(60);
    const cardScale = useSharedValue(0.94);
    const statsOpacity = useSharedValue(0);
    const ctasOpacity = useSharedValue(0);
    const ctasTranslate = useSharedValue(20);

    const sharePressOpacity = useSharedValue(1);
    const skipPressOpacity = useSharedValue(1);

    useEffect(() => {
        let cancelled = false;

        const resetToInitial = () => {
            ring1Scale.value = 0;
            ring1Opacity.value = 0;
            ring2Scale.value = 0;
            ring2Opacity.value = 0;
            ring3Scale.value = 0;
            ring3Opacity.value = 0;
            checkScale.value = 0;
            heroOpacity.value = 0;
            heroTranslate.value = 40;
            cardOpacity.value = 0;
            cardTranslate.value = 60;
            cardScale.value = 0.94;
            statsOpacity.value = 0;
            ctasOpacity.value = 0;
            ctasTranslate.value = 20;
        };

        const setFinalState = () => {
            ring1Opacity.value = 0;
            ring2Opacity.value = 0;
            ring3Opacity.value = 0;
            checkScale.value = 1;
            heroOpacity.value = 1;
            heroTranslate.value = 0;
            cardOpacity.value = 1;
            cardTranslate.value = 0;
            cardScale.value = 1;
            statsOpacity.value = 1;
            ctasOpacity.value = 1;
            ctasTranslate.value = 0;
        };

        if (!visible) {
            resetToInitial();
            return;
        }

        (async () => {
            const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
            if (cancelled) return;

            if (reduceMotion) {
                setFinalState();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                return;
            }

            // T+0: pulse rings staggered
            ring1Opacity.value = 0.6;
            ring1Scale.value = withTiming(2, {
                duration: 800,
                easing: Easing.out(Easing.cubic),
            });
            ring1Opacity.value = withTiming(0, { duration: 800 });

            ring2Opacity.value = withDelay(80, withTiming(0.5, { duration: 0 }));
            ring2Scale.value = withDelay(
                80,
                withTiming(2, { duration: 800, easing: Easing.out(Easing.cubic) }),
            );
            ring2Opacity.value = withDelay(80, withTiming(0, { duration: 800 }));

            ring3Opacity.value = withDelay(160, withTiming(0.4, { duration: 0 }));
            ring3Scale.value = withDelay(
                160,
                withTiming(2, { duration: 800, easing: Easing.out(Easing.cubic) }),
            );
            ring3Opacity.value = withDelay(160, withTiming(0, { duration: 800 }));

            // T+200: check + haptic
            checkScale.value = withDelay(
                200,
                withSequence(
                    withTiming(1.1, {
                        duration: 280,
                        easing: Easing.out(Easing.back(1.4)),
                    }),
                    withTiming(1, { duration: 160 }),
                ),
            );
            setTimeout(() => {
                if (cancelled) return;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }, 200);

            // T+500: hero text
            heroOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
            heroTranslate.value = withDelay(
                500,
                withTiming(0, {
                    duration: 400,
                    easing: Easing.out(Easing.cubic),
                }),
            );

            // T+900: card preview
            cardOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
            cardTranslate.value = withDelay(
                900,
                withTiming(0, {
                    duration: 500,
                    easing: Easing.out(Easing.cubic),
                }),
            );
            cardScale.value = withDelay(900, withTiming(1, { duration: 500 }));

            // T+1400: stats
            statsOpacity.value = withDelay(1400, withTiming(1, { duration: 350 }));

            // T+1700: CTAs
            ctasOpacity.value = withDelay(1700, withTiming(1, { duration: 350 }));
            ctasTranslate.value = withDelay(
                1700,
                withTiming(0, { duration: 350 }),
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [visible]);

    // ── Animated styles ──
    const ring1Style = useAnimatedStyle(() => ({
        opacity: ring1Opacity.value,
        transform: [{ scale: ring1Scale.value }],
    }));
    const ring2Style = useAnimatedStyle(() => ({
        opacity: ring2Opacity.value,
        transform: [{ scale: ring2Scale.value }],
    }));
    const ring3Style = useAnimatedStyle(() => ({
        opacity: ring3Opacity.value,
        transform: [{ scale: ring3Scale.value }],
    }));
    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));
    const heroStyle = useAnimatedStyle(() => ({
        opacity: heroOpacity.value,
        transform: [{ translateY: heroTranslate.value }],
    }));
    const cardStyle = useAnimatedStyle(() => ({
        opacity: cardOpacity.value,
        transform: [
            { translateY: cardTranslate.value },
            { scale: cardScale.value },
        ],
    }));
    const statsStyle = useAnimatedStyle(() => ({
        opacity: statsOpacity.value,
    }));
    const ctasStyle = useAnimatedStyle(() => ({
        opacity: ctasOpacity.value,
        transform: [{ translateY: ctasTranslate.value }],
    }));

    const shareBtnStyle = useAnimatedStyle(() => ({
        opacity: sharePressOpacity.value,
    }));
    const skipBtnStyle = useAnimatedStyle(() => ({
        opacity: skipPressOpacity.value,
    }));

    const handleOpenShare = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShareModalVisible(true);
    };

    if (!data) return null;

    // ── Preview template selection ──
    // Prefer MaxLoads if there are loads; fallback to FullWorkout (always has exerciseDetails).
    const hasMaxLoads = (data.maxLoads?.length ?? 0) > 0;
    const hasExerciseDetails = (data.exerciseDetails?.length ?? 0) > 0;
    const previewTemplate: 'maxloads' | 'fullworkout' = hasMaxLoads
        ? 'maxloads'
        : 'fullworkout';

    const prCount = data.maxLoads?.filter((l) => l.isPr).length ?? 0;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <LinearGradient
                    colors={['#1E1B4B', '#0F172A', '#020617']}
                    locations={[0, 0.5, 1]}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Header — only close button */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable
                        onPress={onClose}
                        hitSlop={12}
                        style={styles.closeButton}
                    >
                        <X size={18} color="#94A3B8" strokeWidth={2.5} />
                    </Pressable>
                </View>

                <View style={styles.body}>
                    {/* Pulse rings + check */}
                    <View style={styles.checkArea}>
                        <Animated.View style={[styles.pulseRing, ring1Style]} />
                        <Animated.View style={[styles.pulseRing, ring2Style]} />
                        <Animated.View style={[styles.pulseRing, ring3Style]} />
                        <Animated.View style={checkStyle}>
                            <LinearGradient
                                colors={['#34D399', '#10B981']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.checkCircle}
                            >
                                <Check size={56} color="#FFFFFF" strokeWidth={3.5} />
                            </LinearGradient>
                        </Animated.View>
                    </View>

                    {/* Hero text */}
                    <Animated.View style={[styles.heroText, heroStyle]}>
                        <Text style={styles.heroTitle}>Treino concluído</Text>
                        <Text style={styles.heroSubtitle} numberOfLines={1}>
                            {data.workoutName} · {formatRelativeDate(data.date)}
                        </Text>
                    </Animated.View>

                    {/* Card preview */}
                    <Animated.View
                        style={[
                            styles.previewWrapper,
                            {
                                width: CARD_PREVIEW_WIDTH,
                                height: CARD_PREVIEW_HEIGHT,
                            },
                            cardStyle,
                        ]}
                    >
                        <View
                            style={{
                                width: 320,
                                height: 568,
                                transform: [
                                    { scale: CARD_PREVIEW_WIDTH / 320 },
                                    { translateX: -(320 - CARD_PREVIEW_WIDTH) / 2 },
                                    {
                                        translateY:
                                            -(568 - CARD_PREVIEW_HEIGHT) / 2,
                                    },
                                ],
                            }}
                        >
                            {previewTemplate === 'maxloads' && (
                                <MaxLoadsTemplate {...data} />
                            )}
                            {previewTemplate === 'fullworkout' && (
                                <FullWorkoutTemplate {...data} />
                            )}
                        </View>
                    </Animated.View>

                    {/* Stats row */}
                    <Animated.View style={[styles.statsRow, statsStyle]}>
                        <View style={styles.statItem}>
                            <Clock size={16} color="#A78BFA" />
                            <Text style={styles.statValue}>
                                {formatDurationShort(data.duration)}
                            </Text>
                            <Text style={styles.statLabel}>DURAÇÃO</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <TrendingUp size={16} color="#F472B6" />
                            <Text style={styles.statValue}>
                                {formatVolumeShort(data.volume)}
                            </Text>
                            <Text style={styles.statLabel}>VOLUME</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Trophy size={16} color="#F4C04E" />
                            <Text style={styles.statValue}>{prCount}</Text>
                            <Text style={styles.statLabel}>PRS</Text>
                        </View>
                    </Animated.View>

                    {/* Fase 13 — Health card (Apple Watch). Esconde silenciosamente sem dados. */}
                    {data.sessionId && <HealthCardSlot sessionId={data.sessionId} />}
                </View>

                {/* CTAs */}
                <Animated.View
                    style={[
                        styles.actions,
                        { paddingBottom: Math.max(insets.bottom, 16) + 8 },
                        ctasStyle,
                    ]}
                >
                    <AnimatedPressable
                        onPress={handleOpenShare}
                        onPressIn={() => {
                            sharePressOpacity.value = withTiming(0.85, {
                                duration: 120,
                            });
                        }}
                        onPressOut={() => {
                            sharePressOpacity.value = withTiming(1, {
                                duration: 150,
                            });
                        }}
                        style={[shareBtnStyle]}
                    >
                        <LinearGradient
                            colors={['#7C3AED', '#A78BFA']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.shareButton}
                        >
                            <Share2 size={18} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={styles.shareButtonText}>
                                Compartilhar treino
                            </Text>
                        </LinearGradient>
                    </AnimatedPressable>

                    <AnimatedPressable
                        onPress={onClose}
                        onPressIn={() => {
                            skipPressOpacity.value = withTiming(0.6, {
                                duration: 120,
                            });
                        }}
                        onPressOut={() => {
                            skipPressOpacity.value = withTiming(1, {
                                duration: 150,
                            });
                        }}
                        style={[styles.skipButton, skipBtnStyle]}
                    >
                        <Text style={styles.skipText}>Voltar ao início</Text>
                    </AnimatedPressable>
                </Animated.View>
            </View>

            <ShareWorkoutModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                data={data}
                sessionId={data.sessionId}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 4,
    },
    closeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    body: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    checkArea: {
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        marginBottom: 18,
    },
    pulseRing: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 2,
        borderColor: '#34D399',
    },
    checkCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#34D399',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
    },
    heroText: {
        alignItems: 'center',
        marginBottom: 18,
    },
    heroTitle: {
        color: '#F8FAFC',
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: -1,
        marginBottom: 4,
    },
    heroSubtitle: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
    },
    previewWrapper: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 32,
        elevation: 16,
        backgroundColor: '#020617',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 18,
        paddingVertical: 12,
        paddingHorizontal: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        alignSelf: 'stretch',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    statValue: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    statLabel: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    actions: {
        paddingHorizontal: 24,
        gap: 8,
    },
    shareButton: {
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    skipButton: {
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#94A3B8',
    },
});
