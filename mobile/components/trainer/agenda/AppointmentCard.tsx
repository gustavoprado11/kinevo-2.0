import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Repeat } from "lucide-react-native";
import type { AgendaOccurrence } from "../../../hooks/useAgendaOccurrences";

interface AppointmentCardProps {
    occurrence: AgendaOccurrence;
    onPress: (occurrence: AgendaOccurrence) => void;
}

function endTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + durationMinutes;
    const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const em = String(total % 60).padStart(2, "0");
    return `${eh}:${em}`;
}

function initials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

export function AppointmentCard({ occurrence, onPress }: AppointmentCardProps) {
    const studentName = occurrence.student?.name ?? "Aluno removido";
    const avatar = occurrence.student?.avatar_url ?? null;
    const start = occurrence.startTime;
    const end = endTime(occurrence.startTime, occurrence.durationMinutes);
    const isRescheduled = occurrence.status === "rescheduled";
    const isCompleted = occurrence.status === "completed";
    const isNoShow = occurrence.status === "no_show";

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(occurrence);
    };

    // Status accent strip color
    let accentColor = "#7c3aed"; // default violet (scheduled)
    if (isCompleted) accentColor = "#16a34a";
    else if (isNoShow) accentColor = "#ef4444";
    else if (isRescheduled) accentColor = "#f59e0b";

    return (
        <Pressable
            onPress={handlePress}
            style={({ pressed }) => ({
                backgroundColor: "#ffffff",
                borderRadius: 16,
                marginBottom: 10,
                overflow: "hidden",
                flexDirection: "row",
                opacity: pressed ? 0.92 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
            })}
        >
            {/* Accent strip */}
            <View style={{ width: 4, backgroundColor: accentColor }} />

            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", padding: 14 }}>
                {/* Time block */}
                <View style={{ width: 64, marginRight: 12 }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>{start}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "500", color: "#94a3b8", marginTop: 2 }}>{end}</Text>
                </View>

                {/* Avatar */}
                {avatar ? (
                    <Image
                        source={{ uri: avatar }}
                        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f1f5f9", marginRight: 12 }}
                    />
                ) : (
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: "#f5f3ff",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#7c3aed" }}>
                            {initials(studentName)}
                        </Text>
                    </View>
                )}

                {/* Body */}
                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={1}
                        style={{ fontSize: 15, fontWeight: "600", color: "#0f172a" }}
                    >
                        {studentName}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                        <Text style={{ fontSize: 12, color: "#64748b" }}>
                            {occurrence.durationMinutes} min
                        </Text>
                        {occurrence.recurringAppointmentId && occurrence.hasException && isRescheduled && (
                            <>
                                <Text style={{ fontSize: 11, color: "#cbd5e1" }}>·</Text>
                                <Text style={{ fontSize: 11, color: "#f59e0b", fontWeight: "600" }}>
                                    Remarcado
                                </Text>
                            </>
                        )}
                        {isCompleted && (
                            <>
                                <Text style={{ fontSize: 11, color: "#cbd5e1" }}>·</Text>
                                <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "600" }}>
                                    Concluído
                                </Text>
                            </>
                        )}
                        {isNoShow && (
                            <>
                                <Text style={{ fontSize: 11, color: "#cbd5e1" }}>·</Text>
                                <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "600" }}>
                                    Faltou
                                </Text>
                            </>
                        )}
                    </View>
                    {occurrence.notes ? (
                        <Text
                            numberOfLines={1}
                            style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}
                        >
                            {occurrence.notes}
                        </Text>
                    ) : null}
                </View>

                {/* Recurring icon */}
                <View style={{ marginLeft: 8 }}>
                    <Repeat size={14} color="#cbd5e1" />
                </View>
            </View>
        </Pressable>
    );
}
