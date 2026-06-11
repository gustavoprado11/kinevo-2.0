import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Clock, Copy, Check, MessageCircle, RefreshCw, X } from "lucide-react-native";
import { walletFetch } from "../../lib/wallet-api";
import { timeAgo } from "../../lib/time";
import { useV2Colors } from "../../hooks/useV2Colors";
import type { PendingCharge } from "../../hooks/useFinancialDashboard";
import { formatBRL } from "@/lib/currency";

type Action = "copy" | "whatsapp" | "sync" | "cancel" | null;

export function PendingChargeRow({ charge, onChanged }: { charge: PendingCharge; onChanged: () => void }) {
    const colors = useV2Colors();
    const [loading, setLoading] = useState<Action>(null);
    const [copied, setCopied] = useState(false);
    const [url, setUrl] = useState<string | null>(null);

    const getUrl = async (): Promise<string | null> => {
        if (url) return url;
        const data = await walletFetch<{ url: string | null }>(`/api/wallet/charges/${charge.contractId}`);
        setUrl(data.url);
        return data.url;
    };

    const handleCopy = async () => {
        setLoading("copy");
        try {
            const u = await getUrl();
            if (!u) { Alert.alert("Link indisponível", "Gere uma nova cobrança."); return; }
            await Clipboard.setStringAsync(u);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao copiar");
        } finally {
            setLoading(null);
        }
    };

    const handleWhatsApp = async () => {
        setLoading("whatsapp");
        try {
            const u = await getUrl();
            if (!u) { Alert.alert("Link indisponível", "Gere uma nova cobrança."); return; }
            const name = charge.studentName ?? "seu aluno";
            const msg = `Olá ${name}! Aqui está o link para você pagar: ${u}`;
            await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao abrir o WhatsApp");
        } finally {
            setLoading(null);
        }
    };

    const handleSync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLoading("sync");
        try {
            const data = await walletFetch<{ synced: boolean; message?: string }>(
                `/api/wallet/charges/${charge.contractId}/sync`,
                { method: "POST" },
            );
            if (data.synced) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onChanged();
            } else {
                Alert.alert("Ainda aguardando", data.message ?? "Não recebemos a confirmação ainda.");
            }
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao sincronizar");
        } finally {
            setLoading(null);
        }
    };

    const handleCancel = () => {
        Alert.alert("Cancelar cobrança", "Desativar o link de pagamento desta cobrança?", [
            { text: "Voltar", style: "cancel" },
            {
                text: "Cancelar cobrança",
                style: "destructive",
                onPress: async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setLoading("cancel");
                    try {
                        await walletFetch(`/api/wallet/charges/${charge.contractId}`, { method: "DELETE" });
                        onChanged();
                    } catch (err) {
                        Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao cancelar");
                    } finally {
                        setLoading(null);
                    }
                },
            },
        ]);
    };

    const amber = "#f59e0b";

    return (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: amber }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 14, color: colors.text.primary }} numberOfLines={1}>
                            {charge.studentName ?? "Cobrança"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                            <Clock size={10} color={amber} />
                            <Text style={{ fontSize: 12, color: amber, fontWeight: "600" }}>Aguardando pagamento</Text>
                            <Text style={{ fontSize: 12, color: colors.text.quaternary }}>· {timeAgo(charge.createdAt)}</Text>
                        </View>
                    </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: amber }}>+{formatBRL(charge.amount)}</Text>
            </View>

            {/* Ações */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginLeft: 18 }}>
                <Pill onPress={handleCopy} loading={loading === "copy"} colors={colors}
                    icon={copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} color={colors.text.secondary} />}
                    label={copied ? "Copiado" : "Copiar link"} />
                <Pill onPress={handleWhatsApp} loading={loading === "whatsapp"} colors={colors}
                    icon={<MessageCircle size={12} color="#ffffff" />} label="WhatsApp" solid />
                <Pill onPress={handleSync} loading={loading === "sync"} colors={colors}
                    icon={<RefreshCw size={12} color={colors.text.secondary} />} label="Sincronizar" />
                <Pill onPress={handleCancel} loading={loading === "cancel"} colors={colors}
                    icon={<X size={12} color={colors.semantic.danger.default} />} label="Cancelar" danger />
            </View>
        </View>
    );
}

function Pill({ onPress, loading, icon, label, colors, solid, danger }: {
    onPress: () => void;
    loading: boolean;
    icon: React.ReactNode;
    label: string;
    colors: ReturnType<typeof useV2Colors>;
    solid?: boolean;
    danger?: boolean;
}) {
    const bg = solid ? "#16a34a" : "transparent";
    const borderColor = solid ? "#16a34a" : colors.border.default;
    const textColor = solid ? "#ffffff" : danger ? colors.semantic.danger.default : colors.text.secondary;
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: bg, borderWidth: solid ? 0 : 1, borderColor, opacity: loading ? 0.5 : 1 }}
        >
            {loading ? <ActivityIndicator size="small" color={textColor} /> : icon}
            <Text style={{ fontSize: 11, fontWeight: "600", color: textColor }}>{label}</Text>
        </TouchableOpacity>
    );
}
