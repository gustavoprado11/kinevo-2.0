import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingVertical: 60 }}>
            <View style={{ marginBottom: 16, opacity: 0.5 }}>
                {icon}
            </View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#64748b", textAlign: "center" }}>
                {title}
            </Text>
            {description && (
                <Text style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    {description}
                </Text>
            )}
            {actionLabel && onAction && (
                <TouchableOpacity
                    onPress={onAction}
                    style={{
                        marginTop: 20,
                        backgroundColor: "#7c3aed",
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 10,
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
