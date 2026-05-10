/**
 * KCard — shell padrão do DS v2.
 *
 * Variants:
 *  - default:  bg surface.card, border neutral[200], shadow xs
 *  - elevated: idem default + shadow sm
 *  - tinted:   bg surface.tintPurple, border purple[200]
 *
 * Quando `onPress` está presente, envolve em PressableScale (scale 0.99 + haptic light).
 * Sem onPress, renderiza View.
 *
 * Tokens: shared/tokens/v2.
 */
import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { v2 } from '@kinevo/shared/tokens';
import { PressableScale } from '../shared/PressableScale';
import { useV2Colors } from '../../hooks/useV2Colors';

const { spacing, radius, shadows } = v2;

export type KCardVariant = 'default' | 'elevated' | 'tinted';

export interface KCardProps {
    children?: React.ReactNode;
    variant?: KCardVariant;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

function nativeShadow(token: typeof shadows.xs) {
    return Platform.OS === 'ios' ? token.ios : token.android;
}

export function KCard({
    children,
    variant = 'default',
    onPress,
    style,
    accessibilityLabel,
}: KCardProps) {
    const colors = useV2Colors();
    const baseStyle: ViewStyle = {
        backgroundColor: colors.surface.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
    };
    const tintedStyle: ViewStyle = {
        backgroundColor: colors.surface.tintPurple,
        borderColor: colors.purple[200],
    };

    const cardStyle: StyleProp<ViewStyle> = [
        baseStyle,
        variant === 'elevated' && nativeShadow(shadows.sm),
        variant === 'tinted' && tintedStyle,
        variant !== 'tinted' && nativeShadow(shadows.xs),
        style,
    ];

    if (onPress) {
        return (
            <PressableScale
                onPress={onPress}
                pressScale={0.99}
                style={cardStyle}
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
            >
                {children}
            </PressableScale>
        );
    }

    return (
        <View
            style={cardStyle}
            accessibilityLabel={accessibilityLabel}
            accessible={!!accessibilityLabel}
        >
            {children}
        </View>
    );
}

