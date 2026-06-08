import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Users, Trash2, Pencil } from "lucide-react-native";
import type { TrainerPlan } from "../../hooks/useTrainerPlans";
import { useV2Colors } from "../../hooks/useV2Colors";
import { formatBRL } from "@/lib/currency";

const INTERVAL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    month: { label: "Mensal", color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
    quarter: { label: "Trimestral", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    year: { label: "Anual", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

function formatCurrency(value: number): string {
    return formatBRL(value);
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
    const colors = useV2Colors();
    const intervalInfo = INTERVAL_LABELS[plan.interval] || INTERVAL_LABELS.month;

    return (
        <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.7}
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border.subtle,
            }}
        >
            {/* Header: title + action buttons */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: colors.text.primary, marginRight: 12 }} numberOfLines={2}>
                    {plan.title}
                </Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
                        hitSlop={8}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surface.card2 }}
                    >
                        <Pencil size={15} color={colors.text.quaternary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
                        hitSlop={8}
                        disabled={isDeleting}
                        style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surface.card2 }}
                    >
                        {isDeleting ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                            <Trash2 size={15} color={colors.text.quaternary} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Price */}
            <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 8 }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text.primary }}>
                    {formatCurrency(plan.price)}
                </Text>
                <Text style={{ fontSize: 13, color: colors.text.tertiary, marginLeft: 4 }}>
                    /{intervalInfo.label.toLowerCase()}
                </Text>
            </View>

            {/* Student count */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
                <Users size={12} color={colors.text.tertiary} />
                <Text style={{ fontSize: 12, color: colors.text.tertiary }}>
                    {(plan.student_count || 0) === 0
                        ? "Nenhum aluno"
                        : `${plan.student_count} aluno${(plan.student_count || 0) > 1 ? "s" : ""}`}
                </Text>
            </View>

            {/* Description */}
            {plan.description ? (
                <Text style={{ fontSize: 12, color: colors.text.quaternary, marginBottom: 12 }} numberOfLines={2}>
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
                        backgroundColor: plan.is_active ? "rgba(34,197,94,0.12)" : colors.surface.card2,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                    }}
                >
                    {isToggling ? (
                        <ActivityIndicator size="small" color={colors.text.tertiary} />
                    ) : (
                        <Text style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: plan.is_active ? "#16a34a" : colors.text.tertiary,
                        }}>
                            {plan.is_active ? "Ativo" : "Inativo"}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}
