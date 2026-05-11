import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { spacing, typography } from "@/theme";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useStudentProgress } from "../../../hooks/useStudentProgress";
import { useResponsive } from "../../../hooks/useResponsive";
import { ProgressSummaryCards } from "./ProgressSummaryCards";
import { TonnageChart } from "./TonnageChart";
import { FrequencyChart } from "./FrequencyChart";

interface Props {
    studentId: string;
    expectedPerWeek: number;
}

export function ProgressCharts({ studentId, expectedPerWeek }: Props) {
    const colors = useV2Colors();
    const { isTablet } = useResponsive();
    const { weeklyData, summary, isLoading, error, refresh } = useStudentProgress(
        studentId,
        expectedPerWeek,
    );

    if (isLoading) {
        return (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.purple[600]} />
                <Text style={{ fontSize: typography.size.sm, color: colors.text.tertiary, marginTop: 8 }}>
                    Carregando progressão...
                </Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={{ backgroundColor: colors.surface.card, borderRadius: 14, padding: spacing.lg, alignItems: "center" }}>
                <Text style={{ fontSize: typography.size.md, color: colors.text.tertiary, marginBottom: 12 }}>
                    Erro ao carregar dados de progressão
                </Text>
                <TouchableOpacity
                    onPress={refresh}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors.purple[100],
                    }}
                >
                    <RefreshCw size={14} color={colors.purple[600]} />
                    <Text style={{ fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.purple[600] }}>
                        Tentar novamente
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (summary.totalSessions === 0) {
        return null;
    }

    return (
        <View style={{ gap: spacing.md }}>
            <Text
                style={{
                    fontSize: typography.size.sm,
                    fontWeight: typography.weight.semibold,
                    color: colors.text.secondary,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                }}
            >
                Progressão
            </Text>

            <ProgressSummaryCards summary={summary} />
            <View style={isTablet ? { flexDirection: 'row', gap: spacing.md } : undefined}>
                <View style={isTablet ? { flex: 1 } : undefined}>
                    <TonnageChart data={weeklyData} summary={summary} chartHeight={isTablet ? 280 : 200} weeksToShow={isTablet ? 12 : 8} />
                </View>
                <View style={isTablet ? { flex: 1 } : undefined}>
                    <FrequencyChart data={weeklyData} expectedPerWeek={expectedPerWeek} chartHeight={isTablet ? 280 : 160} weeksToShow={isTablet ? 12 : 8} />
                </View>
            </View>
        </View>
    );
}
