import React from "react";
import { View, Text, Image } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { PressableScale } from "../shared/PressableScale";
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
            return { label: "Ativo", bg: "#f0fdf4", color: "#16a34a" };
        case "inactive":
            return { label: "Inativo", bg: "#fef2f2", color: "#ef4444" };
        case "pending":
            return { label: "Pendente", bg: "#fffbeb", color: "#f59e0b" };
        default:
            return { label: status, bg: "#f1f5f9", color: "#64748b" };
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
}

export function StudentCard({ student, onPress }: StudentCardProps) {
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
            style={{
                backgroundColor: "#ffffff",
                borderRadius: 20,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
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
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#7c3aed" }}>
                            {initials}
                        </Text>
                    </View>
                )}

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }} numberOfLines={1}>
                            {student.name}
                        </Text>
                        {student.is_trainer_profile && (
                            <View
                                style={{
                                    backgroundColor: "#f5f3ff",
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                    borderRadius: 6,
                                }}
                            >
                                <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed" }}>EU</Text>
                            </View>
                        )}
                    </View>

                    {/* Program + Progress */}
                    <Text style={{ fontSize: 12, color: "#64748b", marginTop: 3 }} numberOfLines={1}>
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
                            <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                                <Text style={{ fontSize: 10, fontWeight: "600", color: "#64748b" }}>
                                    {modalityLabel(student.modality)}
                                </Text>
                            </View>
                        )}

                        {/* Last session */}
                        <View style={{ backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                            <Text style={{ fontSize: 10, fontWeight: "500", color: "#94a3b8" }}>
                                {relativeDate(student.last_session_date)}
                            </Text>
                        </View>
                    </View>
                </View>

                <ChevronRight size={18} color="#cbd5e1" />
            </View>
        </PressableScale>
    );
}
