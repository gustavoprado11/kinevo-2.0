import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import "../global.css";

console.log("[Layout] Iniciando RootLayout");

// ── Premium iOS-like spring transition spec ──
const PREMIUM_SPRING = {
    animation: 'spring' as const,
    config: {
        stiffness: 800,
        damping: 100,
        mass: 3,
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
    },
};

export default function RootLayout() {
    console.log("[Layout] Renderizando Provider Wrapper");
    return (
        <AuthProvider>
            <SafeAreaProvider>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: '#F2F2F7' },
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                        animation: 'slide_from_right',
                        transitionSpec: {
                            open: PREMIUM_SPRING,
                            close: PREMIUM_SPRING,
                        },
                    }}
                />
            </SafeAreaProvider>
        </AuthProvider>
    );
}
