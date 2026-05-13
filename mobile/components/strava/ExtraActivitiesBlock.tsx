// Fase 16 · Home: bloco minimal "Atividades extras · esta semana" no rodapé.
// Strava é contexto, não protagonista — render só se aluno conectou E tem >=1
// atividade nos últimos 7 dias. Senão, retorna null e Home volta ao normal.

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
    Activity as ActivityIcon,
    Bike,
    ChevronRight,
    Footprints,
    Mountain,
    Waves,
} from "lucide-react-native";

import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { useStravaWeekSummary } from "../../hooks/useStravaActivities";

const STRAVA_ORANGE = "#FC5200";

const TYPE_LABELS: Record<string, string> = {
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

function iconForType(type: string, size = 12) {
    const props = { size, color: STRAVA_ORANGE, strokeWidth: 2.5 };
    switch (type) {
        case "cycling":
            return <Bike {...props} />;
        case "swimming":
            return <Waves {...props} />;
        case "hiking":
            return <Mountain {...props} />;
        case "walking":
            return <Footprints {...props} />;
        default:
            return <ActivityIcon {...props} />;
    }
}

function formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
    return `${Math.round(meters)}m`;
}

function pluralize(count: number, singular: string, plural: string): string {
    return count === 1 ? singular : plural;
}

export function ExtraActivitiesBlock() {
    const colors = useV2Colors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const { summary, isLoading } = useStravaWeekSummary();

    if (isLoading || summary.count === 0) return null;

    const typeChips = Object.entries(summary.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    const distanceLabel = formatDistance(summary.totalDistanceMeters);
    const activityLabel = pluralize(summary.count, "atividade", "atividades");

    return (
        <Pressable
            onPress={() => {
                Haptics.selectionAsync();
                router.push("/(tabs)/logs?filter=strava" as never);
            }}
            style={styles.wrapper}
        >
            <Text style={styles.eyebrow}>ATIVIDADES EXTRAS · ESTA SEMANA</Text>
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <ActivityIcon size={16} color={STRAVA_ORANGE} strokeWidth={2.5} />
                    <Text style={styles.headerText}>
                        {summary.totalDistanceMeters > 0
                            ? `${distanceLabel} · ${summary.count} ${activityLabel}`
                            : `${summary.count} ${activityLabel}`}
                    </Text>
                </View>
                <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2} />
            </View>
            {typeChips.length > 0 && (
                <View style={styles.chipsRow}>
                    {typeChips.map(([type, count]) => (
                        <View key={type} style={styles.chip}>
                            {iconForType(type, 11)}
                            <Text style={styles.chipText}>
                                {count} {TYPE_LABELS[type] ?? type}
                                {count > 1 ? "s" : ""}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </Pressable>
    );
}

function createStyles(c: V2Palette) {
    return StyleSheet.create({
        wrapper: {
            marginTop: 20,
            paddingTop: 16,
            paddingHorizontal: 4,
            borderTopWidth: 1,
            borderTopColor: c.border.subtle,
        },
        eyebrow: {
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 2,
            color: c.text.tertiary,
            marginBottom: 10,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
        headerText: {
            fontSize: 15,
            fontWeight: "700",
            color: c.text.primary,
            letterSpacing: -0.2,
        },
        chipsRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
        },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: "rgba(252,82,0,0.10)",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
        },
        chipText: { fontSize: 11, color: STRAVA_ORANGE, fontWeight: "700" },
    });
}
