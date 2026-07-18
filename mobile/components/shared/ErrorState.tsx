import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { AlertTriangle } from "lucide-react-native";

interface ErrorStateProps {
    message?: string;
    onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingVertical: 60 }}>
            <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#57534E", textAlign: "center" }}>
                {message || "Algo deu errado"}
            </Text>
            <Text style={{ fontSize: 13, color: "#8A8681", textAlign: "center", marginTop: 6 }}>
                Verifique sua conexão e tente novamente
            </Text>
            <TouchableOpacity
                onPress={onRetry}
                style={{
                    marginTop: 20,
                    backgroundColor: "#F4F3F1",
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                }}
            >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#57534E" }}>
                    Tentar novamente
                </Text>
            </TouchableOpacity>
        </View>
    );
}
