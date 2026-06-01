/**
 * KRestTimer — inline pill countdown pra rest entre sets.
 *
 * Variant `inline-pill` (default): pequena pill purple no flow do treino, não disruptiva.
 * Variant `overlay` reservado pra Fase C (rest longo ≥120s), ainda não implementado.
 *
 * Pulse animation quando remaining < 10s sinaliza urgência sem bloquear UX.
 * onComplete dispara haptic strong + invoca callback.
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Clock, X } from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';
import { toRgba } from '../../../lib/brandColor';

const { radius } = v2;

export interface KRestTimerProps {
    duration: number;
    onComplete: () => void;
    onSkip?: () => void;
    variant?: 'inline-pill' | 'overlay';
    nextSetLabel?: string;
    startedAt?: Date;
    paused?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

function formatMMSS(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function KRestTimer({
    duration,
    onComplete,
    onSkip,
    variant = 'inline-pill',
    nextSetLabel,
    startedAt,
    paused,
    accessibilityLabel,
    style,
}: KRestTimerProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    const initialRemaining = useMemo(() => {
        if (!startedAt) return duration;
        const elapsed = (Date.now() - startedAt.getTime()) / 1000;
        return Math.max(0, duration - elapsed);
    }, [duration, startedAt]);

    const [remaining, setRemaining] = useState<number>(initialRemaining);
    const completedRef = useRef(false);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
        if (paused) return;
        if (remaining <= 0) return;
        const id = setInterval(() => {
            setRemaining((prev) => {
                const next = prev - 1;
                if (next <= 0 && !completedRef.current) {
                    completedRef.current = true;
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                    onCompleteRef.current();
                    return 0;
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [paused, remaining > 0]);

    const urgent = remaining > 0 && remaining < 10;
    const pulse = useSharedValue(1);
    useEffect(() => {
        if (urgent) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.06, { duration: 320, easing: Easing.out(Easing.quad) }),
                    withTiming(1, { duration: 320, easing: Easing.in(Easing.quad) }),
                ),
                -1,
                true,
            );
        } else {
            pulse.value = withTiming(1, { duration: 200 });
        }
        return () => cancelAnimation(pulse);
    }, [urgent]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    if (variant === 'overlay') {
        // TODO Fase C: overlay full-screen com BlurView pra rest longo.
        return null;
    }

    const gradColors: [string, string] = isDark
        ? [toRgba(colors.purple[600], 0.22), toRgba(colors.purple[600], 0.10)]
        : [colors.purple[100], colors.purple[100]];
    const borderColor = isDark ? 'rgba(167,139,250,0.32)' : colors.purple[200];
    const fg = isDark ? colors.purple[300] : colors.purple[700];
    const a11y = accessibilityLabel ?? `Descanso ${formatMMSS(remaining)} restante${nextSetLabel ? `, ${nextSetLabel}` : ''}`;

    return (
        <Animated.View
            accessibilityRole="timer"
            accessibilityLabel={a11y}
            style={[styles.wrap, pulseStyle, style]}
        >
            <LinearGradient
                colors={gradColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    styles.pill,
                    {
                        borderColor,
                    },
                    Platform.OS === 'ios' && urgent
                        ? {
                              shadowColor: colors.purple[600],
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.22,
                              shadowRadius: 8,
                          }
                        : null,
                ]}
            >
                <Clock size={11} color={fg} strokeWidth={2.5} />
                <Text style={[styles.timeText, { color: fg }]}>
                    {formatMMSS(remaining)} restante
                </Text>
                {nextSetLabel ? (
                    <Text style={[styles.nextText, { color: fg }]} numberOfLines={1}>
                        · {nextSetLabel}
                    </Text>
                ) : null}
                {onSkip ? (
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                            onSkip();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Pular descanso"
                        hitSlop={10}
                        style={styles.skipBtn}
                    >
                        <X size={11} color={fg} strokeWidth={2.5} />
                    </Pressable>
                ) : null}
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignSelf: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    timeText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 12,
        letterSpacing: 0.2,
    },
    nextText: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: 11,
        opacity: 0.85,
    },
    skipBtn: {
        marginLeft: 2,
        padding: 2,
    },
});
