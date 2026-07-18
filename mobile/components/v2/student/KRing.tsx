/**
 * KRing — Activity ring SVG (Apple Fitness style).
 *
 * Variants:
 *  - single: 1 ring com progress value/max
 *  - triple: 3 rings concêntricos com 3 valores independentes
 *
 * Tamanhos sm/md/lg ditam radius + strokeWidth (ver utils/ringCalculator).
 * Cores semânticas mapeadas pra tokens v2.
 *
 * Animação:
 *   - strokeDashoffset interpolado via Reanimated (withTiming 600ms)
 *   - `transform: rotate(-90deg)` no SVG pra começar do topo (12h)
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';
import {
    RING_SIZE_MAP,
    circumference,
    tripleRingRadii,
    type RingSize,
} from './utils/ringCalculator';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type KRingVariant = 'single' | 'triple';
export type KRingColor = 'purple' | 'red' | 'green' | 'cyan' | 'gold';

const COLOR_MAP: Record<KRingColor, string> = {
    purple: '#6D28D9',
    red: '#FF375F',
    green: '#10B981',
    cyan: '#5AC8FA',
    gold: '#F59E0B',
};

export interface KRingProps {
    variant?: KRingVariant;
    value: number;
    max: number;
    values?: [number, number, number];
    maxes?: [number, number, number];
    size?: RingSize;
    color?: KRingColor;
    colors?: [string, string, string];
    label?: string;
    centerContent?: React.ReactNode;
    animated?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Animated single ring — uma instância de Circle bg + Circle fg interpolando offset.
 */
function SingleRing({
    radius,
    strokeWidth,
    value,
    max,
    color,
    bgColor,
    animated,
}: {
    radius: number;
    strokeWidth: number;
    value: number;
    max: number;
    color: string;
    bgColor: string;
    animated: boolean;
}) {
    const c = circumference(radius);
    const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    const progress = useSharedValue(animated ? 0 : fraction);

    useEffect(() => {
        if (!animated) {
            progress.value = fraction;
            return;
        }
        progress.value = withTiming(fraction, {
            duration: 600,
            easing: Easing.out(Easing.cubic),
        });
    }, [fraction, animated]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: c * (1 - progress.value),
    }));

    return (
        <>
            <Circle
                cx={0}
                cy={0}
                r={radius}
                stroke={bgColor}
                strokeWidth={strokeWidth}
                fill="none"
            />
            <AnimatedCircle
                cx={0}
                cy={0}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={c}
                animatedProps={animatedProps}
            />
        </>
    );
}

export function KRing({
    variant = 'single',
    value,
    max,
    values,
    maxes,
    size = 'md',
    color = 'purple',
    colors: colorsOverride,
    label,
    centerContent,
    animated = true,
    accessibilityLabel,
    style,
}: KRingProps) {
    const palette = useV2Colors();
    const isDark = useIsDark();
    const { size: svgSize, radius, strokeWidth } = RING_SIZE_MAP[size];
    // Ring roxo segue a marca do estúdio (rebrand via palette.purple[N]);
    // demais cores semânticas (red/green/cyan/gold) ficam fixas.
    const primaryColor = color === 'purple' ? palette.purple[600] : COLOR_MAP[color];

    const bgAlpha = isDark ? 0.18 : 0.14;
    const bgFor = (hex: string) => hexToRgba(hex, bgAlpha);

    const center = svgSize / 2;
    const a11y =
        accessibilityLabel
        ?? (variant === 'triple'
            ? `Activity rings: ${values?.[0] ?? 0}/${maxes?.[0] ?? 0}, ${values?.[1] ?? 0}/${maxes?.[1] ?? 0}, ${values?.[2] ?? 0}/${maxes?.[2] ?? 0}`
            : `${value} de ${max}${label ? ` ${label}` : ''}`);

    return (
        <View
            accessibilityRole="image"
            accessibilityLabel={a11y}
            style={[styles.wrap, { width: svgSize, height: svgSize }, style]}
        >
            <Svg width={svgSize} height={svgSize}>
                <G x={center} y={center} rotation={-90}>
                    {variant === 'triple' ? (
                        (() => {
                            const radii = tripleRingRadii(size);
                            const tripleColors: [string, string, string] = colorsOverride ?? [
                                '#FF375F',
                                '#A8FF60',
                                '#5AC8FA',
                            ];
                            const vals = values ?? [0, 0, 0];
                            const ms = maxes ?? [1, 1, 1];
                            return radii.map((r, i) => (
                                <SingleRing
                                    key={i}
                                    radius={r}
                                    strokeWidth={strokeWidth}
                                    value={vals[i]}
                                    max={ms[i]}
                                    color={tripleColors[i]}
                                    bgColor={bgFor(tripleColors[i])}
                                    animated={animated}
                                />
                            ));
                        })()
                    ) : (
                        <SingleRing
                            radius={radius}
                            strokeWidth={strokeWidth}
                            value={value}
                            max={max}
                            color={primaryColor}
                            bgColor={bgFor(primaryColor)}
                            animated={animated}
                        />
                    )}
                </G>
            </Svg>

            <View pointerEvents="none" style={styles.center}>
                {centerContent ?? (
                    label ? (
                        <Text style={[styles.label, labelStyleFor(size), { color: palette.text.tertiary }]}>
                            {label}
                        </Text>
                    ) : null
                )}
            </View>
        </View>
    );
}

function labelStyleFor(size: RingSize) {
    if (size === 'sm') return { fontSize: 9 };
    if (size === 'md') return { fontSize: 11 };
    return { fontSize: 13 };
}

function hexToRgba(hex: string, alpha: number): string {
    // Aceita #RRGGBB ou rgba(...) (passthrough).
    if (hex.startsWith('rgba')) return hex;
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontFamily: 'MonaSans_700Bold',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
});

const { spacing: _spacing } = v2;
