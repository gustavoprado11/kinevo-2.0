import React from "react";
import { View, StyleSheet, Platform, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface ScreenWrapperProps {
    children: React.ReactNode;
    bg?: string;
}

export function ScreenWrapper({ children, bg = "bg-[#F2F2F7]" }: ScreenWrapperProps) {
    const insets = useSafeAreaInsets();

    return (
        <View className={`flex-1 ${bg}`}>
            <StatusBar style="dark" backgroundColor="transparent" translucent />

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
