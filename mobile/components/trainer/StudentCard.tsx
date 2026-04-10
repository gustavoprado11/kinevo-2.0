import React from "react";
import { View, Text, Image } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { PressableScale } from "../shared/PressableScale";
import { colors } from "@/theme";
import type { TrainerStudent } from "../../hooks/useTrainerStudentsList";

function relativeDate(dateStr: string | null): string {
    if (!dateStr) return "Nunca";
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 30) return `há ${diffDays} dias`;
    return `há ${Math.floor(diffDays / 30)}m`;
}

function statusBadge(status: string): { label: string; bg: string; color: string } {
    switch (status) {
        case "active":
            return { label: "Ativo", bg: colors.status.activeBg, color: colors.status.active };
        case "inactive":
            return { label: "Inativo", bg: colors.error.light, color: colors.error.default };
        case "pending":
            return { label: "Pendente", bg: colors.status.pendingBg, color: colors.status.pending };
        default:
            return { label: status, bg: colors.status.inactiveBg, color: colors.text.secondary };
    }
}

function modalityLabel(modality: string | null): string {
    if (modality === "online") return "Online";
    if (modality === "presencial") return "Presencial";
    return "—";
}

interface StudentCardProps {
    student: TrainerStudent;
    onPress: () => void;
    selected?: boolean;
}

export function StudentCard({ student, onPress, selected }: StudentCardProps) {
    const badge = statusBadge(student.status);
    const initials = student.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();

    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={`Aluno ${student.name}, status ${badge.label}${student.program_name ? `, programa ${student.program_name}` : ''}`}
            accessibilityHint="Toque para ver detalhes do aluno"
            style={{
                backgroundColor: selected ? `${colors.brand.primaryLight}19` : colors.background.card,
                borderRadius: 20,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: selected ? colors.brand.primary : colors.border.primary,
                borderLeftWidth: selected ? 3 : 1,
                borderLeftColor: selected ? colors.brand.primary : colors.border.primary,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* Avatar */}
                {student.avatar_url ? (
                    <Image
                        source={{ uri: student.avatar_url }}
                        style={{ width: 44, height: 44, borderRadius: 14, marginRight: 12, backgroundColor: colors.status.inactiveBg }}
                    />
                ) : (
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            backgroundColor: colors.brand.primaryLight,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.brand.primary }}>
                            {initials}
                        </Text>
                    </View>
                )}

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                            {student.name}
                        </Text>
                        {student.is_trainer_profile && (
                            <View
                                style={{
                                    backgroundColor: colors.brand.primaryLight,
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                    borderRadius: 6,
                                }}
                            >
                                <Text style={{ fontSize: 9, fontWeight: "700", color: colors.brand.primary }}>EU</Text>
                            </View>
                        )}
                    </View>

                    {/* Program + Progress */}
                    <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 3 }} numberOfLines={1}>
                        {student.program_name || "Sem programa"}
                        {student.program_name && student.expected_per_week > 0
                            ? ` — ${student.sessions_this_week}/${student.expected_per_week}`
                            : ""}
                    </Text>

                    {/* Tags row */}
                    <View style={{ flexDirection: "row", marginTop: 6, gap: 6, flexWrap: "wrap" }}>
                        {/* Status badge */}
                        <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: badge.color }}>{badge.label}</Text>
                        </View>

                        {/* Modality */}
                        {student.modality && (
                            <View style={{ backgroundColor: colors.status.inactiveBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                                <Text style={{ fontSize: 10, fontWeight: "600", color: colors.text.secondary }}>
                                    {modalityLabel(student.modality)}
                                </Text>
                            </View>
                        )}

                        {/* Last session */}
                        <View style={{ backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                            <Text style={{ fontSize: 10, fontWeight: "500", color: colors.text.tertiary }}>
                                {relativeDate(student.last_session_date)}
                            </Text>
                        </View>
                    </View>
                </View>

                <ChevronRight size={18} color={colors.text.quaternary} />
            </View>
        </PressableScale>
    );
}
