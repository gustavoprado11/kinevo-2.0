/**
 * Avatar — gradient determinístico por nome + initials, com optional foto e status overlay.
 *
 * Sizes: sm 32 | md 42 | lg 60.
 * Status overlay: dot 12pt no canto bottom-right, border 2.5pt do bg do parent (branco).
 *
 * Tokens: shared/tokens/v2.
 */
import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import { getAvatarGradient, getInitials } from './utils/getAvatarGradient';

// Cores brand fixas (independem de modo) — light/dark partilham.
const { colors: lightColors } = v2;

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarStatus = 'online' | 'attention' | 'inactive';

export interface AvatarProps {
    name: string;
    size?: AvatarSize;
    src?: string | ImageSourcePropType;
    status?: AvatarStatus;
    accessibilityLabel?: string;
}

const SIZE_MAP: Record<AvatarSize, { box: number; font: number; statusDot: number }> = {
    sm: { box: 32, font: 12, statusDot: 10 },
    md: { box: 42, font: 14, statusDot: 12 },
    lg: { box: 60, font: 18, statusDot: 14 },
};

const STATUS_COLOR: Record<AvatarStatus, string> = {
    online: lightColors.semantic.success.default,
    attention: lightColors.semantic.warning.default,
    inactive: lightColors.neutral[400],
};

export function Avatar({
    name,
    size = 'md',
    src,
    status,
    accessibilityLabel,
}: AvatarProps) {
    const colors = useV2Colors();
    const dim = SIZE_MAP[size];
    const gradient = getAvatarGradient(name);
    const initials = getInitials(name);

    const imageSource = typeof src === 'string' ? { uri: src } : src;

    return (
        <View
            accessibilityRole="image"
            accessibilityLabel={accessibilityLabel ?? `Avatar de ${name}`}
            style={[
                styles.wrapper,
                {
                    width: dim.box,
                    height: dim.box,
                    borderRadius: dim.box / 2,
                },
            ]}
        >
            {imageSource ? (
                <Image
                    source={imageSource}
                    style={{
                        width: dim.box,
                        height: dim.box,
                        borderRadius: dim.box / 2,
                    }}
                    accessibilityIgnoresInvertColors
                />
            ) : (
                <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.gradient,
                        {
                            width: dim.box,
                            height: dim.box,
                            borderRadius: dim.box / 2,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.initials,
                            { fontSize: dim.font },
                        ]}
                    >
                        {initials}
                    </Text>
                </LinearGradient>
            )}

            {status ? (
                <View
                    style={[
                        styles.status,
                        {
                            width: dim.statusDot,
                            height: dim.statusDot,
                            borderRadius: dim.statusDot / 2,
                            backgroundColor: STATUS_COLOR[status],
                            borderWidth: 2.5,
                            // Border bate com o fundo do parent — surface.card é o uso
                            // mais comum (KCard); adapta ao modo.
                            borderColor: colors.surface.card,
                        },
                    ]}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
    },
    gradient: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        fontFamily: 'MonaSans_700Bold',
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    status: {
        position: 'absolute',
        right: -1,
        bottom: -1,
    },
});
