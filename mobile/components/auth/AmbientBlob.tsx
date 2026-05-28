import React from "react";
import { StyleSheet, View } from "react-native";
import { AuthTheme } from "./authTheme";

interface AmbientBlobProps {
    theme: AuthTheme;
    position: "top-left" | "bottom-right";
}

/**
 * Blob ambiente decorativo (spec §6). Sem blur nativo — círculo grande de baixa
 * opacidade. Desligue se prejudicar FPS em Android low-end.
 */
export function AmbientBlob({ theme, position }: AmbientBlobProps) {
    return (
        <View
            pointerEvents="none"
            style={[
                styles.blob,
                { backgroundColor: theme.blob },
                position === "top-left" ? styles.topLeft : styles.bottomRight,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    blob: {
        position: "absolute",
        width: 420,
        height: 420,
        borderRadius: 9999,
        opacity: 0.3,
    },
    topLeft: {
        top: -180,
        left: -140,
    },
    bottomRight: {
        bottom: -180,
        right: -140,
    },
});
