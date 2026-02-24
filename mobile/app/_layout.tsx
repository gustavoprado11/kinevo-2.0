import React from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { Platform } from "react-native";
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

function WatchStartBridge() {
    if (Platform.OS !== "ios") {
        return null;
    }

    const { useWatchConnectivity } = require("../hooks/useWatchConnectivity");
    const router = useRouter();
    const pathname = usePathname();
    const lastEventRef = React.useRef<{ workoutId: string; ts: number } | null>(null);

    const onWatchStartWorkout = React.useCallback(
        ({ workoutId }: { workoutId: string }) => {
            const now = Date.now();
            const lastEvent = lastEventRef.current;

            if (lastEvent && lastEvent.workoutId === workoutId && now - lastEvent.ts < 1200) {
                return;
            }

            lastEventRef.current = { workoutId, ts: now };
            const targetPath = `/workout/${workoutId}`;

            if (pathname === targetPath) {
                return;
            }

            console.log(`[Layout] Watch requested START_WORKOUT: ${workoutId}`);
            router.push({
                pathname: "/workout/[id]",
                params: { id: workoutId },
            });
        },
        [pathname, router]
    );

    useWatchConnectivity({ onWatchStartWorkout });

    return null;
}

export default function RootLayout() {
    console.log("[Layout] Renderizando Provider Wrapper");
    return (
        <AuthProvider>
            <SafeAreaProvider>
                <WatchStartBridge />
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
