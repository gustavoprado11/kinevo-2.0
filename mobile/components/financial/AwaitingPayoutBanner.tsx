import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import { AlertCircle, Link2 } from "lucide-react-native";
import { walletFetch } from "../../lib/wallet-api";
import { timeAgo } from "../../lib/time";
import type { AwaitingPayout } from "../../hooks/useFinancialDashboard";

function formatBRL(value: number): string {
    const [i, d] = value.toFixed(2).split(".");
    return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
}

export function AwaitingPayoutBanner({ payouts, onChanged }: { payouts: AwaitingPayout[]; onChanged: () => void }) {
    const [syncingId, setSyncingId] = useState<string | null>(null);
    if (payouts.length === 0) return null;

    const confirm = async (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSyncingId(id);
        try {
            const data = await walletFetch<{ statusLocal: string }>(`/api/wallet/payouts/${id}/sync`, { method: "POST" });
            if (data.statusLocal === "completed") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onChanged();
            } else if (data.statusLocal === "awaiting_authorization") {
                Alert.alert("Ainda aguardando", "Confirme no painel da Asaas e tente de novo.");
            } else {
                onChanged();
            }
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao sincronizar");
        } finally {
            setSyncingId(null);
        }
    };

    return (
        <View style={{ backgroundColor: "#fffbeb", borderWidth: 2, borderColor: "#fcd34d", borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#fde68a", alignItems: "center", justifyContent: "center" }}>
                    <AlertCircle size={20} color="#b45309" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#78350f" }}>
                        {payouts.length === 1 ? "1 saque aguardando" : `${payouts.length} saques aguardando`} confirmação na Asaas
                    </Text>
                    <Text style={{ fontSize: 12, color: "#92400e", marginTop: 2, lineHeight: 17 }}>
                        Por segurança, a Asaas pediu confirmação por SMS pra liberar o PIX. Sem isso o dinheiro não cai na sua conta.
                    </Text>

                    <View style={{ gap: 6, marginTop: 12 }}>
                        {payouts.map((p) => (
                            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fde68a", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ fontSize: 12 }} numberOfLines={1}>
                                        <Text style={{ fontWeight: "700", color: "#1c1917" }}>{formatBRL(p.amount)}</Text>
                                        <Text style={{ color: "#92400e" }}>  PIX → {p.pixKeyType ?? "chave"} · {timeAgo(p.requestedAt)}</Text>
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => confirm(p.id)} disabled={syncingId === p.id} hitSlop={6}>
                                    {syncingId === p.id ? (
                                        <ActivityIndicator size="small" color="#b45309" />
                                    ) : (
                                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#b45309" }}>Já confirmei</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        onPress={() => Linking.openURL("https://www.asaas.com/home")}
                        activeOpacity={0.85}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#d97706", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 12 }}
                    >
                        <Link2 size={12} color="#ffffff" />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>Abrir painel da Asaas</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
