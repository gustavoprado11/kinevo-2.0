/**
 * KSkeleton — placeholder animado pra loading states.
 *
 * Variants:
 *   - rect:   retângulo arredondado (default), bom pra textos
 *   - circle: círculo perfeito (avatares)
 *   - pill:   pill bem arredondada (chips, segmented)
 *
 * Animação shimmer via Reanimated:
 *   - Opacity ondula 0.4 → 0.8 → 0.4 num loop infinito (1200ms)
 *   - Performático: roda na UI thread (worklet)
 *
 * Variantes pré-fabricadas (compositions):
 *   - KSkeletonRow: avatar circle + linhas de texto
 *   - KSkeletonKPICard: layout do KPICard
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 *
 * Decorativo — `accessibilityRole="none"` + `importantForAccessibility="no-hide-descendants"`.
 */
import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    cancelAnimation,
} from 'react-native-reanimated';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors, useIsDark } from '../../hooks/useV2Colors';

const { radius } = v2;

export type KSkeletonVariant = 'rect' | 'circle' | 'pill';

export interface KSkeletonProps {
    variant?: KSkeletonVariant;
    width?: DimensionValue;
    height?: DimensionValue;
    style?: StyleProp<ViewStyle>;
}

export function KSkeleton({
    variant = 'rect',
    width,
    height,
    style,
}: KSkeletonProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.8, { duration: 600 }),
            -1,
            true,
        );
        return () => cancelAnimation(opacity);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const baseBg = isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[200];

    let borderRadius: number = radius.sm;
    if (variant === 'circle') {
        // Circle precisa width/height iguais. Usa min(w,h)/2 ou um número alto.
        borderRadius = 999;
    } else if (variant === 'pill') {
        borderRadius = radius.pill;
    }

    return (
        <Animated.View
            accessibilityRole="none"
            importantForAccessibility="no-hide-descendants"
            style={[
                {
                    backgroundColor: baseBg,
                    width,
                    height,
                    borderRadius,
                },
                animatedStyle,
                style,
            ]}
        />
    );
}

// ── Composições pré-fabricadas ──

export function KSkeletonRow({
    avatar = true,
    lines = 2,
    style,
}: {
    avatar?: boolean;
    lines?: 1 | 2 | 3;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
            {avatar ? <KSkeleton variant="circle" width={42} height={42} /> : null}
            <View style={{ flex: 1, gap: 6 }}>
                <KSkeleton width="60%" height={14} />
                {lines >= 2 ? <KSkeleton width="80%" height={11} /> : null}
                {lines >= 3 ? <KSkeleton width="40%" height={11} /> : null}
            </View>
        </View>
    );
}

export function KSkeletonKPICard({ style }: { style?: StyleProp<ViewStyle> }) {
    const colors = useV2Colors();
    return (
        <View
            style={[
                {
                    backgroundColor: colors.surface.card,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    padding: 16,
                    gap: 12,
                },
                style,
            ]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KSkeleton width={28} height={28} />
                <KSkeleton width="40%" height={11} />
            </View>
            <KSkeleton width="50%" height={28} />
        </View>
    );
}
