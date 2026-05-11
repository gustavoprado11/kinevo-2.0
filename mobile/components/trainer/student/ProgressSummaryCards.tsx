import React from "react";
import { View, Text } from "react-native";
import { TrendingUp, TrendingDown, Minus, Target, Flame } from "lucide-react-native";
import { spacing, typography } from "@/theme";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useResponsive } from "../../../hooks/useResponsive";
import type { ProgressSummary } from "../../../hooks/useStudentProgress";

interface Props {
    summary: ProgressSummary;
}

export function ProgressSummaryCards({ summary }: Props) {
    const colors = useV2Colors();
    const cardStyle = {
        flex: 1,
        backgroundColor: colors.surface.card,
        borderRadius: 14,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    } as const;
    const trendColor =
        summary.tonnageTrendDirection === "up"
            ? colors.semantic.success.default
            : summary.tonnageTrendDirection === "down"
              ? colors.semantic.danger.default
              : colors.text.tertiary;

    const trendIcon =
        summary.tonnageTrendDirection === "up" ? (
            <TrendingUp size={14} color={trendColor} />
        ) : summary.tonnageTrendDirection === "down" ? (
            <TrendingDown size={14} color={trendColor} />
        ) : (
            <Minus size={14} color={trendColor} />
        );

    const trendText =
        summary.tonnageTrendDirection === "up"
            ? `+${summary.tonnageTrend.toFixed(1)}%`
            : summary.tonnageTrendDirection === "down"
              ? `${summary.tonnageTrend.toFixed(1)}%`
              : "Estável";

    const adherenceColor =
        summary.adherencePercent >= 80
            ? colors.semantic.success.default
            : summary.adherencePercent >= 60
              ? colors.semantic.warning.default
              : colors.semantic.danger.default;

    return (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {/* Tonnage Trend */}
            <View style={cardStyle}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    {trendIcon}
                    <Text style={{ fontSize: typography.size.sm, color: colors.text.secondary }}>
                        Carga Total
                    </Text>
                </View>
                <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: trendColor }}>
                    {trendText}
                </Text>
            </View>

            {/* Adherence */}
            <View style={cardStyle}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <Target size={14} color={adherenceColor} />
                    <Text style={{ fontSize: typography.size.sm, color: colors.text.secondary }}>
                        Aderência
                    </Text>
                </View>
                <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: adherenceColor }}>
                    {summary.adherencePercent}%
                </Text>
                {/* Mini progress bar */}
                <View style={{ height: 3, backgroundColor: colors.border.default, borderRadius: 2, marginTop: 6 }}>
                    <View
                        style={{
                            height: 3,
                            width: `${Math.min(100, summary.adherencePercent)}%`,
                            backgroundColor: adherenceColor,
                            borderRadius: 2,
                        }}
                    />
                </View>
            </View>

            {/* Streak */}
            <View style={cardStyle}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <Flame size={14} color={summary.currentStreak > 0 ? "#f97316" : colors.text.tertiary} />
                    <Text style={{ fontSize: typography.size.sm, color: colors.text.secondary }}>
                        Sequência
                    </Text>
                </View>
                <Text
                    style={{
                        fontSize: typography.size.xl,
                        fontWeight: typography.weight.bold,
                        color: summary.currentStreak > 0 ? colors.text.primary : colors.text.tertiary,
                    }}
                >
                    {summary.currentStreak} sem
                </Text>
            </View>
        </View>
    );
}

