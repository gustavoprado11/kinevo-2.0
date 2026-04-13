import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Users, Trash2, Pencil } from "lucide-react-native";
import type { TrainerPlan } from "../../hooks/useTrainerPlans";

const INTERVAL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    month: { label: "Mensal", color: "#7c3aed", bg: "#f5f3ff" },
    quarter: { label: "Trimestral", color: "#3b82f6", bg: "#eff6ff" },
    year: { label: "Anual", color: "#f59e0b", bg: "#fffbeb" },
};

function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

interface PlanCardProps {
    plan: TrainerPlan;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
    isToggling: boolean;
    isDeleting: boolean;
}

export function PlanCard({ plan, onEdit, onToggle, onDelete, isToggling, isDeleting }: PlanCardProps) {
    const intervalInfo = INTERVAL_LABELS[plan.interval] || INTERVAL_LABELS.month;

    return (
        <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.7}
            style={{
                backgroundColor: "#ffffff",
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
            }}
        >
            {/* Header: title + action buttons */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: "#0f172a", marginRight: 12 }} numberOfLines={2}>
                    {plan.title}
                </Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
                        hitSlop={8}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: "#f8fafc" }}
                    >
                        <Pencil size={15} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
                        hitSlop={8}
                        disabled={isDeleting}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: "#f8fafc" }}
                    >
                        {isDeleting ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                            <Trash2 size={15} color="#94a3b8" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Price */}
            <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 8 }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a" }}>
                    {formatCurrency(plan.price)}
                </Text>
                <Text style={{ fontSize: 13, color: "#64748b", marginLeft: 4 }}>
                    /{intervalInfo.label.toLowerCase()}
                </Text>
            </View>

            {/* Student count */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
                <Users size={12} color="#64748b" />
                <Text style={{ fontSize: 12, color: "#64748b" }}>
                    {(plan.student_count || 0) === 0
                        ? "Nenhum aluno"
                        : `${plan.student_count} aluno${(plan.student_count || 0) > 1 ? "s" : ""}`}
                </Text>
            </View>

            {/* Description */}
            {plan.description ? (
                <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }} numberOfLines={2}>
                    {plan.description}
                </Text>
            ) : null}

            {/* Badges */}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {/* Interval badge */}
                <View style={{
                    backgroundColor: intervalInfo.bg,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: intervalInfo.color }}>
                        {intervalInfo.label}
                    </Text>
                </View>

                {/* Active/Inactive toggle */}
                <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); onToggle(); }}
                    disabled={isToggling}
                    style={{
                        backgroundColor: plan.is_active ? "#f0fdf4" : "#f1f5f9",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                    }}
                >
                    {isToggling ? (
                        <ActivityIndicator size="small" color="#64748b" />
                    ) : (
                        <Text style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: plan.is_active ? "#16a34a" : "#64748b",
                        }}>
                            {plan.is_active ? "Ativo" : "Inativo"}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Stripe badge */}
                {plan.stripe_price_id && (
                    <View style={{
                        backgroundColor: "#f5f3ff",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#7c3aed" }}>
                            Stripe
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
