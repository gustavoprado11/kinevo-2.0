// Settings: card de conexão Oura em /profile/connections.
// Modelo B (server-side): conectar abre OAuth → edge function guarda tokens e
// faz backfill. Oura traz sono, HRV (RMSSD), FC repouso e readiness nativo.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronUp, CircleDot, RefreshCw } from "lucide-react-native";

import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { useOuraSync } from "../../hooks/useOuraSync";
import { supabase } from "../../lib/supabase";

const OURA_ACCENT = "#14B8A6"; // teal — distinto do violet do app e do laranja do Strava

interface OuraConnectionState {
  status: string;
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

export function ConnectionRowOura() {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const oura = useOuraSync();

  const [conn, setConn] = useState<OuraConnectionState | null>(null);
  const [expanded, setExpanded] = useState(false);

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
      .select("status, last_sync_at")
      .eq("student_id", studentId)
      .eq("source", "oura")
      .maybeSingle();
    setConn((data as unknown as OuraConnectionState | null) ?? null);
  }, []);

  useEffect(() => {
    loadConnection();
  }, [loadConnection, oura.isAuthorized]);

  const isConnected = conn?.status === "active" && oura.isAuthorized;
  const isRevoked = conn?.status === "revoked";
  const hasError = conn?.status === "error";

  const handleConnect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await oura.requestAuthorization();
    if (ok) {
      await loadConnection();
    } else if (oura.error) {
      Alert.alert("Erro ao conectar", oura.error);
    }
  }, [oura, loadConnection]);

  const handleSyncNow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await oura.syncNow(14);
    if (!res.ok && res.error) Alert.alert("Erro ao sincronizar", res.error);
    await loadConnection();
  }, [oura, loadConnection]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      "Desconectar Oura",
      "Seus dados já importados permanecerão no Kinevo. Novos dados não serão sincronizados até reconectar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desconectar",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await oura.disconnect();
            await loadConnection();
            setExpanded(false);
          },
        },
      ],
    );
  }, [oura, loadConnection]);

  const subtitle = !isConnected
    ? isRevoked
      ? "Revogado · Reconectar"
      : hasError
        ? "Erro na sincronização · Reconectar"
        : "Sono, HRV, FC repouso e recuperação"
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
            <CircleDot size={20} color={OURA_ACCENT} strokeWidth={2.5} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Oura Ring</Text>
            <Text style={[styles.rowSub, (isRevoked || hasError) && styles.rowSubError]}>
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
          <Pressable onPress={handleConnect} style={styles.connectBtn} disabled={oura.isLoading}>
            {oura.isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.connectBtnText}>Conectar</Text>
            )}
          </Pressable>
        )}
      </Pressable>

      {isConnected && expanded && (
        <View style={styles.expanded}>
          <Text style={styles.infoText}>
            O Oura sincroniza automaticamente toda madrugada. Seus dados de sono,
            HRV (RMSSD), frequência cardíaca de repouso e prontidão têm prioridade
            sobre o Apple Saúde quando ambos estão conectados.
          </Text>
          <View style={styles.actionsRow}>
            <Pressable onPress={handleSyncNow} style={styles.syncBtn} disabled={oura.isLoading}>
              {oura.isLoading ? (
                <ActivityIndicator color={OURA_ACCENT} size="small" />
              ) : (
                <>
                  <RefreshCw size={14} color={OURA_ACCENT} strokeWidth={2.5} />
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
      backgroundColor: "rgba(20,184,166,0.12)",
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
      backgroundColor: OURA_ACCENT,
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
    infoText: { fontSize: 12, color: c.text.tertiary, lineHeight: 17 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    syncBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(20,184,166,0.3)",
    },
    syncBtnText: { color: OURA_ACCENT, fontWeight: "700", fontSize: 13 },
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
