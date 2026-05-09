import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AgendaDayView } from "../../components/trainer/agenda/AgendaDayView";
import { CreateAppointmentSheet } from "../../components/trainer/agenda/CreateAppointmentSheet";
import { AppointmentDetailSheet } from "../../components/trainer/agenda/AppointmentDetailSheet";
import {
    useAgendaOccurrences,
    type AgendaOccurrence,
} from "../../hooks/useAgendaOccurrences";

function addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
}

export default function AgendaScreen() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOccurrence, setDetailOccurrence] = useState<AgendaOccurrence | null>(null);

    // Fetch a 3-day window around the selected day to keep adjacent swipes snappy.
    const { rangeStart, rangeEnd } = useMemo(() => {
        const start = addDays(selectedDate, -1);
        const end = addDays(selectedDate, 1);
        return { rangeStart: start, rangeEnd: end };
    }, [selectedDate]);

    const { occurrences, isLoading, isRefreshing, refresh, error } = useAgendaOccurrences({
        rangeStart,
        rangeEnd,
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
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
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
                        style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.6 : 1,
                        })}
                    >
                        <ChevronLeft size={24} color="#0f172a" />
                    </Pressable>
                    <Text style={{ fontSize: 17, fontWeight: "600", color: "#0f172a", marginLeft: 4 }}>
                        Agenda
                    </Text>
                </View>

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
                            backgroundColor: "#fef2f2",
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: "#fecaca",
                        }}
                    >
                        <Text style={{ fontSize: 12, color: "#b91c1c" }}>{error}</Text>
                    </View>
                ) : null}

                {/* FAB */}
                <Pressable
                    onPress={handleCreatePress}
                    style={({ pressed }) => ({
                        position: "absolute",
                        right: 20,
                        bottom: 32,
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "#7c3aed",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#7c3aed",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        elevation: 6,
                        opacity: pressed ? 0.9 : 1,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                    })}
                >
                    <Plus size={26} color="#ffffff" strokeWidth={2.5} />
                </Pressable>
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
                onClose={() => setDetailOccurrence(null)}
                onChanged={handleAfterMutation}
            />
        </>
    );
}
