/**
 * KStreakBadge — pill com flame emoji + count de streak.
 *
 * Variants:
 *   - pill (default): "🔥 12 sem seguidas"
 *   - compact: "🔥 12"
 *
 * `withGlow` (auto-true se count >= 10) adiciona shadow gold ao redor.
 * Flame faz micro-bounce em loop quando count >= 10 (chamando atenção pra streaks longas).
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';

const { radius } = v2;

export interface KStreakBadgeProps {
    count: number;
    unit?: 'semanas' | 'dias' | 'meses';
    size?: 'xs' | 'sm' | 'md';
    showFlame?: boolean;
    withGlow?: boolean;
    variant?: 'pill' | 'compact';
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

const SIZE_CONFIG = {
    xs: { fontSize: 10, paddingV: 3, paddingH: 8, flameSize: 11, gap: 4 },
    sm: { fontSize: 11.5, paddingV: 4, paddingH: 10, flameSize: 13, gap: 5 },
    md: { fontSize: 13, paddingV: 5, paddingH: 12, flameSize: 15, gap: 6 },
} as const;

const UNIT_SHORT: Record<NonNullable<KStreakBadgeProps['unit']>, string> = {
    semanas: 'sem',
    dias: 'dias',
    meses: 'meses',
};

export function KStreakBadge({
    count,
    unit = 'dias',
    size = 'sm',
    showFlame = true,
    withGlow,
    variant = 'pill',
    accessibilityLabel,
    style,
}: KStreakBadgeProps) {
    const isDark = useIsDark();
    const colors = useV2Colors();
    const cfg = SIZE_CONFIG[size];
    const shouldGlow = withGlow ?? count >= 10;
    const shouldBounce = count >= 10 && showFlame;

    const bounce = useSharedValue(0);
    useEffect(() => {
        if (!shouldBounce) {
            bounce.value = 0;
            return;
        }
        bounce.value = withRepeat(
            withSequence(
                withTiming(-2, { duration: 350, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(bounce);
    }, [shouldBounce]);

    const flameStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bounce.value }],
    }));

    const text = variant === 'compact'
        ? `${count}`
        : `${count} ${UNIT_SHORT[unit]}${count > 1 && unit !== 'meses' ? ' seguidas' : count > 1 ? ' seguidos' : ''}`;

    const a11y = accessibilityLabel ?? `Streak de ${count} ${unit}`;

    const gradStart = isDark ? 'rgba(254,243,199,0.16)' : '#FEF3C7';
    const gradEnd = isDark ? 'rgba(245,158,11,0.20)' : '#FDE68A';
    const fg = isDark ? '#FCD34D' : '#B45309';
    const borderColor = isDark ? 'rgba(245,158,11,0.32)' : 'rgba(245,158,11,0.30)';

    const glowStyle = shouldGlow
        ? Platform.OS === 'ios'
            ? {
                  shadowColor: '#F59E0B',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.32,
                  shadowRadius: 12,
              }
            : { elevation: 6 }
        : null;

    return (
        <View
            accessibilityRole="text"
            accessibilityLabel={a11y}
            style={[styles.wrap, glowStyle, style]}
        >
            <LinearGradient
                colors={[gradStart, gradEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.pill,
                    {
                        paddingVertical: cfg.paddingV,
                        paddingHorizontal: cfg.paddingH,
                        borderColor,
                        gap: cfg.gap,
                    },
                ]}
            >
                {showFlame ? (
                    <Animated.Text style={[{ fontSize: cfg.flameSize }, flameStyle]}>🔥</Animated.Text>
                ) : null}
                <Text style={[styles.label, { fontSize: cfg.fontSize, color: fg }]} numberOfLines={1}>
                    {text}
                </Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    label: {
        fontFamily: 'PlusJakartaSans_700Bold',
        letterSpacing: 0.2,
    },
});
