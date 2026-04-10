import React from "react";
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    iconColor: string;
    iconBg: string;
    subtitle?: string;
}

export function StatCard({ label, value, icon: Icon, iconColor, iconBg, subtitle }: StatCardProps) {
    const { isTablet, spacingScale, fontScale } = useResponsive();
    const padding = isTablet ? 20 : 16;
    const iconSize = isTablet ? 44 : 36;
    const iconInner = isTablet ? 22 : 18;

    return (
        <View
            accessibilityRole="summary"
            accessibilityLabel={`${label}: ${value}${subtitle ? `, ${subtitle}` : ''}`}
            style={{
                flex: 1,
                backgroundColor: colors.background.card,
                borderRadius: 20,
                padding,
                borderWidth: 1,
                borderColor: colors.border.primary,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            <View
                style={{
                    width: iconSize,
                    height: iconSize,
                    borderRadius: 12,
                    backgroundColor: iconBg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                }}
            >
                <Icon size={iconInner} color={iconColor} />
            </View>
            <Text style={{ fontSize: Math.round(24 * fontScale), fontWeight: "800", color: colors.text.primary }}>
                {value}
            </Text>
            <Text style={{ fontSize: Math.round(11 * fontScale), fontWeight: "600", color: colors.text.tertiary, marginTop: 4, letterSpacing: 0.5 }}>
                {label}
            </Text>
            {!!subtitle && (
                <Text style={{ fontSize: Math.round(11 * fontScale), color: colors.text.secondary, marginTop: 2 }}>
                    {subtitle}
                </Text>
            )}
        </View>
    );
}
