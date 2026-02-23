import React, { useCallback } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Scale to shrink to on press. Default: 0.97 */
    pressScale?: number;
    /** Whether to trigger a haptic on release. Default: true */
    haptic?: boolean;
    /** Type of haptic feedback. Default: Light */
    hapticStyle?: Haptics.ImpactFeedbackStyle;
}

/**
 * A card/button wrapper that provides:
 * - Squish on press-in (spring-based scale down)
 * - Bouncy release back to 1.0
 * - Light haptic impulse on release
 *
 * All animations run on the UI thread via Reanimated worklets at 60fps.
 */
export function PressableScale({
    children,
    onPress,
    disabled = false,
    style,
    pressScale = 0.97,
    haptic = true,
    hapticStyle = Haptics.ImpactFeedbackStyle.Light,
}: PressableScaleProps) {
    const scale = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(pressScale, {
            damping: 15,
            stiffness: 150,
            mass: 0.8,
        });
    }, [pressScale]);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, {
            damping: 12,
            stiffness: 200,
            mass: 0.6,
        });
        if (haptic) {
            Haptics.impactAsync(hapticStyle);
        }
    }, [haptic, hapticStyle]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={[style, animatedStyle]}
        >
            {children}
        </AnimatedPressable>
    );
}
