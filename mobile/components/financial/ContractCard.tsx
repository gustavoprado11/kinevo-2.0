import React from "react";
import { View, Text, Image } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { PressableScale } from "../shared/PressableScale";
import type { FinancialStudent, DisplayStatus } from "../../types/financial";

const STATUS_CONFIG: Record<DisplayStatus, { bg: string; text: string; label: string }> = {
    courtesy: { bg: "#eff6ff", text: "#3b82f6", label: "Cortesia" },
    awaiting_payment: { bg: "#f0f9ff", text: "#0ea5e9", label: "Aguardando" },
    active: { bg: "#f0fdf4", text: "#16a34a", label: "Ativo" },
    grace_period: { bg: "#fff7ed", text: "#f97316", label: "Vence hoje" },
    canceling: { bg: "#fffbeb", text: "#f59e0b", label: "Cancelando" },
    overdue: { bg: "#fef2f2", text: "#ef4444", label: "Inadimplente" },
    canceled: { bg: "#f1f5f9", text: "#64748b", label: "Encerrado" },
};

const BILLING_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    stripe_auto: { bg: "#f5f3ff", text: "#7c3aed", label: "Stripe" },
    manual_recurring: { bg: "#eff6ff", text: "#3b82f6", label: "Manual" },
    manual_one_off: { bg: "#f1f5f9", text: "#64748b", label: "Avulso" },
    courtesy: { bg: "#f0fdf4", text: "#16a34a", label: "Cortesia" },
};

function formatCurrency(value: number | null): string {
    if (value === null || value === undefined) return "—";
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
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
                backgroundColor: "#ffffff",
                borderRadius: 16,
                padding: 16,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
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
                    style={{ width: 44, height: 44, borderRadius: 14, marginRight: 12, backgroundColor: "#f1f5f9" }}
                />
            ) : (
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: "#f5f3ff",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                    }}
                >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#7c3aed" }}>{initials}</Text>
                </View>
            )}

            {/* Info */}
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#0f172a" }} numberOfLines={1}>
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
                        <Text style={{ fontSize: 12, color: "#64748b" }} numberOfLines={1}>
                            {student.plan_title}
                        </Text>
                    )}
                    {student.amount !== null && (
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569" }}>
                            {formatCurrency(student.amount)}
                            {student.plan_interval ? `/${student.plan_interval === "month" ? "mês" : student.plan_interval === "quarter" ? "trim" : "ano"}` : ""}
                        </Text>
                    )}
                </View>

                {/* Due date */}
                {student.current_period_end && student.display_status !== "courtesy" && student.display_status !== "canceled" && (
                    <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Vence {formatDate(student.current_period_end)}
                    </Text>
                )}
            </View>

            <ChevronRight size={18} color="#cbd5e1" />
        </PressableScale>
    );
}
