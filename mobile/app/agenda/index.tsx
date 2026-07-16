import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AgendaDayView } from "../../components/trainer/agenda/AgendaDayView";
import { PressableScale } from "../../components/shared/PressableScale";
import { useV2Colors } from "../../hooks/useV2Colors";
import { CreateAppointmentSheet } from "../../components/trainer/agenda/CreateAppointmentSheet";
import { AppointmentDetailSheet } from "../../components/trainer/agenda/AppointmentDetailSheet";
import {
    useAgendaOccurrences,
    type AgendaOccurrence,
} from "../../hooks/useAgendaOccurrences";
import { useStudioMembership } from "../../hooks/useStudioDashboard";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { ScrollView } from "react-native";

function addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
}

export default function AgendaScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
    const [createOpen, setCreateOpen] = useState(false);
    // Estúdios: 'me' | 'all' | coachId — membro vê a agenda da equipe.
    const [scope, setScope] = useState<string>("me");
    const { membership } = useStudioMembership();
    const { trainerId } = useRoleMode();
    const [detailOccurrence, setDetailOccurrence] = useState<AgendaOccurrence | null>(null);
    const [editOccurrence, setEditOccurrence] = useState<AgendaOccurrence | null>(null);

    // Fetch a 3-day window around the selected day to keep adjacent swipes snappy.
    const { rangeStart, rangeEnd } = useMemo(() => {
        const start = addDays(selectedDate, -1);
        const end = addDays(selectedDate, 1);
        return { rangeStart: start, rangeEnd: end };
    }, [selectedDate]);

    const { occurrences, studioCoaches, isLoading, isRefreshing, refresh, error } = useAgendaOccurrences({
        rangeStart,
        rangeEnd,
        scope,
    });

    const handleBack = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    }, [router]);

    const handlePressAppointment = useCallback((occurrence: AgendaOccurrence) => {
        setDetailOccurrence(occurrence);
    }, []);

    const handleCreatePress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCreateOpen(true);
    }, []);

    const handleAfterMutation = useCallback(() => {
        refresh();
    }, [refresh]);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                {/* Custom header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                    }}
                >
                    <Pressable
                        onPress={handleBack}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                        {/* Layout numa View interna: flex props em style-função de
                            Pressable não aplicam (gotcha do projeto). */}
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <ChevronLeft size={24} color={colors.text.primary} />
                        </View>
                    </Pressable>
                    <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text.primary, marginLeft: 4 }}>
                        Agenda
                    </Text>
                </View>

                {/* Estúdios: filtro por treinador (ver é aberto; agendar segue pessoal) */}
                {membership && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flexGrow: 0 }}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
                    >
                        {[{ id: "me", label: "Você" }, { id: "all", label: "Estúdio (todos)" },
                          ...studioCoaches.filter((c) => c.id !== trainerId).map((c) => ({ id: c.id, label: c.name.split(" ")[0] }))]
                            .map((chip) => {
                                const active = scope === chip.id;
                                return (
                                    <Pressable
                                        key={chip.id}
                                        onPress={() => { Haptics.selectionAsync(); setScope(chip.id); }}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 7,
                                            borderRadius: 999,
                                            backgroundColor: active ? colors.brand.primary : colors.surface.card,
                                            borderWidth: active ? 0 : 1,
                                            borderColor: colors.border.subtle,
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : colors.text.tertiary }}>
                                            {chip.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                    </ScrollView>
                )}

                <AgendaDayView
                    selectedDate={selectedDate}
                    onChangeDate={setSelectedDate}
                    occurrences={occurrences}
                    isLoading={isLoading}
                    isRefreshing={isRefreshing}
                    onRefresh={refresh}
                    onPressAppointment={handlePressAppointment}
                    onCreatePress={handleCreatePress}
                />

                {error ? (
                    <View
                        style={{
                            position: "absolute",
                            bottom: 100,
                            left: 20,
                            right: 20,
                            backgroundColor: colors.semantic.danger.bg,
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: "#fecaca",
                        }}
                    >
                        <Text style={{ fontSize: 12, color: colors.semantic.danger.fg }}>{error}</Text>
                    </View>
                ) : null}

                {/* FAB */}
                <PressableScale
                    onPress={handleCreatePress}
                    hapticStyle={Haptics.ImpactFeedbackStyle.Medium}
                    accessibilityRole="button"
                    accessibilityLabel="Novo agendamento"
                    style={{
                        position: "absolute",
                        right: 20,
                        bottom: 32,
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: colors.purple[600],
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: colors.purple[600],
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        elevation: 6,
                    }}
                >
                    <Plus size={26} color="#ffffff" strokeWidth={2.5} />
                </PressableScale>
            </SafeAreaView>

            <CreateAppointmentSheet
                visible={createOpen}
                initialDate={selectedDate}
                onClose={() => setCreateOpen(false)}
                onCreated={handleAfterMutation}
            />

            <AppointmentDetailSheet
                occurrence={detailOccurrence}
                frequencyHint={detailOccurrence?.frequency}
                onRequestEdit={(occ) => {
                    setDetailOccurrence(null);
                    setEditOccurrence(occ);
                }}
                onClose={() => setDetailOccurrence(null)}
                onChanged={handleAfterMutation}
            />

            <CreateAppointmentSheet
                visible={!!editOccurrence}
                editing={
                    editOccurrence
                        ? {
                            id: editOccurrence.recurringAppointmentId,
                            studentId: editOccurrence.studentId,
                            startTime: editOccurrence.startTime,
                            durationMinutes: editOccurrence.durationMinutes,
                            frequency: editOccurrence.frequency,
                            notes: editOccurrence.notes,
                        }
                        : null
                }
                onClose={() => setEditOccurrence(null)}
                onCreated={handleAfterMutation}
            />
        </>
    );
}
