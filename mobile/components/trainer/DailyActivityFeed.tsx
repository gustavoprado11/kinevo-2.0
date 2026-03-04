import React from "react";
import { View, Text } from "react-native";
import { Activity, Clock, Flame } from "lucide-react-native";
import type { DailyActivityItem } from "../../hooks/useTrainerDashboard";

function formatDuration(seconds: number | null): string {
    if (!seconds) return "—";
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (hours > 0) return `${hours}h ${remaining}min`;
    return `${minutes}min`;
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface DailyActivityFeedProps {
    items: DailyActivityItem[];
}

export function DailyActivityFeed({ items }: DailyActivityFeedProps) {
    if (items.length === 0) {
        return (
            <View
                style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 16,
                    padding: 24,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.04)",
                }}
            >
                <Activity size={24} color="#cbd5e1" />
                <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 8, fontWeight: "500" }}>
                    Nenhum treino completado hoje
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{
                backgroundColor: "#ffffff",
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            {items.map((item, index) => (
                <View key={item.id}>
                    {index > 0 && (
                        <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 16 }} />
                    )}
                    <View style={{ padding: 14, flexDirection: "row", alignItems: "center" }}>
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 12,
                                backgroundColor: "#f0fdf4",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                            }}
                        >
                            <Activity size={16} color="#16a34a" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0f172a" }}>
                                {item.student_name}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                {item.workout_name}
                            </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Clock size={10} color="#94a3b8" />
                                <Text style={{ fontSize: 11, color: "#94a3b8", fontWeight: "500" }}>
                                    {formatDuration(item.duration_seconds)}
                                </Text>
                            </View>
                            {item.rpe != null && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Flame size={10} color="#f59e0b" />
                                    <Text style={{ fontSize: 11, color: "#f59e0b", fontWeight: "600" }}>
                                        RPE {item.rpe}
                                    </Text>
                                </View>
                            )}
                            <Text style={{ fontSize: 10, color: "#cbd5e1" }}>
                                {formatTime(item.completed_at)}
                            </Text>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}
