import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    Image,
    ScrollView,
    Pressable,
    Alert,
    ActivityIndicator,
    TextInput,
} from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import {
    CalendarClock,
    Repeat,
    Trash2,
    PencilLine,
    X,
    StickyNote,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { EditScopeDialog, type EditScope } from "./EditScopeDialog";
import {
    useAppointmentMutations,
    type RescheduleScope,
} from "../../../hooks/useAppointmentMutations";
import { useScheduleAppointmentReminder } from "../../../hooks/useScheduleAppointmentReminder";
import type {
    AgendaOccurrence,
} from "../../../hooks/useAgendaOccurrences";
import type { AppointmentFrequency } from "@kinevo/shared/types/appointments";

interface AppointmentDetailSheetProps {
    occurrence: AgendaOccurrence | null;
    /**
     * Caller-provided `frequency` when known. We also fetch it on the fly via
     * `useAppointmentMutations` if the projection doesn't include it.
     */
    frequencyHint?: AppointmentFrequency;
    onClose: () => void;
    onChanged: () => void;
}

const DAY_LABELS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
    "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

const TIME_SLOTS: string[] = (() => {
    const out: string[] = [];
    for (let h = 6; h <= 22; h++) {
        for (const m of [0, 15, 30, 45]) {
            out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
    }
    return out;
})();

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

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function frequencyLabel(f: AppointmentFrequency | null | undefined): string {
    switch (f) {
        case "once":
            return "Único";
        case "weekly":
            return "Semanal";
        case "biweekly":
            return "Quinzenal";
        case "monthly":
            return "Mensal";
        default:
            return "—";
    }
}

function endTimeOf(start: string, durationMinutes: number): string {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + durationMinutes;
    const eh = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const em = String(total % 60).padStart(2, "0");
    return `${eh}:${em}`;
}

function initialsOf(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

type Mode = "view" | "reschedule" | "edit_notes";

export function AppointmentDetailSheet({
    occurrence,
    frequencyHint,
    onClose,
    onChanged,
}: AppointmentDetailSheetProps) {
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["75%", "92%"], []);
    const { cancelOccurrence, cancelSeries, rescheduleOccurrence, updateRecurring } =
        useAppointmentMutations();
    const { scheduleForRule, cancelForRule, refreshForRule } = useScheduleAppointmentReminder();

    const [mode, setMode] = useState<Mode>("view");
    const [scopeAction, setScopeAction] = useState<"cancel" | "reschedule" | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reschedule form state
    const [newDate, setNewDate] = useState<Date>(() => new Date());
    const [newTime, setNewTime] = useState<string>("09:00");

    // Edit notes state
    const [notesDraft, setNotesDraft] = useState<string>("");

    const visible = occurrence !== null;

    useEffect(() => {
        if (visible) {
            sheetRef.current?.expand();
            setMode("view");
            setScopeAction(null);
            setError(null);
            setBusy(false);
            if (occurrence) {
                const [y, m, d] = occurrence.date.split("-").map(Number);
                setNewDate(new Date(y, m - 1, d));
                setNewTime(occurrence.startTime);
                setNotesDraft(occurrence.notes ?? "");
            }
        } else {
            sheetRef.current?.close();
        }
    }, [visible, occurrence]);

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

    const isRecurring =
        frequencyHint && frequencyHint !== "once" ? true : !occurrence ? false : frequencyHint !== "once";

    // Cancel flow ---------------------------------------------------------
    const handleCancelPress = useCallback(() => {
        if (!occurrence) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (frequencyHint === "once") {
            confirmCancel("whole_series");
            return;
        }
        // Recurring → ask scope (excluding "this and future" — cancel uses only_this or whole_series)
        setScopeAction("cancel");
    }, [occurrence, frequencyHint]);

    const confirmCancel = useCallback(
        (scope: EditScope) => {
            if (!occurrence) return;
            const title =
                scope === "only_this"
                    ? "Cancelar esta ocorrência?"
                    : "Cancelar toda a série?";
            const message =
                scope === "only_this"
                    ? "Essa ocorrência será marcada como cancelada e não aparecerá mais na agenda."
                    : "Todas as ocorrências futuras serão removidas da agenda.";
            Alert.alert(title, message, [
                { text: "Voltar", style: "cancel" },
                {
                    text: "Cancelar",
                    style: "destructive",
                    onPress: async () => {
                        setBusy(true);
                        setError(null);
                        const res =
                            scope === "only_this"
                                ? await cancelOccurrence({
                                      recurringAppointmentId: occurrence.recurringAppointmentId,
                                      occurrenceDate: occurrence.originalDate,
                                  })
                                : await cancelSeries(occurrence.recurringAppointmentId);
                        if (!res.success) {
                            setBusy(false);
                            setError(res.error ?? "Erro ao cancelar");
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            return;
                        }
                        if (scope === "only_this") {
                            await refreshForRule(occurrence.recurringAppointmentId);
                        } else {
                            await cancelForRule(occurrence.recurringAppointmentId);
                        }
                        setBusy(false);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onChanged();
                        onClose();
                    },
                },
            ]);
        },
        [occurrence, cancelOccurrence, cancelSeries, onChanged, onClose],
    );

    const handleScopeSelect = useCallback(
        (scope: EditScope) => {
            const action = scopeAction;
            setScopeAction(null);
            if (!occurrence || !action) return;

            if (action === "cancel") {
                // Cancel never offers "this_and_future"; map remaining options.
                confirmCancel(scope);
                return;
            }

            if (action === "reschedule") {
                if (scope === "whole_series") {
                    // Treat as edit-the-rule date/time → opens reschedule UI
                    // and submits as updateRecurring on save.
                    setMode("reschedule");
                    return;
                }
                setMode("reschedule");
                // Stash chosen scope for submit
                rescheduleScopeRef.current =
                    scope === "this_and_future" ? "this_and_future" : "only_this";
            }
        },
        [scopeAction, occurrence, confirmCancel],
    );

    // Reschedule flow -----------------------------------------------------
    const rescheduleScopeRef = useRef<RescheduleScope | "whole_series">("only_this");

    const handleReschedulePress = useCallback(() => {
        if (!occurrence) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (frequencyHint === "once") {
            // Single appointment → there's no "occurrence vs series" distinction;
            // a single rule can be moved entirely. Use only_this (web replicates
            // this internally).
            rescheduleScopeRef.current = "only_this";
            setMode("reschedule");
            return;
        }
        setScopeAction("reschedule");
    }, [occurrence, frequencyHint]);

    const submitReschedule = useCallback(async () => {
        if (!occurrence) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setBusy(true);
        setError(null);

        const newDateKey = toLocalDateKey(newDate);
        const scopeChoice = rescheduleScopeRef.current;

        let newRuleId: string | undefined;
        if (scopeChoice === "whole_series") {
            // Update the rule itself: starts_on, start_time, day_of_week
            const newDow = newDate.getDay();
            const res = await updateRecurring({
                id: occurrence.recurringAppointmentId,
                startsOn: newDateKey,
                startTime: newTime,
                dayOfWeek: newDow,
            });
            if (!res.success) {
                setBusy(false);
                setError(res.error ?? "Erro ao remarcar");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }
        } else {
            const res = await rescheduleOccurrence({
                recurringAppointmentId: occurrence.recurringAppointmentId,
                originalDate: occurrence.originalDate,
                newDate: newDateKey,
                newStartTime: newTime,
                scope: scopeChoice,
            });
            if (!res.success) {
                setBusy(false);
                setError(res.error ?? "Erro ao remarcar");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }
            newRuleId = res.data?.newRecurringAppointmentId;
        }

        // Reminders: refresh the rule's local pushes. For `this_and_future`,
        // also schedule for the freshly-created rule.
        await refreshForRule(occurrence.recurringAppointmentId);
        if (newRuleId) {
            await scheduleForRule(newRuleId);
        }

        setBusy(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onChanged();
        onClose();
    }, [
        occurrence,
        newDate,
        newTime,
        rescheduleOccurrence,
        updateRecurring,
        refreshForRule,
        scheduleForRule,
        onChanged,
        onClose,
    ]);

    // Edit notes flow -----------------------------------------------------
    const handleEditNotesPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setMode("edit_notes");
    }, []);

    const submitEditNotes = useCallback(async () => {
        if (!occurrence) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setBusy(true);
        setError(null);
        const res = await updateRecurring({
            id: occurrence.recurringAppointmentId,
            notes: notesDraft.trim() ? notesDraft.trim() : null,
        });
        setBusy(false);
        if (!res.success) {
            setError(res.error ?? "Erro ao atualizar notas");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onChanged();
        onClose();
    }, [occurrence, notesDraft, updateRecurring, onChanged, onClose]);

    // Day options for reschedule (today → +60d)
    const dayOptions = useMemo(() => {
        const today = new Date();
        const arr: Date[] = [];
        for (let i = 0; i < 60; i++) arr.push(addDays(today, i));
        return arr;
    }, []);

    if (!occurrence) return null;

    const studentName = occurrence.student?.name ?? "Aluno removido";
    const avatar = occurrence.student?.avatar_url ?? null;
    const startEnd = `${occurrence.startTime} – ${endTimeOf(occurrence.startTime, occurrence.durationMinutes)}`;

    return (
        <>
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
                        <Pressable onPress={onClose} hitSlop={8}>
                            <X size={22} color="#64748b" />
                        </Pressable>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                            {mode === "view"
                                ? "Agendamento"
                                : mode === "reschedule"
                                  ? "Remarcar"
                                  : "Editar notas"}
                        </Text>
                        {mode === "reschedule" ? (
                            <Pressable onPress={submitReschedule} disabled={busy} hitSlop={8}>
                                {busy ? (
                                    <ActivityIndicator size="small" color="#7c3aed" />
                                ) : (
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#7c3aed" }}>
                                        Salvar
                                    </Text>
                                )}
                            </Pressable>
                        ) : mode === "edit_notes" ? (
                            <Pressable onPress={submitEditNotes} disabled={busy} hitSlop={8}>
                                {busy ? (
                                    <ActivityIndicator size="small" color="#7c3aed" />
                                ) : (
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#7c3aed" }}>
                                        Salvar
                                    </Text>
                                )}
                            </Pressable>
                        ) : (
                            <View style={{ width: 22 }} />
                        )}
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Student row */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                            {avatar ? (
                                <Image
                                    source={{ uri: avatar }}
                                    style={{ width: 52, height: 52, borderRadius: 16, marginRight: 12, backgroundColor: "#f1f5f9" }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 16,
                                        backgroundColor: "#f5f3ff",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 12,
                                    }}
                                >
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#7c3aed" }}>
                                        {initialsOf(studentName)}
                                    </Text>
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }} numberOfLines={1}>
                                    {studentName}
                                </Text>
                                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                                    {startEnd} · {occurrence.durationMinutes} min
                                </Text>
                            </View>
                        </View>

                        {mode === "view" && (
                            <>
                                {/* Info rows */}
                                <InfoRow
                                    icon={<CalendarClock size={16} color="#7c3aed" />}
                                    label="Quando"
                                    value={`${DAY_LABELS_SHORT[parseInt(occurrence.date.slice(8, 10), 10) % 7]} ${occurrence.date.slice(8, 10)}/${occurrence.date.slice(5, 7)}/${occurrence.date.slice(0, 4)}`}
                                />
                                <InfoRow
                                    icon={<Repeat size={16} color="#7c3aed" />}
                                    label="Recorrência"
                                    value={frequencyLabel(frequencyHint ?? null)}
                                />
                                {occurrence.notes ? (
                                    <InfoRow
                                        icon={<StickyNote size={16} color="#7c3aed" />}
                                        label="Notas"
                                        value={occurrence.notes}
                                    />
                                ) : null}

                                {/* Actions */}
                                <View style={{ marginTop: 24, gap: 10 }}>
                                    <ActionButton
                                        icon={<CalendarClock size={18} color="#0f172a" />}
                                        label="Remarcar"
                                        onPress={handleReschedulePress}
                                    />
                                    <ActionButton
                                        icon={<PencilLine size={18} color="#0f172a" />}
                                        label="Editar notas"
                                        onPress={handleEditNotesPress}
                                    />
                                    <ActionButton
                                        icon={<Trash2 size={18} color="#ef4444" />}
                                        label="Cancelar"
                                        labelColor="#ef4444"
                                        onPress={handleCancelPress}
                                    />
                                </View>
                            </>
                        )}

                        {mode === "reschedule" && (
                            <View>
                                <SectionLabel>Nova data</SectionLabel>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                                >
                                    {dayOptions.map((d) => {
                                        const selected = isSameDay(d, newDate);
                                        const isToday = isSameDay(d, new Date());
                                        return (
                                            <Pressable
                                                key={d.toISOString()}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setNewDate(d);
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

                                <SectionLabel>Novo horário</SectionLabel>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                                >
                                    {TIME_SLOTS.map((t) => {
                                        const selected = t === newTime;
                                        return (
                                            <Pressable
                                                key={t}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setNewTime(t);
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

                                <Pressable
                                    onPress={() => setMode("view")}
                                    style={({ pressed }) => ({
                                        marginTop: 18,
                                        paddingVertical: 10,
                                        alignItems: "center",
                                        opacity: pressed ? 0.6 : 1,
                                    })}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>
                                        Voltar
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {mode === "edit_notes" && (
                            <View>
                                <SectionLabel>Notas (opcional)</SectionLabel>
                                <TextInput
                                    value={notesDraft}
                                    onChangeText={setNotesDraft}
                                    placeholder="Foco do treino, observações..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    maxLength={500}
                                    style={{
                                        minHeight: 120,
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
                                <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                                    Notas são compartilhadas em toda a série.
                                </Text>
                                <Pressable
                                    onPress={() => setMode("view")}
                                    style={({ pressed }) => ({
                                        marginTop: 14,
                                        paddingVertical: 10,
                                        alignItems: "center",
                                        opacity: pressed ? 0.6 : 1,
                                    })}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>
                                        Voltar
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {error ? (
                            <View
                                style={{
                                    marginTop: 16,
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

            <EditScopeDialog
                visible={scopeAction !== null}
                title={
                    scopeAction === "cancel"
                        ? "O que cancelar?"
                        : scopeAction === "reschedule"
                          ? "O que remarcar?"
                          : ""
                }
                excludeThisAndFuture={scopeAction === "cancel"}
                onSelect={handleScopeSelect}
                onClose={() => setScopeAction(null)}
            />
        </>
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

function InfoRow({
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
                flexDirection: "row",
                alignItems: "flex-start",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#f1f5f9",
            }}
        >
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: "#f5f3ff",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                }}
            >
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 14, color: "#0f172a", marginTop: 2, lineHeight: 20 }}>{value}</Text>
            </View>
        </View>
    );
}

function ActionButton({
    icon,
    label,
    labelColor = "#0f172a",
    onPress,
}: {
    icon: React.ReactNode;
    label: string;
    labelColor?: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: "#f8fafc",
                borderWidth: 1,
                borderColor: "#e2e8f0",
                opacity: pressed ? 0.7 : 1,
            })}
        >
            <View style={{ width: 24, alignItems: "center" }}>{icon}</View>
            <Text style={{ marginLeft: 10, fontSize: 14, fontWeight: "600", color: labelColor }}>
                {label}
            </Text>
        </Pressable>
    );
}
