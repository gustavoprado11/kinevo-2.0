import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Calendar, Sparkles, FileText } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import type { StudentDetailData } from "../../../hooks/useStudentDetail";

interface Props {
    data: StudentDetailData;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function StudentProgramsTab({ data }: Props) {
    const router = useRouter();

    // Track which completed programs have reports
    const [reportMap, setReportMap] = useState<Record<string, string>>({});

    const completedProgramIds = data.programHistory
        .filter((p) => p.status === "completed")
        .map((p) => p.id);

    useEffect(() => {
        if (completedProgramIds.length === 0) return;
        (async () => {
            const { data: reports } = await (supabase as any)
                .from("program_reports")
                .select("id, assigned_program_id")
                .in("assigned_program_id", completedProgramIds);
            if (reports) {
                const map: Record<string, string> = {};
                for (const r of reports) map[r.assigned_program_id] = r.id;
                setReportMap(map);
            }
        })();
    }, [completedProgramIds.join(",")]);

    const handleOpenReport = useCallback(
        (reportId: string) => {
            router.push({ pathname: "/report/[id]", params: { id: reportId } } as any);
        },
        [router]
    );

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Active Program */}
            {data.activeProgram ? (
                <>
                    <SectionLabel>Programa Ativo</SectionLabel>
                    <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1a1a2e" }}>
                                {data.activeProgram.name}
                            </Text>
                            {data.activeProgram.ai_generated && (
                                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f3f0ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                    <Sparkles size={12} color="#7c3aed" />
                                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#7c3aed", marginLeft: 3 }}>IA</Text>
                                </View>
                            )}
                        </View>

                        {data.activeProgram.description && (
                            <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                                {data.activeProgram.description}
                            </Text>
                        )}

                        <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
                            {data.activeProgram.duration_weeks && (
                                <Text style={{ fontSize: 13, color: "#64748b" }}>
                                    {data.activeProgram.duration_weeks} semanas
                                </Text>
                            )}
                            <Text style={{ fontSize: 13, color: "#64748b" }}>
                                Semana {data.activeProgram.current_week || 1}
                            </Text>
                        </View>

                        {/* Workouts */}
                        {data.activeProgram.workouts.map((w) => (
                            <View
                                key={w.id}
                                style={{
                                    paddingVertical: 10,
                                    borderTopWidth: 0.5,
                                    borderTopColor: "rgba(0,0,0,0.06)",
                                }}
                            >
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#1a1a2e" }}>
                                    {w.name}
                                </Text>
                                {w.scheduled_days && w.scheduled_days.length > 0 && (
                                    <Text style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                                        {w.scheduled_days.map((d) => DAY_NAMES[d] || d).join(", ")}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                </>
            ) : (
                <View style={{ alignItems: "center", marginTop: 40, marginBottom: 20 }}>
                    <Calendar size={40} color="#d1d5db" />
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#94a3b8", marginTop: 12 }}>
                        Nenhum programa ativo
                    </Text>
                    <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>
                        Atribua um programa usando o botão acima
                    </Text>
                </View>
            )}

            {/* Program History */}
            {data.programHistory.length > 0 && (
                <>
                    <SectionLabel>Histórico</SectionLabel>
                    <View style={{ backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden" }}>
                        {data.programHistory.map((p, idx) => {
                            const reportId = reportMap[p.id];
                            return (
                                <View
                                    key={p.id}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 12,
                                        borderBottomWidth: idx < data.programHistory.length - 1 ? 0.5 : 0,
                                        borderBottomColor: "rgba(0,0,0,0.06)",
                                    }}
                                >
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "500", color: "#1a1a2e" }}>
                                                {p.name}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                                {p.duration_weeks ? `${p.duration_weeks} semanas` : "—"}
                                                {p.completed_at && ` · Concluído em ${new Date(p.completed_at).toLocaleDateString("pt-BR")}`}
                                            </Text>
                                        </View>
                                        <View
                                            style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 3,
                                                borderRadius: 8,
                                                backgroundColor: p.status === "completed" ? "#dcfce7" : "#fef3c7",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: "600",
                                                    color: p.status === "completed" ? "#16a34a" : "#d97706",
                                                }}
                                            >
                                                {p.status === "completed" ? "Concluído" : "Pausado"}
                                            </Text>
                                        </View>
                                    </View>
                                    {reportId && (
                                        <TouchableOpacity
                                            onPress={() => handleOpenReport(reportId)}
                                            activeOpacity={0.7}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                marginTop: 8,
                                                paddingVertical: 6,
                                                paddingHorizontal: 10,
                                                backgroundColor: "#f3f0ff",
                                                borderRadius: 8,
                                                alignSelf: "flex-start",
                                                gap: 5,
                                            }}
                                        >
                                            <FileText size={13} color="#7c3aed" />
                                            <Text style={{ fontSize: 12, fontWeight: "600", color: "#7c3aed" }}>
                                                Ver relatório
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </>
            )}
        </ScrollView>
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
