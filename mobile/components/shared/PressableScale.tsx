import React, { useCallback } from 'react';
import { type AccessibilityState, Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ANIM } from '../../lib/animations';

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
    /** Accessibility label for screen readers */
    accessibilityLabel?: string;
    /** Accessibility role. Default: "button" */
    accessibilityRole?: 'button' | 'link' | 'tab' | 'none';
    /** Accessibility hint */
    accessibilityHint?: string;
    /** Accessibility state */
    accessibilityState?: AccessibilityState;
}

/**
 * A card/button wrapper that provides:
 * - Subtle scale-down on press-in
 * - Smooth release back to 1.0
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
    accessibilityLabel,
    accessibilityRole = 'button',
    accessibilityHint,
    accessibilityState,
}: PressableScaleProps) {
    const scale = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        scale.value = withTiming(pressScale, {
            duration: 100,
            easing: ANIM.timing.fast.easing,
        });
    }, [pressScale]);

    const handlePressOut = useCallback(() => {
        scale.value = withTiming(1, ANIM.timing.fast);
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
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            accessibilityHint={accessibilityHint}
            accessibilityState={accessibilityState}
        >
            {children}
        </AnimatedPressable>
    );
}
