import React, { useEffect } from "react";
import { View, Text, Image, StyleSheet, StatusBar } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
} from "react-native-reanimated";
import { useAuth } from "../contexts/AuthContext";

export default function IndexScreen() {
    const { session, isLoading, isEmailVerified } = useAuth();
    const insets = useSafeAreaInsets();

    // Entrance animations
    const logoOpacity = useSharedValue(0);
    const logoScale = useSharedValue(0.9);
    const footerOpacity = useSharedValue(0);

    useEffect(() => {
        logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
        logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
        footerOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    }, []);

    const logoAnimStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [{ scale: logoScale.value }],
    }));

    const footerAnimStyle = useAnimatedStyle(() => ({
        opacity: footerOpacity.value,
    }));

    // 1. Loading state — premium splash
    if (isLoading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#111019" />
                <Animated.Image
                    source={require("../assets/splash-v2.png")}
                    style={[StyleSheet.absoluteFill, logoAnimStyle]}
                    resizeMode="cover"
                />
            </View>
        );
    }

    // 2. Not logged in
    if (!session) {
        return <Redirect href="/(auth)/login" />;
    }

    // 3. Email not verified
    if (!isEmailVerified) {
        return <Redirect href="/(auth)/verify-email" />;
    }

    // 4. Success — go to home
    return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#111019",
        alignItems: "center",
        justifyContent: "center",
    },
});
