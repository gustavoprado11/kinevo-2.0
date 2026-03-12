import React from "react";
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    iconColor: string;
    iconBg: string;
    subtitle?: string;
}

export function StatCard({ label, value, icon: Icon, iconColor, iconBg, subtitle }: StatCardProps) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#ffffff",
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: iconBg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                }}
            >
                <Icon size={18} color={iconColor} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a" }}>
                {value}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#94a3b8", marginTop: 4, letterSpacing: 0.5 }}>
                {label}
            </Text>
            {!!subtitle && (
                <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {subtitle}
                </Text>
            )}
        </View>
    );
}
