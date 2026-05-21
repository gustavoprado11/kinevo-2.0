import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    Image,
    ScrollView,
    Pressable,
    Alert,
    ActivityIndicator,
} from "react-native";
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetView,
    BottomSheetScrollView,
    BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import {
    CalendarClock,
    Repeat,
    Trash2,
    PencilLine,
    X,
    StickyNote,
    CheckCircle2,
    XCircle,
    RotateCcw,
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
import { useV2Colors, type V2Palette } from "../../../hooks/useV2Colors";

interface AppointmentDetailSheetProps {
    occurrence: AgendaOccurrence | null;
    /**
     * Caller-provided `frequency` when known. We also fetch it on the fly via
     * `useAppointmentMutations` if the projection doesn't include it.
     */
    frequencyHint?: AppointmentFrequency;
    /** Opens the full edit form (student/time/duration/frequency/notes). */
    onRequestEdit: (occurrence: AgendaOccurrence) => void;
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
    onRequestEdit,
    onClose,
    onChanged,
}: AppointmentDetailSheetProps) {
    const colors = useV2Colors();
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["75%", "92%"], []);
    const {
        cancelOccurrence,
        cancelSeries,
        rescheduleOccurrence,
        updateRecurring,
        markOccurrenceStatus,
        clearOccurrenceStatus,
    } = useAppointmentMutations();
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

    // Mark status flow (completed / no_show) ------------------------------
    const handleMarkStatus = useCallback(
        async (status: "completed" | "no_show") => {
            if (!occurrence) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setBusy(true);
            setError(null);
            const res = await markOccurrenceStatus({
                recurringAppointmentId: occurrence.recurringAppointmentId,
                occurrenceDate: occurrence.originalDate,
                status,
            });
            setBusy(false);
            if (!res.success) {
                setError(res.error ?? "Erro ao atualizar status");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onChanged();
            onClose();
        },
        [occurrence, markOccurrenceStatus, onChanged, onClose],
    );

    const handleClearStatus = useCallback(async () => {
        if (!occurrence) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setBusy(true);
        setError(null);
        const res = await clearOccurrenceStatus({
            recurringAppointmentId: occurrence.recurringAppointmentId,
            occurrenceDate: occurrence.originalDate,
        });
        setBusy(false);
        if (!res.success) {
            setError(res.error ?? "Erro ao desmarcar");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onChanged();
        onClose();
    }, [occurrence, clearOccurrenceStatus, onChanged, onClose]);

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
                enableDynamicSizing={false}
                enablePanDownToClose
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                onClose={onClose}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.surface.card }}
                handleIndicatorStyle={{ backgroundColor: colors.text.quaternary }}
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
                            borderBottomColor: colors.border.subtle,
                        }}
                    >
                        <Pressable onPress={onClose} hitSlop={8}>
                            <X size={22} color={colors.text.tertiary} />
                        </Pressable>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }}>
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

                    <BottomSheetScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Student row */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                            {avatar ? (
                                <Image
                                    source={{ uri: avatar }}
                                    style={{ width: 52, height: 52, borderRadius: 16, marginRight: 12, backgroundColor: colors.surface.card2 }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 16,
                                        backgroundColor: colors.purple[100],
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
                                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                                    {studentName}
                                </Text>
                                <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 2 }}>
                                    {startEnd} · {occurrence.durationMinutes} min
                                </Text>
                            </View>
                        </View>

                        {mode === "view" && (
                            <>
                                {/* Info rows */}
                                <InfoRow
                                    colors={colors}
                                    icon={<CalendarClock size={16} color="#7c3aed" />}
                                    label="Quando"
                                    value={`${DAY_LABELS_SHORT[parseInt(occurrence.date.slice(8, 10), 10) % 7]} ${occurrence.date.slice(8, 10)}/${occurrence.date.slice(5, 7)}/${occurrence.date.slice(0, 4)}`}
                                />
                                <InfoRow
                                    colors={colors}
                                    icon={<Repeat size={16} color="#7c3aed" />}
                                    label="Recorrência"
                                    value={frequencyLabel(frequencyHint ?? null)}
                                />
                                {occurrence.notes ? (
                                    <InfoRow
                                        colors={colors}
                                        icon={<StickyNote size={16} color="#7c3aed" />}
                                        label="Notas"
                                        value={occurrence.notes}
                                    />
                                ) : null}

                                {/* Actions */}
                                <View style={{ marginTop: 24, gap: 10 }}>
                                    {occurrence.status === "completed" || occurrence.status === "no_show" ? (
                                        <ActionButton
                                            colors={colors}
                                            icon={<RotateCcw size={18} color={colors.text.primary} />}
                                            label={occurrence.status === "completed" ? "Desmarcar conclusão" : "Desmarcar falta"}
                                            onPress={handleClearStatus}
                                        />
                                    ) : occurrence.status === "scheduled" ? (
                                        // Only plain scheduled occurrences can be marked: a 'rescheduled'
                                        // occurrence keeps its exception at the original slot, and the
                                        // mark upsert (keyed on original date) would overwrite it.
                                        <>
                                            <ActionButton
                                                colors={colors}
                                                icon={<CheckCircle2 size={18} color="#16a34a" />}
                                                label="Marcar como concluído"
                                                labelColor="#16a34a"
                                                onPress={() => handleMarkStatus("completed")}
                                            />
                                            <ActionButton
                                                colors={colors}
                                                icon={<XCircle size={18} color="#d97706" />}
                                                label="Marcar falta"
                                                labelColor="#d97706"
                                                onPress={() => handleMarkStatus("no_show")}
                                            />
                                        </>
                                    ) : null}
                                    <ActionButton
                                        colors={colors}
                                        icon={<PencilLine size={18} color={colors.text.primary} />}
                                        label="Editar"
                                        onPress={() => onRequestEdit(occurrence)}
                                    />
                                    <ActionButton
                                        colors={colors}
                                        icon={<CalendarClock size={18} color={colors.text.primary} />}
                                        label="Remarcar"
                                        onPress={handleReschedulePress}
                                    />
                                    <ActionButton
                                        colors={colors}
                                        icon={<StickyNote size={18} color={colors.text.primary} />}
                                        label="Editar notas"
                                        onPress={handleEditNotesPress}
                                    />
                                    <ActionButton
                                        colors={colors}
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
                                <SectionLabel colors={colors}>Nova data</SectionLabel>
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
                                                style={{
                                                    width: 56,
                                                    paddingVertical: 10,
                                                    alignItems: "center",
                                                    borderRadius: 12,
                                                    backgroundColor: selected ? "#7c3aed" : colors.surface.card2,
                                                    borderWidth: 1,
                                                    borderColor: selected ? "#7c3aed" : colors.border.default,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: "600",
                                                        color: selected ? "rgba(255,255,255,0.9)" : colors.text.quaternary,
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    {DAY_LABELS_SHORT[d.getDay()]}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 18,
                                                        fontWeight: "700",
                                                        color: selected ? "#ffffff" : colors.text.primary,
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {d.getDate()}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 10,
                                                        color: selected ? "rgba(255,255,255,0.85)" : colors.text.tertiary,
                                                        marginTop: 1,
                                                    }}
                                                >
                                                    {isToday ? "Hoje" : MONTH_LABELS[d.getMonth()]}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>

                                <SectionLabel colors={colors}>Novo horário</SectionLabel>
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
                                                style={{
                                                    paddingVertical: 8,
                                                    paddingHorizontal: 14,
                                                    borderRadius: 100,
                                                    backgroundColor: selected ? "#7c3aed" : colors.surface.card2,
                                                    borderWidth: 1,
                                                    borderColor: selected ? "#7c3aed" : colors.border.default,
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? "#ffffff" : colors.text.primary }}>
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
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.tertiary }}>
                                        Voltar
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {mode === "edit_notes" && (
                            <View>
                                <SectionLabel colors={colors}>Notas (opcional)</SectionLabel>
                                <BottomSheetTextInput
                                    value={notesDraft}
                                    onChangeText={setNotesDraft}
                                    placeholder="Foco do treino, observações..."
                                    placeholderTextColor={colors.text.quaternary}
                                    multiline
                                    maxLength={500}
                                    style={{
                                        minHeight: 120,
                                        backgroundColor: colors.surface.card2,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: colors.border.default,
                                        padding: 12,
                                        fontSize: 14,
                                        color: colors.text.primary,
                                        textAlignVertical: "top",
                                    }}
                                />
                                <Text style={{ fontSize: 11, color: colors.text.quaternary, marginTop: 6 }}>
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
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.tertiary }}>
                                        Voltar
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {error ? (
                            <View
                                style={{
                                    marginTop: 16,
                                    backgroundColor: "rgba(239,68,68,0.10)",
                                    borderRadius: 10,
                                    padding: 12,
                                    borderWidth: 1,
                                    borderColor: "rgba(239,68,68,0.30)",
                                }}
                            >
                                <Text style={{ fontSize: 12, color: "#b91c1c" }}>{error}</Text>
                            </View>
                        ) : null}
                    </BottomSheetScrollView>
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

function SectionLabel({ children, colors }: { children: React.ReactNode; colors: V2Palette }) {
    return (
        <Text
            style={{
                fontSize: 11,
                fontWeight: "700",
                color: colors.text.quaternary,
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
    colors,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    colors: V2Palette;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "flex-start",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
            }}
        >
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: colors.purple[100],
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                }}
            >
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.text.quaternary, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 14, color: colors.text.primary, marginTop: 2, lineHeight: 20 }}>{value}</Text>
            </View>
        </View>
    );
}

function ActionButton({
    icon,
    label,
    labelColor,
    onPress,
    colors,
}: {
    icon: React.ReactNode;
    label: string;
    labelColor?: string;
    onPress: () => void;
    colors: V2Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: colors.surface.card2,
                borderWidth: 1,
                borderColor: colors.border.default,
            }}
        >
            <View style={{ width: 24, alignItems: "center" }}>{icon}</View>
            <Text style={{ marginLeft: 10, fontSize: 14, fontWeight: "600", color: labelColor ?? colors.text.primary }}>
                {label}
            </Text>
        </Pressable>
    );
}
