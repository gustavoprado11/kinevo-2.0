// Fase 16 · Histórico: row de atividade Strava (paralela ao HistoryCard).
// Color strip laranja + ícone tipo + nome + métricas. Tap → deep link Strava.

import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
    Activity as ActivityIcon,
    Bike,
    ExternalLink,
    Footprints,
    Mountain,
    Waves,
} from "lucide-react-native";

import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import type { Database } from "@kinevo/shared";

const STRAVA_ORANGE = "#FC5200";

type ExternalActivityRow =
    Database["public"]["Tables"]["external_activities"]["Row"];

function iconForType(type: string, size = 16) {
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

function formatDistance(meters: number | null | undefined): string | null {
    if (meters == null || meters === 0) return null;
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
    return `${Math.round(meters)}m`;
}

function formatDuration(seconds: number): string {
    const min = Math.floor(seconds / 60);
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const restMin = min % 60;
    return restMin > 0 ? `${h}h${restMin}` : `${h}h`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
    });
}

export async function openStravaActivity(externalId: string) {
    Haptics.selectionAsync();
    const appUrl = `strava://activities/${externalId}`;
    const webUrl = `https://www.strava.com/activities/${externalId}`;
    try {
        const supported = await Linking.canOpenURL(appUrl);
        await Linking.openURL(supported ? appUrl : webUrl);
    } catch {
        await Linking.openURL(webUrl).catch(() => undefined);
    }
}

export function StravaActivityRow({ activity }: { activity: ExternalActivityRow }) {
    const colors = useV2Colors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const distance = formatDistance(activity.distance_meters);
    const duration = formatDuration(activity.duration_seconds ?? 0);
    const hr = activity.avg_heart_rate;

    return (
        <Pressable
            onPress={() => openStravaActivity(activity.external_id)}
            style={styles.card}
        >
            <View style={styles.stripe} />
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.iconBadge}>{iconForType(activity.activity_type)}</View>
                    <View style={styles.headerText}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title} numberOfLines={1}>
                                {activity.name}
                            </Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Strava</Text>
                            </View>
                        </View>
                        <Text style={styles.subtitle}>{formatDate(activity.started_at)}</Text>
                    </View>
                    <ExternalLink size={14} color={colors.text.quaternary} strokeWidth={2} />
                </View>
                <View style={styles.metricsRow}>
                    {distance && (
                        <View style={styles.metricCol}>
                            <Text style={styles.metricValue}>{distance}</Text>
                            <Text style={styles.metricLabel}>distância</Text>
                        </View>
                    )}
                    <View style={styles.metricCol}>
                        <Text style={styles.metricValue}>{duration}</Text>
                        <Text style={styles.metricLabel}>tempo</Text>
                    </View>
                    {hr != null && (
                        <View style={styles.metricCol}>
                            <Text style={styles.metricValue}>{hr}</Text>
                            <Text style={styles.metricLabel}>HR média</Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

function createStyles(c: V2Palette) {
    return StyleSheet.create({
        card: {
            flexDirection: "row",
            backgroundColor: c.surface.card,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 10,
        },
        stripe: { width: 4, backgroundColor: STRAVA_ORANGE },
        content: { flex: 1, padding: 12 },
        headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        iconBadge: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "rgba(252,82,0,0.12)",
            alignItems: "center",
            justifyContent: "center",
        },
        headerText: { flex: 1 },
        titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        title: {
            fontSize: 14,
            fontWeight: "700",
            color: c.text.primary,
            flexShrink: 1,
            letterSpacing: -0.2,
        },
        badge: {
            backgroundColor: "rgba(252,82,0,0.15)",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 5,
        },
        badgeText: {
            fontSize: 9,
            fontWeight: "800",
            color: STRAVA_ORANGE,
            letterSpacing: 0.6,
            textTransform: "uppercase",
        },
        subtitle: {
            fontSize: 11,
            color: c.text.tertiary,
            marginTop: 2,
            textTransform: "capitalize",
        },
        metricsRow: { flexDirection: "row", gap: 18, marginTop: 10 },
        metricCol: { gap: 1 },
        metricValue: {
            fontSize: 16,
            fontWeight: "800",
            color: c.text.primary,
            letterSpacing: -0.3,
        },
        metricLabel: { fontSize: 10, color: c.text.tertiary, fontWeight: "500" },
    });
}
