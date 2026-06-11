import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Lock, Unlock, ArrowRight } from "lucide-react-native";
import { walletFetch } from "../../lib/wallet-api";
import { useV2Colors } from "../../hooks/useV2Colors";
import type { FinancialStudent, DisplayStatus } from "../../types/financial";
import { formatBRL } from "@/lib/currency";

const STATUS_LABEL: Record<DisplayStatus, string> = {
    courtesy: "Cortesia",
    awaiting_payment: "Aguardando",
    active: "Ativo",
    grace_period: "Vence hoje",
    canceling: "Cancelando",
    overdue: "Inadimplente",
    canceled: "Encerrado",
    expired: "Expirado",
};

function daysOverdue(dateStr: string | null): number {
    if (!dateStr) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function statusLine(s: FinancialStudent): string {
    if (s.display_status === "overdue" && s.current_period_end) return `Atrasado há ${daysOverdue(s.current_period_end)}d`;
    if (s.display_status === "canceling" && s.current_period_end) return `Cancela em ${new Date(s.current_period_end).toLocaleDateString("pt-BR")}`;
    return STATUS_LABEL[s.display_status];
}

export function AttentionCard({ students, onChanged }: { students: FinancialStudent[]; onChanged: () => void }) {
    const colors = useV2Colors();
    const router = useRouter();
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    if (students.length === 0) return null;

    const unblock = async (studentId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUnblockingId(studentId);
        try {
            await walletFetch(`/api/students/${studentId}/access`, { method: "PATCH", body: { blocked: false } });
            onChanged();
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao liberar acesso");
        } finally {
            setUnblockingId(null);
        }
    };

    const shown = students.slice(0, 4);

    return (
        <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.subtle, overflow: "hidden", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.semantic.danger.default }} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>Precisam de atenção</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.semantic.danger.default }}>
                    {students.length} {students.length === 1 ? "item" : "itens"}
                </Text>
            </View>

            {shown.map((s, idx) => {
                const blocked = !!s.access_blocked_at;
                const isRed = s.display_status === "overdue" || s.display_status === "expired";
                return (
                    <View key={s.student_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.border.subtle }}>
                        <TouchableOpacity
                            onPress={() => s.contract_id && router.push(`/financial/contract/${s.contract_id}` as never)}
                            activeOpacity={0.7}
                            style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}
                        >
                            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: blocked ? "#fee2e2" : isRed ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.12)" }}>
                                {s.avatar_url ? (
                                    <Image source={{ uri: s.avatar_url }} style={{ width: 36, height: 36 }} />
                                ) : (
                                    <Text style={{ fontSize: 14, fontWeight: "700", color: blocked || isRed ? colors.semantic.danger.default : "#b45309" }}>
                                        {s.student_name?.charAt(0).toUpperCase() || "?"}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary, flexShrink: 1 }} numberOfLines={1}>
                                        {s.student_name}
                                    </Text>
                                    {blocked ? (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#fee2e2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                            <Lock size={8} color={colors.semantic.danger.default} strokeWidth={3} />
                                            <Text style={{ fontSize: 9, fontWeight: "700", color: colors.semantic.danger.default }}>Bloqueado</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text style={{ fontSize: 11, color: isRed ? colors.semantic.danger.default : colors.semantic.warning.fg, marginTop: 1 }}>
                                    {statusLine(s)}{s.amount ? ` · ${formatBRL(s.amount)}` : ""}
                                </Text>
                            </View>
                            {!blocked ? <ArrowRight size={14} color={colors.text.tertiary} /> : null}
                        </TouchableOpacity>
                        {blocked ? (
                            <TouchableOpacity
                                onPress={() => unblock(s.student_id)}
                                disabled={unblockingId === s.student_id}
                                activeOpacity={0.7}
                                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(16,185,129,0.12)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 }}
                            >
                                {unblockingId === s.student_id ? (
                                    <ActivityIndicator size="small" color="#047857" />
                                ) : (
                                    <Unlock size={11} color="#047857" strokeWidth={2.5} />
                                )}
                                <Text style={{ fontSize: 11, fontWeight: "700", color: "#047857" }}>Liberar</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                );
            })}

            {students.length > 4 ? (
                <TouchableOpacity
                    onPress={() => router.push("/financial/contracts" as never)}
                    activeOpacity={0.7}
                    style={{ paddingVertical: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border.subtle }}
                >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.purple[600] }}>Ver todos ({students.length})</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
