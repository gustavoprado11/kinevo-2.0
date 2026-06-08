import React from "react";
import { View, Text, Image } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { PressableScale } from "../shared/PressableScale";
import type { FinancialStudent, DisplayStatus } from "../../types/financial";
import { useV2Colors } from "../../hooks/useV2Colors";
import { formatBRL } from "@/lib/currency";

const STATUS_CONFIG: Record<DisplayStatus, { bg: string; text: string; label: string }> = {
    courtesy: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", label: "Cortesia" },
    awaiting_payment: { bg: "rgba(14,165,233,0.12)", text: "#0ea5e9", label: "Aguardando" },
    active: { bg: "rgba(34,197,94,0.12)", text: "#16a34a", label: "Ativo" },
    grace_period: { bg: "rgba(249,115,22,0.12)", text: "#f97316", label: "Vence hoje" },
    canceling: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "Cancelando" },
    overdue: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "Inadimplente" },
    canceled: { bg: "rgba(148,163,184,0.16)", text: "#94a3b8", label: "Encerrado" },
    expired: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "Expirado" },
};

const BILLING_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    asaas_auto: { bg: "rgba(124,58,237,0.12)", text: "#7c3aed", label: "Carteira" },
    asaas_auto_recurring: { bg: "rgba(124,58,237,0.12)", text: "#7c3aed", label: "Carteira" },
    stripe_auto: { bg: "rgba(124,58,237,0.12)", text: "#7c3aed", label: "Stripe" },
    manual_recurring: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", label: "Manual" },
    manual_one_off: { bg: "rgba(148,163,184,0.16)", text: "#94a3b8", label: "Avulso" },
    courtesy: { bg: "rgba(34,197,94,0.12)", text: "#16a34a", label: "Cortesia" },
};

function formatCurrency(value: number | null): string {
    if (value === null || value === undefined) return "—";
    return formatBRL(value);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

interface Props {
    student: FinancialStudent;
    onPress: () => void;
}

export function ContractCard({ student, onPress }: Props) {
    const colors = useV2Colors();
    const statusCfg = STATUS_CONFIG[student.display_status] || STATUS_CONFIG.courtesy;
    const billingCfg = student.billing_type
        ? BILLING_CONFIG[student.billing_type] || BILLING_CONFIG.manual_recurring
        : null;

    const initials = student.student_name
        ?.split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "?";

    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.98}
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border.subtle,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 4,
                elevation: 1,
            }}
        >
            {/* Avatar */}
            {student.avatar_url ? (
                <Image
                    source={{ uri: student.avatar_url }}
                    style={{ width: 44, height: 44, borderRadius: 14, marginRight: 12, backgroundColor: colors.surface.card2 }}
                />
            ) : (
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors.purple[100],
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                    }}
                >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.purple[600] }}>{initials}</Text>
                </View>
            )}

            {/* Info */}
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary }} numberOfLines={1}>
                    {student.student_name}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6, flexWrap: "wrap" }}>
                    {/* Status badge */}
                    <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: statusCfg.text }}>{statusCfg.label}</Text>
                    </View>

                    {/* Billing type badge (hide if same label as status to avoid duplication) */}
                    {billingCfg && billingCfg.label !== statusCfg.label && (
                        <View style={{ backgroundColor: billingCfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: billingCfg.text }}>{billingCfg.label}</Text>
                        </View>
                    )}
                </View>

                {/* Plan + value */}
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                    {student.plan_title && (
                        <Text style={{ fontSize: 12, color: colors.text.tertiary }} numberOfLines={1}>
                            {student.plan_title}
                        </Text>
                    )}
                    {student.amount !== null && (
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text.secondary }}>
                            {formatCurrency(student.amount)}
                            {student.plan_interval ? `/${student.plan_interval === "month" ? "mês" : student.plan_interval === "quarter" ? "trim" : "ano"}` : ""}
                        </Text>
                    )}
                </View>

                {/* Due date */}
                {student.current_period_end && student.display_status !== "courtesy" && student.display_status !== "canceled" && (
                    <Text style={{ fontSize: 11, color: colors.text.quaternary, marginTop: 2 }}>
                        Vence {formatDate(student.current_period_end)}
                    </Text>
                )}
            </View>

            <ChevronRight size={18} color={colors.text.quaternary} />
        </PressableScale>
    );
}
