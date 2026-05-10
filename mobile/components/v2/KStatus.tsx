/**
 * KStatus — indicador semântico unificado.
 *
 * Layouts:
 *  - dot:   dot 5pt + texto
 *  - pill:  dot 5pt + texto dentro de pill com bg tinted
 *
 * Types: success | warning | danger | info | neutral.
 * Sizes: sm | md.
 *
 * Tokens: shared/tokens/v2 (semantic + neutral).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';

const { typography, spacing, radius } = v2;

export type KStatusType = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type KStatusLayout = 'dot' | 'pill';
export type KStatusSize = 'sm' | 'md';

export interface KStatusProps {
    type: KStatusType;
    label: string;
    layout?: KStatusLayout;
    size?: KStatusSize;
    accessibilityLabel?: string;
}

type Palette = { bg: string; fg: string; default: string };

export function KStatus({
    type,
    label,
    layout = 'dot',
    size = 'md',
    accessibilityLabel,
}: KStatusProps) {
    const colors = useV2Colors();
    const palette: Palette = type === 'neutral'
        ? {
              bg: colors.neutral[100],
              fg: colors.text.secondary,
              default: colors.text.quaternary,
          }
        : colors.semantic[type];
    const isPill = layout === 'pill';
    const isSm = size === 'sm';

    const dotSize = isSm ? 4 : 5;
    const fontSize = isPill ? (isSm ? 10 : 11) : (isSm ? 11 : typography.bodySm.size);
    const fontWeight = isPill ? '700' : '600';
    const fontFamily = isPill ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold';
    const letterSpacing = isPill ? 0.4 : 0;
    const transform = isPill ? 'uppercase' : 'none';

    const textColor = isPill ? palette.fg : colors.text.secondary;

    return (
        <View
            style={[
                styles.container,
                isPill && {
                    backgroundColor: palette.bg,
                    paddingHorizontal: isSm ? spacing[2] : spacing[3],
                    paddingVertical: isSm ? 2 : 3,
                    borderRadius: radius.pill,
                },
            ]}
            accessibilityRole="text"
            accessibilityLabel={accessibilityLabel ?? `${type} · ${label}`}
        >
            <View
                style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    backgroundColor: palette.default,
                    marginRight: isPill ? spacing[1] + 2 : spacing[2],
                }}
            />
            <Text
                style={{
                    fontFamily,
                    fontSize,
                    fontWeight: fontWeight as '600' | '700',
                    color: textColor,
                    letterSpacing,
                    textTransform: transform as 'uppercase' | 'none',
                }}
            >
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
});
