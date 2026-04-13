import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { TrendingUp, Calendar, Clock, Dumbbell, ChevronRight } from "lucide-react-native";
import type { StudentDetailData } from "../../../hooks/useStudentDetail";
import { getProgramWeek } from "@kinevo/shared/utils/schedule-projection";
import { SessionHeatmap } from "./SessionHeatmap";
import { ProgressCharts } from "./ProgressCharts";
import { useResponsive } from "../../../hooks/useResponsive";
import { ResponsiveGrid } from "../../shared/ResponsiveGrid";
import { ResponsiveContainer } from "../../shared/ResponsiveContainer";
import { SessionDetailSheet } from "../SessionDetailSheet";

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "Nunca";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Agora";
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Ontem";
    if (days < 7) return `há ${days} dias`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    return `${m}min`;
}

interface Props {
    data: StudentDetailData;
}

export function StudentOverviewTab({ data }: Props) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const adherence =
        data.expectedPerWeek > 0
            ? Math.round((data.sessionsThisWeek / data.expectedPerWeek) * 100)
            : null;

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            {/* KPI Cards */}
            <ResponsiveGrid columns={{ phone: 2, tablet: 4 }} gap={10} style={{ marginBottom: 20 }}>
                <KPICard
                    icon={<Dumbbell size={16} color="#7c3aed" />}
                    label="Esta semana"
                    value={`${data.sessionsThisWeek}/${data.expectedPerWeek || "—"}`}
                />
                <KPICard
                    icon={<TrendingUp size={16} color="#16a34a" />}
                    label="Aderência"
                    value={adherence !== null ? `${adherence}%` : "—"}
                />
                <KPICard
                    icon={<Calendar size={16} color="#3b82f6" />}
                    label="Total sessões"
                    value={String(data.totalSessions)}
                />
                <KPICard
                    icon={<Clock size={16} color="#f59e0b" />}
                    label="Último treino"
                    value={timeAgo(data.lastSessionDate)}
                />
            </ResponsiveGrid>

            {/* Heatmap */}
            <SessionHeatmap studentId={data.student.id} />

            {/* Progress Charts */}
            <View style={{ marginTop: 20, marginBottom: 20 }}>
                <ProgressCharts
                    studentId={data.student.id}
                    expectedPerWeek={data.expectedPerWeek}
                />
            </View>

            {/* Active Program */}
            {data.activeProgram && (
                <>
                    <SectionLabel>Programa Ativo</SectionLabel>
                    <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 14, marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>
                                {data.activeProgram.name}
                            </Text>
                            {data.activeProgram.ai_generated && (
                                <View style={{ backgroundColor: "#f3f0ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#7c3aed" }}>IA</Text>
                                </View>
                            )}
                        </View>
                        {data.activeProgram.duration_weeks && (
                            <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                {data.activeProgram.duration_weeks} semanas · Semana {
                                    data.activeProgram.started_at
                                        ? getProgramWeek(new Date(), data.activeProgram.started_at, data.activeProgram.duration_weeks) ?? data.activeProgram.duration_weeks
                                        : 1
                                }
                            </Text>
                        )}
                        <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                            {data.activeProgram.workouts.length} treino(s)
                        </Text>
                    </View>
                </>
            )}

            {/* Recent Sessions */}
            <SectionLabel>Sessões Recentes</SectionLabel>
            {data.recentSessions.length === 0 ? (
                <Text style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>
                    Nenhuma sessão registrada
                </Text>
            ) : (
                <View style={{ backgroundColor: "#ffffff", borderRadius: 14, marginBottom: 20, overflow: "hidden" }}>
                    {data.recentSessions.map((session, idx) => (
                        <TouchableOpacity
                            key={session.id}
                            activeOpacity={0.6}
                            onPress={() => setSelectedSessionId(session.id)}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                borderBottomWidth: idx < data.recentSessions.length - 1 ? 0.5 : 0,
                                borderBottomColor: "rgba(0,0,0,0.06)",
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#1a1a2e" }}>
                                    {session.workout_name || "Treino"}
                                </Text>
                                <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                    {timeAgo(session.completed_at)}
                                </Text>
                            </View>
                            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                                {session.duration_seconds && (
                                    <Text style={{ fontSize: 12, color: "#64748b" }}>
                                        {formatDuration(session.duration_seconds)}
                                    </Text>
                                )}
                                {session.rpe && (
                                    <View
                                        style={{
                                            backgroundColor: session.rpe >= 8 ? "#fef2f2" : "#f8fafc",
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                            borderRadius: 8,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontWeight: "600",
                                                color: session.rpe >= 8 ? "#ef4444" : "#64748b",
                                            }}
                                        >
                                            PSE {session.rpe}
                                        </Text>
                                    </View>
                                )}
                                <ChevronRight size={16} color="#cbd5e1" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            <SessionDetailSheet
                visible={!!selectedSessionId}
                sessionId={selectedSessionId}
                onClose={() => setSelectedSessionId(null)}
            />
        </ScrollView>
    );
}

function KPICard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#ffffff",
                borderRadius: 14,
                padding: 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                {icon}
                <Text style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>{label}</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#1a1a2e" }}>{value}</Text>
        </View>
    );
}

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            style={{
                fontSize: 12,
                fontWeight: "600",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
            }}
        >
            {children}
        </Text>
    );
}
