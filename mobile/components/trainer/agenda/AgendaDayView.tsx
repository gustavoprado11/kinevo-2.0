import React, { useCallback, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    Pressable,
} from "react-native";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
} from "react-native-reanimated";
import { AppointmentCard } from "./AppointmentCard";
import type { AgendaOccurrence } from "../../../hooks/useAgendaOccurrences";
import { useV2Colors } from "../../../hooks/useV2Colors";

interface AgendaDayViewProps {
    selectedDate: Date;
    onChangeDate: (date: Date) => void;
    occurrences: AgendaOccurrence[];
    isLoading: boolean;
    isRefreshing: boolean;
    onRefresh: () => void;
    onPressAppointment: (occurrence: AgendaOccurrence) => void;
    onCreatePress: () => void;
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH_NAMES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
];

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
}

function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function formatTitle(d: Date, today: Date): string {
    if (isSameDay(d, today)) return "Hoje";
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    if (isSameDay(d, yesterday)) return "Ontem";
    if (isSameDay(d, tomorrow)) return "Amanhã";
    return DAY_NAMES[d.getDay()];
}

function formatSubtitle(d: Date): string {
    return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export function AgendaDayView({
    selectedDate,
    onChangeDate,
    occurrences,
    isLoading,
    isRefreshing,
    onRefresh,
    onPressAppointment,
    onCreatePress,
}: AgendaDayViewProps) {
    const colors = useV2Colors();
    const today = useMemo(() => new Date(), []);
    const isToday = isSameDay(selectedDate, today);
    const dayKey = toLocalDateKey(selectedDate);

    const dayOccurrences = useMemo(
        () => occurrences.filter((o) => o.date === dayKey),
        [occurrences, dayKey],
    );

    const goPrev = useCallback(() => {
        Haptics.selectionAsync();
        onChangeDate(addDays(selectedDate, -1));
    }, [selectedDate, onChangeDate]);

    const goNext = useCallback(() => {
        Haptics.selectionAsync();
        onChangeDate(addDays(selectedDate, 1));
    }, [selectedDate, onChangeDate]);

    const goToday = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChangeDate(new Date());
    }, [onChangeDate]);

    // Horizontal swipe gesture
    const translateX = useSharedValue(0);
    const panGesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-15, 15])
        .onUpdate((e) => {
            translateX.value = e.translationX;
        })
        .onEnd((e) => {
            const threshold = 80;
            if (e.translationX < -threshold) {
                translateX.value = withTiming(0, { duration: 180 });
                runOnJS(goNext)();
            } else if (e.translationX > threshold) {
                translateX.value = withTiming(0, { duration: 180 });
                runOnJS(goPrev)();
            } else {
                translateX.value = withTiming(0, { duration: 180 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text.primary }}>
                            {formatTitle(selectedDate, today)}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4 }}>
                            {formatSubtitle(selectedDate)}
                        </Text>
                    </View>

                    {!isToday && (
                        <Pressable
                            onPress={goToday}
                            style={({ pressed }) => ({
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                backgroundColor: "#7c3aed",
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 100,
                                opacity: pressed ? 0.85 : 1,
                            })}
                        >
                            <CalendarIcon size={14} color="#ffffff" />
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>
                                Hoje
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Day nav strip */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 16,
                        paddingHorizontal: 4,
                    }}
                >
                    <Pressable
                        onPress={goPrev}
                        style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: colors.surface.card,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.7 : 1,
                            borderWidth: 1,
                            borderColor: colors.border.subtle,
                        })}
                    >
                        <ChevronLeft size={18} color={colors.text.primary} />
                    </Pressable>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.tertiary }}>
                        {dayOccurrences.length === 0
                            ? "Sem agendamentos"
                            : `${dayOccurrences.length} agendamento${dayOccurrences.length > 1 ? "s" : ""}`}
                    </Text>
                    <Pressable
                        onPress={goNext}
                        style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: colors.surface.card,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.7 : 1,
                            borderWidth: 1,
                            borderColor: colors.border.subtle,
                        })}
                    >
                        <ChevronRight size={18} color={colors.text.primary} />
                    </Pressable>
                </View>
            </View>

            {/* Body */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[{ flex: 1 }, animatedStyle]}>
                    <ScrollView
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                tintColor="#7c3aed"
                            />
                        }
                    >
                        {isLoading ? (
                            <View style={{ paddingTop: 80, alignItems: "center" }}>
                                <ActivityIndicator size="small" color="#7c3aed" />
                            </View>
                        ) : dayOccurrences.length === 0 ? (
                            <View style={{ paddingTop: 80, alignItems: "center", paddingHorizontal: 20 }}>
                                <View
                                    style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 20,
                                        backgroundColor: colors.purple[100],
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginBottom: 16,
                                    }}
                                >
                                    <CalendarIcon size={28} color="#7c3aed" />
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary, textAlign: "center" }}>
                                    Sem agendamentos
                                </Text>
                                <Text style={{ fontSize: 13, color: colors.text.tertiary, textAlign: "center", marginTop: 6, lineHeight: 19 }}>
                                    Nenhum atendimento para este dia.{"\n"}Crie um novo agendamento usando o botão "+".
                                </Text>
                                <Pressable
                                    onPress={onCreatePress}
                                    style={({ pressed }) => ({
                                        marginTop: 24,
                                        backgroundColor: "#7c3aed",
                                        paddingHorizontal: 22,
                                        paddingVertical: 12,
                                        borderRadius: 100,
                                        opacity: pressed ? 0.88 : 1,
                                        shadowColor: "#7c3aed",
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.25,
                                        shadowRadius: 10,
                                        elevation: 4,
                                    })}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "700",
                                            color: "#ffffff",
                                            letterSpacing: 0.2,
                                        }}
                                    >
                                        Novo agendamento
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View style={{ paddingTop: 4 }}>
                                {dayOccurrences.map((o) => (
                                    <AppointmentCard
                                        key={`${o.recurringAppointmentId}-${o.originalDate}`}
                                        occurrence={o}
                                        onPress={onPressAppointment}
                                    />
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}
