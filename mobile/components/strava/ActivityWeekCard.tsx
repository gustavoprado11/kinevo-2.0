// Fase 16 · Tab Saúde: 5º card discreto "Atividade · semana" (Strava).
// Mesmo padrão visual dos 4 HealthMetricCards mas full-width — color strip laranja.
// Aparece apenas se Strava conectado E há atividade na semana.

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Activity as ActivityIcon, ChevronRight } from "lucide-react-native";

import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { useStravaWeekSummary } from "../../hooks/useStravaActivities";

const STRAVA_ORANGE = "#FC5200";

const TYPE_LABELS_SHORT: Record<string, string> = {
    running: "corrida",
    cycling: "bike",
    swimming: "natação",
    hiking: "trilha",
    walking: "caminhada",
    workout: "workout",
    rowing: "remo",
    crossfit: "crossfit",
    other: "outro",
};

function formatDistanceShort(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
    return `${Math.round(meters)}m`;
}

function formatDurationShort(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const restMin = min % 60;
    return restMin > 0 ? `${h}h${restMin}` : `${h}h`;
}

function buildBreakdown(byType: Record<string, number>): string {
    const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    return entries
        .map(([type, count]) => {
            const label = TYPE_LABELS_SHORT[type] ?? type;
            const pluralized = count > 1 ? `${label}s` : label;
            return `${count} ${pluralized}`;
        })
        .join(", ");
}

export function ActivityWeekCard() {
    const colors = useV2Colors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const { summary, isLoading } = useStravaWeekSummary();

    if (isLoading || summary.count === 0) return null;

    return (
        <Pressable
            onPress={() => {
                Haptics.selectionAsync();
                router.push("/(tabs)/logs?filter=strava" as never);
            }}
            style={styles.card}
        >
            <View style={styles.stripe} />
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.labelCluster}>
                        <ActivityIcon size={12} color={STRAVA_ORANGE} strokeWidth={2.5} />
                        <Text style={styles.label}>ATIVIDADE · SEMANA</Text>
                    </View>
                    <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2} />
                </View>
                <View style={styles.heroRow}>
                    {summary.totalDistanceMeters > 0 && (
                        <View style={styles.heroCol}>
                            <Text style={styles.heroValue}>
                                {formatDistanceShort(summary.totalDistanceMeters)}
                            </Text>
                            <Text style={styles.heroUnit}>distância</Text>
                        </View>
                    )}
                    <View style={styles.heroCol}>
                        <Text style={styles.heroValue}>
                            {formatDurationShort(summary.totalDurationSeconds)}
                        </Text>
                        <Text style={styles.heroUnit}>tempo</Text>
                    </View>
                    <View style={styles.heroCol}>
                        <Text style={styles.heroValue}>{summary.count}</Text>
                        <Text style={styles.heroUnit}>
                            {summary.count === 1 ? "atividade" : "atividades"}
                        </Text>
                    </View>
                </View>
                <Text style={styles.sub}>Via Strava · {buildBreakdown(summary.byType)}</Text>
            </View>
        </Pressable>
    );
}

function createStyles(c: V2Palette) {
    return StyleSheet.create({
        card: {
            flexDirection: "row",
            backgroundColor: c.surface.card,
            borderRadius: 12,
            overflow: "hidden",
            marginTop: 12,
        },
        stripe: { width: 3, backgroundColor: STRAVA_ORANGE },
        content: { flex: 1, padding: 11 },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        labelCluster: { flexDirection: "row", alignItems: "center", gap: 4 },
        label: {
            fontSize: 9,
            fontWeight: "800",
            letterSpacing: 1.6,
            color: c.text.tertiary,
        },
        heroRow: {
            flexDirection: "row",
            alignItems: "baseline",
            gap: 16,
            marginTop: 6,
        },
        heroCol: { gap: 1 },
        heroValue: {
            fontSize: 20,
            fontWeight: "800",
            color: c.text.primary,
            letterSpacing: -0.5,
        },
        heroUnit: { fontSize: 10, color: c.text.tertiary, fontWeight: "500" },
        sub: { fontSize: 11, color: c.text.tertiary, marginTop: 6 },
    });
}
