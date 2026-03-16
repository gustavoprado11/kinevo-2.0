import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, TouchableOpacity } from "react-native";
import { Sparkles } from "lucide-react-native";

const MESSAGES = [
    "Analisando perfil do aluno...",
    "Selecionando exercícios ideais...",
    "Montando periodização...",
    "Validando regras de prescrição...",
    "Ajustando volume e intensidade...",
    "Finalizando programa...",
];

interface Props {
    elapsedSeconds: number;
    onCancel: () => void;
}

export function GenerationStatus({ elapsedSeconds, onCancel }: Props) {
    const spinAnim = useRef(new Animated.Value(0)).current;
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 3000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, [spinAnim]);

    // Cycle through messages
    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    const showTimeout = elapsedSeconds >= 90;

    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
            <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 24 }}>
                <Sparkles size={48} color="#7c3aed" />
            </Animated.View>

            <Text style={{ fontSize: 18, fontWeight: "700", color: "#1a1a2e", marginBottom: 8, textAlign: "center" }}>
                Gerando Programa
            </Text>

            <Text style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 20 }}>
                {MESSAGES[messageIndex]}
            </Text>

            {/* Progress dots */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
                {MESSAGES.map((_, idx) => (
                    <View
                        key={idx}
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: idx <= messageIndex ? "#7c3aed" : "#e2e8f0",
                        }}
                    />
                ))}
            </View>

            <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 24 }}>
                {elapsedSeconds}s
            </Text>

            {showTimeout ? (
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 14, color: "#d97706", textAlign: "center", marginBottom: 16, lineHeight: 20 }}>
                        A geração está demorando mais que o esperado...
                    </Text>
                    <TouchableOpacity
                        onPress={onCancel}
                        style={{
                            paddingHorizontal: 24,
                            paddingVertical: 12,
                            borderRadius: 12,
                            backgroundColor: "#fef2f2",
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity onPress={onCancel}>
                    <Text style={{ fontSize: 14, color: "#94a3b8" }}>Cancelar</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
