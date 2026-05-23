/**
 * GoalRing — arco SVG de meta semanal (WeekGoalCard, card dark).
 *
 * Track fino + fill arredondado começando do topo (12h). Anima o preenchimento
 * com Reanimated, respeitando reduce motion. Centro recebe `children`.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withTiming,
    Easing,
    useReducedMotion,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface GoalRingProps {
    value: number;
    max: number;
    size?: number;
    strokeWidth?: number;
    trackColor?: string;
    fillColor?: string;
    children?: React.ReactNode;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

export function GoalRing({
    value,
    max,
    size = 104,
    strokeWidth = 8,
    trackColor = 'rgba(255,255,255,0.08)',
    fillColor = '#A78BFA',
    children,
    accessibilityLabel,
    style,
}: GoalRingProps) {
    const reduceMotion = useReducedMotion();
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

    const progress = useSharedValue(reduceMotion ? fraction : 0);

    useEffect(() => {
        if (reduceMotion) {
            progress.value = fraction;
            return;
        }
        progress.value = withTiming(fraction, {
            duration: 600,
            easing: Easing.out(Easing.cubic),
        });
    }, [fraction, reduceMotion]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - progress.value),
    }));

    const center = size / 2;

    return (
        <View
            accessibilityRole="image"
            accessibilityLabel={accessibilityLabel ?? `${value} de ${max} treinos esta semana`}
            style={[{ width: size, height: size }, styles.wrap, style]}
        >
            <Svg width={size} height={size}>
                <G x={center} y={center} rotation={-90}>
                    <Circle
                        cx={0}
                        cy={0}
                        r={radius}
                        stroke={trackColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    <AnimatedCircle
                        cx={0}
                        cy={0}
                        r={radius}
                        stroke={fillColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={circumference}
                        animatedProps={animatedProps}
                    />
                </G>
            </Svg>
            <View pointerEvents="none" style={styles.center}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
