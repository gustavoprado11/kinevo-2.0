import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Pressable,
} from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Check, ChevronRight, Search, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTrainerStudentsList, type TrainerStudent } from "../../../hooks/useTrainerStudentsList";
import {
    useAppointmentMutations,
    type CreateAppointmentInput,
} from "../../../hooks/useAppointmentMutations";
import { useScheduleAppointmentReminder } from "../../../hooks/useScheduleAppointmentReminder";
import type { AppointmentFrequency } from "@kinevo/shared/types/appointments";

interface CreateAppointmentSheetProps {
    visible: boolean;
    /** Optional initial date (defaults to today). Used when opened from agenda day. */
    initialDate?: Date;
    onClose: () => void;
    onCreated: () => void;
}

const DURATION_OPTIONS: number[] = [30, 60, 90, 120];

const FREQUENCY_OPTIONS: { value: AppointmentFrequency; label: string; hint: string }[] = [
    { value: "once", label: "Único", hint: "Apenas neste dia" },
    { value: "weekly", label: "Semanal", hint: "Toda semana" },
    { value: "biweekly", label: "Quinzenal", hint: "A cada 2 semanas" },
    { value: "monthly", label: "Mensal", hint: "Mesmo dia do mês" },
];

const DAY_LABELS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
    "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
}

/** Build a flat list of HH:MM strings every 15 min, 06:00 → 22:45. */
const TIME_SLOTS: string[] = (() => {
    const out: string[] = [];
    for (let h = 6; h <= 22; h++) {
        for (const m of [0, 15, 30, 45]) {
            out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
    }
    return out;
})();

export function CreateAppointmentSheet({
    visible,
    initialDate,
    onClose,
    onCreated,
}: CreateAppointmentSheetProps) {
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["92%"], []);
    const { students: studentsListed, isLoading: studentsLoading } = useTrainerStudentsList();
    const { createAppointment } = useAppointmentMutations();
    const { getReminderPermissionStatus, requestReminderPermission, scheduleForRule } =
        useScheduleAppointmentReminder();
    const [permissionDenied, setPermissionDenied] = useState(false);

    const [studentId, setStudentId] = useState<string | null>(null);
    const [date, setDate] = useState<Date>(() => initialDate ?? new Date());
    const [time, setTime] = useState<string>("09:00");
    const [duration, setDuration] = useState<number>(60);
    const [frequency, setFrequency] = useState<AppointmentFrequency>("weekly");
    const [endsOn, setEndsOn] = useState<string | null>(null);
    const [notes, setNotes] = useState<string>("");
    const [studentSearch, setStudentSearch] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            sheetRef.current?.expand();
            // Reset form on each open
            setStudentId(null);
            setDate(initialDate ?? new Date());
            setTime("09:00");
            setDuration(60);
            setFrequency("weekly");
            setEndsOn(null);
            setNotes("");
            setStudentSearch("");
            setError(null);
            setSubmitting(false);
        } else {
            sheetRef.current?.close();
        }
    }, [visible, initialDate]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.45}
            />
        ),
        [],
    );

    const filteredStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        const all = (studentsListed ?? []).filter((s: TrainerStudent) => !s.is_trainer_profile);
        if (!q) return all;
        return all.filter((s: TrainerStudent) => s.name.toLowerCase().includes(q));
    }, [studentsListed, studentSearch]);

    const selectedStudent = useMemo(
        () => studentsListed?.find((s: TrainerStudent) => s.id === studentId) ?? null,
        [studentsListed, studentId],
    );

    // Days strip: 60 days from today
    const dayOptions = useMemo(() => {
        const today = new Date();
        const arr: Date[] = [];
        for (let i = 0; i < 60; i++) arr.push(addDays(today, i));
        return arr;
    }, []);

    const handleSubmit = useCallback(async () => {
        setError(null);
        if (!studentId) {
            setError("Selecione um aluno");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);

        const startsOn = toLocalDateKey(date);
        const dayOfWeek = date.getDay();

        const input: CreateAppointmentInput = {
            studentId,
            dayOfWeek,
            startTime: time,
            durationMinutes: duration,
            frequency,
            startsOn,
            endsOn: frequency === "once" ? startsOn : endsOn,
            notes: notes.trim() ? notes.trim() : null,
        };

        const result = await createAppointment(input);

        if (!result.success || !result.data) {
            setSubmitting(false);
            setError(result.error ?? "Erro ao criar agendamento");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        // First-create permission flow: ask if not yet granted, then schedule.
        const perm = await getReminderPermissionStatus();
        if (!perm.granted && perm.canAskAgain) {
            const after = await requestReminderPermission();
            setPermissionDenied(!after.granted && !after.canAskAgain);
        } else if (!perm.granted) {
            setPermissionDenied(true);
        }

        await scheduleForRule(result.data.id);

        setSubmitting(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCreated();
        onClose();
    }, [
        studentId,
        date,
        time,
        duration,
        frequency,
        endsOn,
        notes,
        createAppointment,
        getReminderPermissionStatus,
        requestReminderPermission,
        scheduleForRule,
        onCreated,
        onClose,
    ]);

    if (!visible) return null;

    return (
        <BottomSheet
            ref={sheetRef}
            snapPoints={snapPoints}
            index={0}
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: "#ffffff" }}
            handleIndicatorStyle={{ backgroundColor: "#cbd5e1" }}
        >
            <BottomSheetView style={{ flex: 1 }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 20,
                        paddingBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "#f1f5f9",
                    }}
                >
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                        Novo agendamento
                    </Text>
                    <TouchableOpacity onPress={handleSubmit} disabled={submitting} hitSlop={8}>
                        {submitting ? (
                            <ActivityIndicator size="small" color="#7c3aed" />
                        ) : (
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#7c3aed" }}>
                                Salvar
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Aluno picker */}
                    <SectionLabel>Aluno</SectionLabel>
                    {selectedStudent ? (
                        <Pressable
                            onPress={() => {
                                Haptics.selectionAsync();
                                setStudentId(null);
                            }}
                            style={({ pressed }) => ({
                                flexDirection: "row",
                                alignItems: "center",
                                padding: 12,
                                borderRadius: 12,
                                backgroundColor: "#f5f3ff",
                                borderWidth: 1,
                                borderColor: "#7c3aed",
                                opacity: pressed ? 0.85 : 1,
                            })}
                        >
                            {selectedStudent.avatar_url ? (
                                <Image
                                    source={{ uri: selectedStudent.avatar_url }}
                                    style={{ width: 36, height: 36, borderRadius: 12, marginRight: 10 }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 12,
                                        backgroundColor: "#ede9fe",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 10,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#7c3aed" }}>
                                        {initialsOf(selectedStudent.name)}
                                    </Text>
                                </View>
                            )}
                            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#0f172a" }}>
                                {selectedStudent.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#7c3aed", fontWeight: "600" }}>Trocar</Text>
                        </Pressable>
                    ) : (
                        <View
                            style={{
                                backgroundColor: "#f8fafc",
                                borderRadius: 12,
                                padding: 8,
                                borderWidth: 1,
                                borderColor: "#e2e8f0",
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Search size={16} color="#94a3b8" />
                                <TextInput
                                    placeholder="Buscar aluno..."
                                    placeholderTextColor="#94a3b8"
                                    value={studentSearch}
                                    onChangeText={setStudentSearch}
                                    style={{ flex: 1, fontSize: 14, color: "#0f172a", marginLeft: 8, paddingVertical: 6 }}
                                />
                            </View>
                            {studentsLoading ? (
                                <ActivityIndicator size="small" color="#7c3aed" style={{ marginVertical: 16 }} />
                            ) : (
                                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                                    {filteredStudents.length === 0 ? (
                                        <Text style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, paddingVertical: 16 }}>
                                            Nenhum aluno encontrado
                                        </Text>
                                    ) : (
                                        filteredStudents.map((s: TrainerStudent) => (
                                            <Pressable
                                                key={s.id}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setStudentId(s.id);
                                                }}
                                                style={({ pressed }) => ({
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    paddingVertical: 8,
                                                    paddingHorizontal: 8,
                                                    borderRadius: 8,
                                                    opacity: pressed ? 0.6 : 1,
                                                })}
                                            >
                                                {s.avatar_url ? (
                                                    <Image
                                                        source={{ uri: s.avatar_url }}
                                                        style={{ width: 28, height: 28, borderRadius: 9, marginRight: 10 }}
                                                    />
                                                ) : (
                                                    <View
                                                        style={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: 9,
                                                            backgroundColor: "#f1f5f9",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            marginRight: 10,
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b" }}>
                                                            {initialsOf(s.name)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={{ fontSize: 13, color: "#0f172a", flex: 1 }}>{s.name}</Text>
                                                <ChevronRight size={14} color="#cbd5e1" />
                                            </Pressable>
                                        ))
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {/* Date picker (horizontal scroll of days) */}
                    <SectionLabel>Data</SectionLabel>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                        {dayOptions.map((d) => {
                            const selected = isSameDay(d, date);
                            const isToday = isSameDay(d, new Date());
                            return (
                                <Pressable
                                    key={d.toISOString()}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setDate(d);
                                    }}
                                    style={({ pressed }) => ({
                                        width: 56,
                                        paddingVertical: 10,
                                        alignItems: "center",
                                        borderRadius: 12,
                                        backgroundColor: selected ? "#7c3aed" : "#f8fafc",
                                        borderWidth: 1,
                                        borderColor: selected ? "#7c3aed" : "#e2e8f0",
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "600",
                                            color: selected ? "rgba(255,255,255,0.9)" : "#94a3b8",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {DAY_LABELS_SHORT[d.getDay()]}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 18,
                                            fontWeight: "700",
                                            color: selected ? "#ffffff" : "#0f172a",
                                            marginTop: 2,
                                        }}
                                    >
                                        {d.getDate()}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: selected ? "rgba(255,255,255,0.85)" : "#64748b",
                                            marginTop: 1,
                                        }}
                                    >
                                        {isToday ? "Hoje" : MONTH_LABELS[d.getMonth()]}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    {/* Time picker (horizontal slots) */}
                    <SectionLabel>Horário</SectionLabel>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                        {TIME_SLOTS.map((t) => {
                            const selected = t === time;
                            return (
                                <Pressable
                                    key={t}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setTime(t);
                                    }}
                                    style={({ pressed }) => ({
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 100,
                                        backgroundColor: selected ? "#7c3aed" : "#f8fafc",
                                        borderWidth: 1,
                                        borderColor: selected ? "#7c3aed" : "#e2e8f0",
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? "#ffffff" : "#0f172a" }}>
                                        {t}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    {/* Duration */}
                    <SectionLabel>Duração</SectionLabel>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {DURATION_OPTIONS.map((d) => {
                            const selected = d === duration;
                            return (
                                <Pressable
                                    key={d}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setDuration(d);
                                    }}
                                    style={({ pressed }) => ({
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        alignItems: "center",
                                        backgroundColor: selected ? "#7c3aed" : "#f8fafc",
                                        borderWidth: 1,
                                        borderColor: selected ? "#7c3aed" : "#e2e8f0",
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? "#ffffff" : "#0f172a" }}>
                                        {d} min
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Recurrence */}
                    <SectionLabel>Recorrência</SectionLabel>
                    <View style={{ gap: 8 }}>
                        {FREQUENCY_OPTIONS.map((opt) => {
                            const selected = frequency === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setFrequency(opt.value);
                                        if (opt.value === "once") setEndsOn(null);
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: "row",
                                        alignItems: "center",
                                        padding: 12,
                                        borderRadius: 12,
                                        backgroundColor: selected ? "#f5f3ff" : "#f8fafc",
                                        borderWidth: 1,
                                        borderColor: selected ? "#7c3aed" : "#e2e8f0",
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a" }}>
                                            {opt.label}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                            {opt.hint}
                                        </Text>
                                    </View>
                                    {selected && <Check size={18} color="#7c3aed" />}
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Notes */}
                    <SectionLabel>Notas (opcional)</SectionLabel>
                    <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Foco do treino, observações..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        maxLength={500}
                        style={{
                            minHeight: 80,
                            backgroundColor: "#f8fafc",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#e2e8f0",
                            padding: 12,
                            fontSize: 14,
                            color: "#0f172a",
                            textAlignVertical: "top",
                        }}
                    />

                    {permissionDenied ? (
                        <View
                            style={{
                                marginTop: 14,
                                backgroundColor: "#fffbeb",
                                borderRadius: 10,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "#fde68a",
                            }}
                        >
                            <Text style={{ fontSize: 12, color: "#92400e", lineHeight: 18 }}>
                                Ative notificações em Configurações pra receber lembretes de agendamento.
                            </Text>
                        </View>
                    ) : null}

                    {error ? (
                        <View
                            style={{
                                marginTop: 14,
                                backgroundColor: "#fef2f2",
                                borderRadius: 10,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "#fecaca",
                            }}
                        >
                            <Text style={{ fontSize: 12, color: "#b91c1c" }}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>
            </BottomSheetView>
        </BottomSheet>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 11,
                fontWeight: "700",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginTop: 18,
                marginBottom: 8,
            }}
        >
            {children}
        </Text>
    );
}

function initialsOf(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
