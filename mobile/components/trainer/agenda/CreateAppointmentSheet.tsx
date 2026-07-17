import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Pressable,
} from "react-native";
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetScrollView,
    BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Check, ChevronRight, Search, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTrainerStudentsList, type TrainerStudent } from "../../../hooks/useTrainerStudentsList";
import { useRoleMode } from "../../../contexts/RoleModeContext";
import {
    useAppointmentMutations,
    type CreateAppointmentInput,
} from "../../../hooks/useAppointmentMutations";
import { useScheduleAppointmentReminder } from "../../../hooks/useScheduleAppointmentReminder";
import type { AppointmentFrequency } from "@kinevo/shared/types/appointments";
import { matchesSearch } from "@kinevo/shared/utils/search-text";
import { useV2Colors, type V2Palette } from "../../../hooks/useV2Colors";

/** When provided, the sheet edits an existing recurring rule instead of
 *  creating one. Date isn't editable here (use "Remarcar" to move day/time of a
 *  series); this edits student / time / duration / frequency / notes. */
export interface EditingAppointment {
    id: string;
    studentId: string;
    startTime: string; // HH:MM
    durationMinutes: number;
    frequency: AppointmentFrequency;
    notes: string | null;
}

interface CreateAppointmentSheetProps {
    visible: boolean;
    /** Optional initial date (defaults to today). Used when opened from agenda day. */
    initialDate?: Date;
    /** When set, the sheet is in edit mode for this rule. */
    editing?: EditingAppointment | null;
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
    editing,
    onClose,
    onCreated,
}: CreateAppointmentSheetProps) {
    const colors = useV2Colors();
    const isEdit = !!editing;
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["92%"], []);
    const { students: allStudentsListed, isLoading: studentsLoading } = useTrainerStudentsList();
    const { trainerId } = useRoleMode();
    // Estúdios: a agenda é PESSOAL do responsável — a lista org-aware inclui
    // alunos de colegas, mas agendar para eles falharia ('Sem permissão').
    // O picker mostra só os próprios.
    const studentsListed = useMemo(
        () => allStudentsListed.filter((s) => !s.coach_id || s.coach_id === trainerId),
        [allStudentsListed, trainerId],
    );
    const { createAppointment, updateRecurring } = useAppointmentMutations();
    const { getReminderPermissionStatus, requestReminderPermission, scheduleForRule, refreshForRule } =
        useScheduleAppointmentReminder();
    const [permissionDenied, setPermissionDenied] = useState(false);

    // MULTI (decisão 17/jul): estúdio agenda vários alunos no MESMO horário —
    // uma rotina por aluno. No modo EDIÇÃO segue 1 (a regra é de um aluno).
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
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
            // Prefill from the rule when editing, otherwise reset to defaults.
            if (editing) {
                setSelectedStudentIds([editing.studentId]);
                setTime(editing.startTime);
                setDuration(editing.durationMinutes);
                setFrequency(editing.frequency);
                setNotes(editing.notes ?? "");
            } else {
                setSelectedStudentIds([]);
                setTime("09:00");
                setDuration(60);
                setFrequency("weekly");
                setNotes("");
            }
            setDate(initialDate ?? new Date());
            setEndsOn(null);
            setStudentSearch("");
            setError(null);
            setSubmitting(false);
        } else {
            sheetRef.current?.close();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, initialDate, editing?.id]);

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
        const all = (studentsListed ?? []).filter((s: TrainerStudent) => !s.is_trainer_profile);
        if (!studentSearch.trim()) return all;
        return all.filter((s: TrainerStudent) => matchesSearch(s.name, studentSearch));
    }, [studentsListed, studentSearch]);

    const selectedStudents = useMemo(
        () =>
            selectedStudentIds
                .map((id) => studentsListed?.find((s: TrainerStudent) => s.id === id))
                .filter((s): s is TrainerStudent => !!s),
        [studentsListed, selectedStudentIds],
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
        if (selectedStudentIds.length === 0) {
            setError("Selecione ao menos um aluno");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);

        // Edit mode: update the rule's student/time/duration/frequency/notes.
        // Day/start date stay as-is (moving a series is "Remarcar").
        if (editing) {
            const res = await updateRecurring({
                id: editing.id,
                studentId: selectedStudentIds[0],
                startTime: time,
                durationMinutes: duration,
                frequency,
                notes: notes.trim() ? notes.trim() : null,
            });
            if (!res.success) {
                setSubmitting(false);
                setError(res.error ?? "Erro ao atualizar agendamento");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }
            await refreshForRule(editing.id);
            setSubmitting(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onCreated();
            onClose();
            return;
        }

        const startsOn = toLocalDateKey(date);
        const dayOfWeek = date.getDay();

        // Uma rotina POR ALUNO (turma no mesmo horário). Independentes:
        // remarcar/cancelar um não afeta os demais.
        const createdIds: string[] = [];
        const failures: string[] = [];
        let firstError: string | null = null;
        for (const sid of selectedStudentIds) {
            const input: CreateAppointmentInput = {
                studentId: sid,
                dayOfWeek,
                startTime: time,
                durationMinutes: duration,
                frequency,
                startsOn,
                endsOn: frequency === "once" ? startsOn : endsOn,
                notes: notes.trim() ? notes.trim() : null,
            };
            const result = await createAppointment(input);
            if (result.success && result.data) {
                createdIds.push(result.data.id);
            } else {
                failures.push(studentsListed?.find((st: TrainerStudent) => st.id === sid)?.name ?? "aluno");
                firstError ??= result.error ?? null;
            }
        }

        if (createdIds.length === 0) {
            setSubmitting(false);
            setError(firstError ?? "Erro ao criar agendamento");
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

        for (const rid of createdIds) await scheduleForRule(rid);

        if (failures.length > 0) {
            setSubmitting(false);
            setError(`Não foi possível agendar: ${failures.join(", ")}. Os demais foram criados.`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            onCreated();
            return;
        }

        setSubmitting(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCreated();
        onClose();
    }, [
        editing,
        selectedStudentIds,
        studentsListed,
        date,
        time,
        duration,
        frequency,
        endsOn,
        notes,
        createAppointment,
        updateRecurring,
        getReminderPermissionStatus,
        requestReminderPermission,
        scheduleForRule,
        refreshForRule,
        onCreated,
        onClose,
    ]);

    if (!visible) return null;

    return (
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
            {/* IMPORTANT: BottomSheetScrollView must be a direct child of BottomSheet
                so the integrated scroll/pan delegation works. Wrapping it inside a
                BottomSheetView used to make the sheet "jump" back up when the user
                scrolled vertically — the sheet's pan handler was interpreting the
                scroll as a drag instead of forwarding it to the ScrollView. */}
            <BottomSheetScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                stickyHeaderIndices={[0]}
            >
                {/* Sticky header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 20,
                        paddingBottom: 12,
                        backgroundColor: colors.surface.card,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.subtle,
                    }}
                >
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <X size={22} color={colors.text.tertiary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }}>
                        {isEdit ? "Editar agendamento" : "Novo agendamento"}
                    </Text>
                    <TouchableOpacity onPress={handleSubmit} disabled={submitting} hitSlop={8}>
                        {submitting ? (
                            <ActivityIndicator size="small" color={colors.purple[600]} />
                        ) : (
                            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.purple[600] }}>
                                Salvar
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    {/* Aluno picker */}
                    <SectionLabel colors={colors}>{editing ? "Aluno" : "Alunos (um ou mais no horário)"}</SectionLabel>
{selectedStudents.length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            {selectedStudents.map((st) => (
                                <Pressable
                                    key={st.id}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setSelectedStudentIds((prev) =>
                                            editing ? prev : prev.filter((id) => id !== st.id),
                                        );
                                    }}
                                    accessibilityLabel={`Remover ${st.name}`}
                                >
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 6,
                                            paddingLeft: 10,
                                            paddingRight: 8,
                                            paddingVertical: 6,
                                            borderRadius: 999,
                                            backgroundColor: colors.purple[100],
                                            borderWidth: 1,
                                            borderColor: colors.purple[600],
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.purple[600] }}>
                                            {st.name}
                                        </Text>
                                        {!editing && <X size={12} color={colors.purple[600]} />}
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )}
                    <View
                        style={{
                            backgroundColor: colors.surface.card2,
                            borderRadius: 12,
                            padding: 8,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Search size={16} color={colors.text.quaternary} />
                            <BottomSheetTextInput
                                placeholder={selectedStudents.length > 0 && !editing ? "Adicionar outro aluno no horário..." : "Buscar aluno..."}
                                placeholderTextColor={colors.text.quaternary}
                                value={studentSearch}
                                onChangeText={setStudentSearch}
                                style={{ flex: 1, fontSize: 14, color: colors.text.primary, marginLeft: 8, paddingVertical: 6 }}
                            />
                        </View>
                        {studentsLoading ? (
                            <ActivityIndicator size="small" color={colors.purple[600]} style={{ marginVertical: 16 }} />
                        ) : (
                            <View>
                                {filteredStudents.length === 0 ? (
                                    <Text style={{ textAlign: "center", color: colors.text.quaternary, fontSize: 12, paddingVertical: 16 }}>
                                        Nenhum aluno encontrado
                                    </Text>
                                ) : (
                                    filteredStudents.map((s: TrainerStudent) => {
                                        const isSelected = selectedStudentIds.includes(s.id);
                                        return (
                                            <Pressable
                                                key={s.id}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setSelectedStudentIds((prev) =>
                                                        editing
                                                            ? [s.id]
                                                            : isSelected
                                                              ? prev.filter((id) => id !== s.id)
                                                              : [...prev, s.id],
                                                    );
                                                    setStudentSearch("");
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel={`${isSelected ? "Remover" : "Selecionar"} ${s.name}`}
                                                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                                            >
                                                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: isSelected ? colors.purple[100] : "transparent" }}>
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
                                                            backgroundColor: colors.surface.card2,
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            marginRight: 10,
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.text.tertiary }}>
                                                            {initialsOf(s.name)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={{ flex: 1, fontSize: 14, color: colors.text.primary }}>{s.name}</Text>
                                                {isSelected && (
                                                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.purple[600] }}>NA TURMA</Text>
                                                )}
                                                </View>
                                            </Pressable>
                                        );
                                    })
                                )}
                            </View>
                        )}
                    </View>

                    {/* Date picker (horizontal scroll of days) — create only.
                        Moving an existing series' day/date is done via "Remarcar". */}
                    {!isEdit && (
                    <>
                    <SectionLabel colors={colors}>Data</SectionLabel>
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
                                    style={{
                                        width: 56,
                                        paddingVertical: 10,
                                        alignItems: "center",
                                        borderRadius: 12,
                                        backgroundColor: selected ? colors.purple[600] : colors.surface.card2,
                                        borderWidth: 1,
                                        borderColor: selected ? colors.purple[600] : colors.border.default,
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
                    </>
                    )}

                    {/* Time picker (horizontal slots) */}
                    <SectionLabel colors={colors}>Horário</SectionLabel>
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
                                    style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 100,
                                        backgroundColor: selected ? colors.purple[600] : colors.surface.card2,
                                        borderWidth: 1,
                                        borderColor: selected ? colors.purple[600] : colors.border.default,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? "#ffffff" : colors.text.primary }}>
                                        {t}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    {/* Duration */}
                    <SectionLabel colors={colors}>Duração</SectionLabel>
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
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        alignItems: "center",
                                        backgroundColor: selected ? colors.purple[600] : colors.surface.card2,
                                        borderWidth: 1,
                                        borderColor: selected ? colors.purple[600] : colors.border.default,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? "#ffffff" : colors.text.primary }}>
                                        {d} min
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Recurrence */}
                    <SectionLabel colors={colors}>Recorrência</SectionLabel>
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
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        padding: 12,
                                        borderRadius: 12,
                                        backgroundColor: selected ? colors.purple[100] : colors.surface.card2,
                                        borderWidth: 1,
                                        borderColor: selected ? colors.purple[600] : colors.border.default,
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary }}>
                                            {opt.label}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                                            {opt.hint}
                                        </Text>
                                    </View>
                                    {selected && <Check size={18} color={colors.purple[600]} />}
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Notes */}
                    <SectionLabel colors={colors}>Notas (opcional)</SectionLabel>
                    <BottomSheetTextInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Foco do treino, observações..."
                        placeholderTextColor={colors.text.quaternary}
                        multiline
                        maxLength={500}
                        style={{
                            minHeight: 80,
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

                    {permissionDenied ? (
                        <View
                            style={{
                                marginTop: 14,
                                backgroundColor: "rgba(245,158,11,0.12)",
                                borderRadius: 10,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "rgba(245,158,11,0.30)",
                            }}
                        >
                            <Text style={{ fontSize: 12, color: "#f59e0b", lineHeight: 18 }}>
                                Ative notificações em Configurações pra receber lembretes de agendamento.
                            </Text>
                        </View>
                    ) : null}

                    {error ? (
                        <View
                            style={{
                                marginTop: 14,
                                backgroundColor: "rgba(239,68,68,0.10)",
                                borderRadius: 10,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "rgba(239,68,68,0.30)",
                            }}
                        >
                            <Text style={{ fontSize: 12, color: "#ef4444" }}>{error}</Text>
                        </View>
                    ) : null}
                </View>
            </BottomSheetScrollView>
        </BottomSheet>
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
