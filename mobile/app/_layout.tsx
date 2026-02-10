import React from "react";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import "../global.css";

console.log("[Layout] Iniciando RootLayout");

export default function RootLayout() {
    console.log("[Layout] Renderizando Provider Wrapper");
    return (
        <AuthProvider>
            <SafeAreaProvider>
                <Slot />
            </SafeAreaProvider>
        </AuthProvider>
    );
}
