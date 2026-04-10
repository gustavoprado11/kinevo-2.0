import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "@/theme";

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <View
            accessibilityRole="alert"
            accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
            style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingVertical: 60 }}>
            <View style={{ marginBottom: 16, opacity: 0.5 }}>
                {icon}
            </View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text.secondary, textAlign: "center" }}>
                {title}
            </Text>
            {description && (
                <Text style={{ fontSize: 13, color: colors.text.tertiary, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                    {description}
                </Text>
            )}
            {actionLabel && onAction && (
                <TouchableOpacity
                    onPress={onAction}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    style={{
                        marginTop: 20,
                        backgroundColor: colors.brand.primary,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 10,
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.inverse }}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
