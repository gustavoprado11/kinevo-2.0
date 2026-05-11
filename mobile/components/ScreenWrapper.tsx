import React from "react";
import { View, Platform, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useV2Colors, useIsDark } from "../hooks/useV2Colors";

interface ScreenWrapperProps {
    children: React.ReactNode;
    /** Override do bg. Aceita NativeWind className (legado) OU
     *  cor explícita via style. Quando omitido, usa colors.surface.canvas
     *  do v2 (adapta light/dark automaticamente). */
    bg?: string;
}

export function ScreenWrapper({ children, bg }: ScreenWrapperProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();
    useSafeAreaInsets();

    // Backward compat: se bg é classe Tailwind (starts with "bg-"),
    // mantém comportamento legado via className. Caso contrário (omitido
    // ou string vazia), aplica colors.surface.canvas via style — adapta
    // dark mode automaticamente.
    const isClassName = typeof bg === "string" && bg.startsWith("bg-");
    const dynamicStyle = isClassName ? undefined : { flex: 1, backgroundColor: colors.surface.canvas };
    const classNameProp = isClassName ? `flex-1 ${bg}` : "flex-1";

    return (
        <View className={classNameProp} style={dynamicStyle}>
            <StatusBar style={isDark ? "light" : "dark"} backgroundColor="transparent" translucent />

            {/* Custom Spacer for Status Bar on Android (if not handled by SafeAreaView) */}
            {Platform.OS === 'android' && (
                <View style={{ height: RNStatusBar.currentHeight }} />
            )}

            <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
                {children}
            </SafeAreaView>
        </View>
    );
}
