/**
 * KButton — botão premium com 4 variants + motion (reanimated) + haptics.
 *
 * Variants:
 *  - primary:     gradient roxo 3-stop + glow + texto branco
 *  - ghost:       bg transparent + texto purple[700]
 *  - outline:     bg card + border purple[300] + texto purple[700]
 *  - destructive: gradient danger + texto branco
 *
 * Sizes: sm | md | lg.
 * States: default, pressed, loading, disabled.
 *
 * Tokens: shared/tokens/v2.
 */
import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing, radius, shadows } = v2;

export type KButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive';
export type KButtonSize = 'sm' | 'md' | 'lg';

export interface KButtonProps {
    label: string;
    onPress?: () => void;
    variant?: KButtonVariant;
    size?: KButtonSize;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<KButtonSize, { paddingV: number; paddingH: number; font: number; minHeight: number }> = {
    sm: { paddingV: 8, paddingH: 16, font: 13, minHeight: 36 },
    md: { paddingV: 10, paddingH: 20, font: 14, minHeight: 44 },
    lg: { paddingV: 14, paddingH: 24, font: 16, minHeight: 52 },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function nativeShadow(token: typeof shadows.glowPurple) {
    return Platform.OS === 'ios' ? token.ios : token.android;
}

export function KButton({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    loading = false,
    disabled = false,
    accessibilityLabel,
    style,
}: KButtonProps) {
    const colors = useV2Colors();
    const dim = SIZE_MAP[size];
    const isPrimary = variant === 'primary';
    const isDestructive = variant === 'destructive';
    const isGradient = isPrimary || isDestructive;
    const isInactive = disabled || loading;

    const scale = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        if (isInactive) return;
        scale.value = withTiming(0.97, { duration: 90 });
    }, [isInactive]);

    const handlePressOut = useCallback(() => {
        if (isInactive) return;
        scale.value = withTiming(1, { duration: 140 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [isInactive]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const textColor = isGradient
        ? '#FFFFFF'
        : variant === 'outline' || variant === 'ghost'
            ? colors.purple[700]
            : colors.text.primary;

    // Hit slop pra garantir 44pt em sm
    const hitSlop = size === 'sm' ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined;

    const a11y = accessibilityLabel ?? label;

    const containerBaseStyle: StyleProp<ViewStyle> = [
        styles.base,
        {
            minHeight: dim.minHeight,
            paddingVertical: dim.paddingV,
            paddingHorizontal: dim.paddingH,
        },
        variant === 'ghost' && styles.ghost,
        variant === 'outline' && {
            backgroundColor: colors.surface.card,
            borderWidth: 1,
            borderColor: colors.purple[300],
        },
        isPrimary && nativeShadow(shadows.glowPurple),
        isInactive && styles.inactive,
        style,
    ];

    const content = (
        <View style={styles.row}>
            {loading ? (
                <ActivityIndicator size="small" color={textColor} />
            ) : (
                <>
                    {leadingIcon ? <View style={styles.iconLeading}>{leadingIcon}</View> : null}
                    <Text
                        style={{
                            fontFamily: 'PlusJakartaSans_700Bold',
                            fontSize: dim.font,
                            color: textColor,
                            letterSpacing: -0.01,
                        }}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                    {trailingIcon ? <View style={styles.iconTrailing}>{trailingIcon}</View> : null}
                </>
            )}
        </View>
    );

    return (
        <AnimatedPressable
            onPress={isInactive ? undefined : onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isInactive}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={a11y}
            accessibilityState={{ disabled: isInactive, busy: loading }}
            style={[containerBaseStyle, animatedStyle]}
        >
            {isPrimary ? (
                <LinearGradient
                    colors={[colors.purple[700], colors.purple[500], colors.purple[600]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : null}
            {isDestructive ? (
                <LinearGradient
                    colors={[colors.semantic.danger.fg, colors.semantic.danger.default]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : null}
            {content}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: radius.md,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    inactive: {
        opacity: 0.5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconLeading: {
        marginRight: spacing[2],
    },
    iconTrailing: {
        marginLeft: spacing[2],
    },
});
