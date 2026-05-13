// Fase 16 · Settings: card de conexão Strava na tela /profile/connections.
// Pattern visual herdado das rows de Apple Saúde / Health Connect:
// row com ícone + título + subtítulo + botão "Conectar"/"Ativo" à direita.
// Expandido (quando conectado): toggles granulares por tipo + Sync agora / Desconectar.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Activity, ChevronDown, ChevronUp, RefreshCw } from "lucide-react-native";

import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { useStravaSync } from "../../hooks/useStravaSync";
import { supabase } from "../../lib/supabase";
import { ALL_STRAVA_CATEGORIES } from "../../lib/healthSync/stravaSync";
import type { StravaActivityType } from "../../lib/strava/types";

const STRAVA_ORANGE = "#FC5200";

const CATEGORY_LABELS: Record<StravaActivityType, string> = {
    running: "Corrida",
    cycling: "Ciclismo",
    swimming: "Natação",
    hiking: "Trilha",
    walking: "Caminhada",
    workout: "Workout funcional",
    rowing: "Remo",
    crossfit: "Crossfit",
    other: "Outros",
};

const DEFAULT_VISIBLE: StravaActivityType[] = [
    "running",
    "cycling",
    "swimming",
    "hiking",
    "walking",
    "workout",
];

interface StravaConnectionState {
    status: string;
    granted_categories: string[];
    last_sync_at: string | null;
}

function relativeTime(iso: string | null | undefined): string {
    if (!iso) return "nunca";
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d`;
}

export function ConnectionRowStrava() {
    const colors = useV2Colors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const strava = useStravaSync();

    const [conn, setConn] = useState<StravaConnectionState | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [activityCount, setActivityCount] = useState<number | null>(null);

    const loadConnection = useCallback(async () => {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) return;
        const { data: student } = await supabase
            .from("students" as any)
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
        const studentId = (student as { id?: string } | null)?.id;
        if (!studentId) return;

        const { data } = await supabase
            .from("wearable_connections" as any)
            .select("status, granted_categories, last_sync_at")
            .eq("student_id", studentId)
            .eq("source", "strava")
            .maybeSingle();
        setConn((data as unknown as StravaConnectionState | null) ?? null);

        const { count } = await supabase
            .from("external_activities" as any)
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId)
            .eq("source", "strava");
        setActivityCount(count ?? 0);
    }, []);

    useEffect(() => {
        loadConnection();
    }, [loadConnection, strava.isAuthorized]);

    const isConnected = conn?.status === "active" && strava.isAuthorized;
    const isRevoked = conn?.status === "revoked";
    const hasError = conn?.status === "error";

    const grantedSet = useMemo(
        () => new Set(conn?.granted_categories ?? ALL_STRAVA_CATEGORIES),
        [conn?.granted_categories],
    );

    const handleConnect = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const ok = await strava.requestAuthorization();
        if (ok) {
            // Dispara sync histórico em background após conectar.
            strava.syncHistorical(30).catch(() => undefined);
            await loadConnection();
        } else if (strava.error) {
            Alert.alert("Erro ao conectar", strava.error);
        }
    }, [strava, loadConnection]);

    const handleSyncNow = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const res = await strava.syncIncremental(30);
        if (!res.ok && res.error) {
            Alert.alert("Erro ao sincronizar", res.error);
        }
        await loadConnection();
    }, [strava, loadConnection]);

    const handleDisconnect = useCallback(() => {
        Alert.alert(
            "Desconectar Strava",
            "Suas atividades já importadas permanecerão no Kinevo. Novas atividades não serão sincronizadas até reconectar.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Desconectar",
                    style: "destructive",
                    onPress: async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        await strava.disconnect();
                        await loadConnection();
                        setExpanded(false);
                    },
                },
            ],
        );
    }, [strava, loadConnection]);

    const toggleCategory = useCallback(
        async (cat: StravaActivityType, next: boolean) => {
            Haptics.selectionAsync();
            const current = new Set(grantedSet);
            if (next) current.add(cat);
            else current.delete(cat);
            const list = Array.from(current);

            const { data: userRes } = await supabase.auth.getUser();
            const user = userRes?.user;
            if (!user) return;
            const { data: student } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .maybeSingle();
            const studentId = (student as { id?: string } | null)?.id;
            if (!studentId) return;

            await supabase
                .from("wearable_connections" as any)
                .update({ granted_categories: list })
                .eq("student_id", studentId)
                .eq("source", "strava");
            await loadConnection();
        },
        [grantedSet, loadConnection],
    );

    const subtitle = !isConnected
        ? isRevoked
            ? "Revogado · Reconectar"
            : hasError
              ? "Erro na última sync · Tentar novamente"
              : "Corridas, bike, natação, trilha"
        : activityCount != null && activityCount > 0
          ? `Conectado · ${activityCount} atividade${activityCount === 1 ? "" : "s"} · sync ${relativeTime(conn?.last_sync_at)}`
          : `Conectado · sync ${relativeTime(conn?.last_sync_at)}`;

    return (
        <View>
            <Pressable
                style={styles.row}
                onPress={() => {
                    if (isConnected) {
                        Haptics.selectionAsync();
                        setExpanded((p) => !p);
                    }
                }}
            >
                <View style={styles.rowLeft}>
                    <View style={styles.iconBadge}>
                        <Activity size={20} color={STRAVA_ORANGE} strokeWidth={2.5} />
                    </View>
                    <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>Strava</Text>
                        <Text
                            style={[
                                styles.rowSub,
                                (isRevoked || hasError) && styles.rowSubError,
                            ]}
                        >
                            {subtitle}
                        </Text>
                    </View>
                </View>
                {isConnected ? (
                    <View style={styles.rightCluster}>
                        <View style={styles.connectedPill}>
                            <Text style={styles.connectedPillText}>Ativo</Text>
                        </View>
                        {expanded ? (
                            <ChevronUp size={18} color={colors.text.tertiary} strokeWidth={2} />
                        ) : (
                            <ChevronDown size={18} color={colors.text.tertiary} strokeWidth={2} />
                        )}
                    </View>
                ) : (
                    <Pressable
                        onPress={handleConnect}
                        style={styles.connectBtn}
                        disabled={strava.isLoading}
                    >
                        {strava.isLoading ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Text style={styles.connectBtnText}>Conectar</Text>
                        )}
                    </Pressable>
                )}
            </Pressable>

            {isConnected && expanded && (
                <View style={styles.expanded}>
                    <Text style={styles.sectionLabel}>TIPOS IMPORTADOS</Text>
                    {DEFAULT_VISIBLE.map((cat) => (
                        <View key={cat} style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>{CATEGORY_LABELS[cat]}</Text>
                            <Switch
                                value={grantedSet.has(cat)}
                                onValueChange={(next) => toggleCategory(cat, next)}
                                trackColor={{
                                    false: colors.neutral[700],
                                    true: STRAVA_ORANGE,
                                }}
                                thumbColor="#FFFFFF"
                                ios_backgroundColor={colors.neutral[700]}
                            />
                        </View>
                    ))}

                    <View style={styles.actionsRow}>
                        <Pressable
                            onPress={handleSyncNow}
                            style={styles.syncBtn}
                            disabled={strava.isLoading}
                        >
                            {strava.isLoading ? (
                                <ActivityIndicator color={STRAVA_ORANGE} size="small" />
                            ) : (
                                <>
                                    <RefreshCw size={14} color={STRAVA_ORANGE} strokeWidth={2.5} />
                                    <Text style={styles.syncBtnText}>Sync agora</Text>
                                </>
                            )}
                        </Pressable>
                        <Pressable onPress={handleDisconnect} style={styles.disconnectBtn}>
                            <Text style={styles.disconnectBtnText}>Desconectar</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

function createStyles(c: V2Palette) {
    return StyleSheet.create({
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: c.surface.card,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 14,
            marginBottom: 8,
        },
        rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
        iconBadge: {
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: "rgba(252,82,0,0.12)",
            alignItems: "center",
            justifyContent: "center",
        },
        rowText: { flex: 1 },
        rowTitle: { fontSize: 14, fontWeight: "600", color: c.text.primary },
        rowSub: { fontSize: 12, color: c.text.tertiary, marginTop: 2 },
        rowSubError: { color: "#EF4444", fontWeight: "600" },
        rightCluster: { flexDirection: "row", alignItems: "center", gap: 8 },
        connectBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: STRAVA_ORANGE,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 10,
        },
        connectBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
        connectedPill: {
            backgroundColor: "rgba(34,197,94,0.15)",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
        },
        connectedPillText: { color: "#22C55E", fontWeight: "700", fontSize: 11 },
        expanded: {
            backgroundColor: c.surface.card,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginTop: -4,
            marginBottom: 8,
            borderTopWidth: 1,
            borderTopColor: c.border.subtle,
        },
        sectionLabel: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 1.6,
            color: c.text.tertiary,
            marginBottom: 8,
            paddingHorizontal: 2,
        },
        toggleRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
        },
        toggleLabel: { fontSize: 13, color: c.text.primary, fontWeight: "500" },
        actionsRow: {
            flexDirection: "row",
            gap: 8,
            marginTop: 12,
        },
        syncBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "rgba(252,82,0,0.3)",
        },
        syncBtnText: { color: STRAVA_ORANGE, fontWeight: "700", fontSize: 13 },
        disconnectBtn: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border.subtle,
        },
        disconnectBtnText: { color: c.text.tertiary, fontWeight: "600", fontSize: 13 },
    });
}
