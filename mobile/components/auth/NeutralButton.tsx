import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { ArrowRight, LucideIcon } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AuthTheme, FONT } from "./authTheme";

interface NeutralButtonProps {
    label: string;
    onPress: () => void;
    theme: AuthTheme;
    iconRight?: LucideIcon;
    loading?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EXPO = Easing.bezier(0.16, 1, 0.3, 1);

export function NeutralButton({
    label,
    onPress,
    theme,
    iconRight: IconRight = ArrowRight,
    loading = false,
    disabled = false,
    accessibilityLabel,
}: NeutralButtonProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const handlePressIn = useCallback(() => {
        scale.value = withTiming(0.985, { duration: 120, easing: EXPO });
        opacity.value = withTiming(0.92, { duration: 120, easing: EXPO });
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withTiming(1, { duration: 160, easing: EXPO });
        opacity.value = withTiming(1, { duration: 160, easing: EXPO });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: disabled || loading, busy: loading }}
            style={[styles.button, { backgroundColor: theme.ctaBg }, animatedStyle]}
        >
            {loading ? (
                <ActivityIndicator color={theme.ctaFg} />
            ) : (
                <>
                    <Text style={[styles.label, { color: theme.ctaFg }]}>{label}</Text>
                    <IconRight size={18} color={theme.ctaFg} strokeWidth={2.2} />
                </>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 52,
        borderRadius: 14,
    },
    label: {
        fontFamily: FONT.semibold,
        fontWeight: "600",
        fontSize: 16,
        letterSpacing: -0.16,
    },
});
