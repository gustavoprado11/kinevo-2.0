import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type { AppointmentFrequency } from "@kinevo/shared/types/appointments";

/**
 * Mobile-side mirror of `web/src/actions/appointments/*`. Replicates DB
 * effects of: create-recurring, update-recurring, cancel-recurring,
 * cancel-occurrence, reschedule-occurrence.
 *
 * Skips web-only side-effects: Google Calendar sync, server scheduled_notifications,
 * student_inbox_items push (decisão Bloco A — M17 usa push local via expo-notifications).
 */

export type RescheduleScope = "only_this" | "this_and_future";

export interface CreateAppointmentInput {
    studentId: string;
    dayOfWeek: number;
    startTime: string; // HH:MM
    durationMinutes: number;
    frequency: AppointmentFrequency;
    startsOn: string; // YYYY-MM-DD
    endsOn?: string | null;
    notes?: string | null;
}

export interface UpdateAppointmentInput {
    id: string;
    studentId?: string;
    dayOfWeek?: number;
    startTime?: string;
    durationMinutes?: number;
    frequency?: AppointmentFrequency;
    startsOn?: string;
    endsOn?: string | null;
    notes?: string | null;
}

export interface CancelOccurrenceInput {
    recurringAppointmentId: string;
    occurrenceDate: string; // YYYY-MM-DD
    notes?: string | null;
}

export interface RescheduleOccurrenceInput {
    recurringAppointmentId: string;
    originalDate: string;
    newDate: string;
    newStartTime: string; // HH:MM
    scope: RescheduleScope;
    notes?: string | null;
}

export interface MarkOccurrenceStatusInput {
    recurringAppointmentId: string;
    occurrenceDate: string; // YYYY-MM-DD
    status: "completed" | "no_show";
    notes?: string | null;
}

export interface ClearOccurrenceStatusInput {
    recurringAppointmentId: string;
    occurrenceDate: string; // YYYY-MM-DD
}

export interface MutationResult<T = void> {
    success: boolean;
    error?: string;
    data?: T;
}

function dayOfWeekFromDateKey(dateKey: string): number {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function parseDateKey(key: string): Date {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function toDateKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setUTCDate(r.getUTCDate() + days);
    return r;
}

function todayDateKey(): string {
    const now = new Date();
    return toDateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function useAppointmentMutations() {
    const { trainerId } = useRoleMode();

    const ensureTrainer = useCallback(() => {
        if (!trainerId) {
            return { error: "Treinador não autenticado" } as const;
        }
        return { trainerId } as const;
    }, [trainerId]);

    /** Create — `frequency='once'` for single, otherwise weekly/biweekly/monthly. */
    const createAppointment = useCallback(
        async (input: CreateAppointmentInput): Promise<MutationResult<{ id: string }>> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            // Domain validations mirroring web action.
            if (input.frequency === "monthly") {
                const expectedDow = dayOfWeekFromDateKey(input.startsOn);
                if (input.dayOfWeek !== expectedDow) {
                    return {
                        success: false,
                        error: "Para rotinas mensais, o dia da semana precisa coincidir com a data de início.",
                    };
                }
            }
            if (input.frequency === "once") {
                const expectedDow = dayOfWeekFromDateKey(input.startsOn);
                if (input.dayOfWeek !== expectedDow) {
                    return {
                        success: false,
                        error: "Para agendamento único, o dia da semana precisa coincidir com a data.",
                    };
                }
                if (input.endsOn && input.endsOn !== input.startsOn) {
                    return {
                        success: false,
                        error: "Agendamento único não tem data de término.",
                    };
                }
            }

            // Defense-in-depth: confirm the student belongs to this trainer.
            const { data: student, error: studentErr } = await supabase
                .from("students")
                .select("id, coach_id")
                .eq("id", input.studentId)
                .single();
            if (studentErr || !student) {
                return { success: false, error: "Aluno não encontrado" };
            }
            if (student.coach_id !== auth.trainerId) {
                return { success: false, error: "Sem permissão" };
            }

            const { data, error } = await supabase
                .from("recurring_appointments")
                .insert({
                    trainer_id: auth.trainerId,
                    student_id: input.studentId,
                    day_of_week: input.dayOfWeek,
                    start_time: input.startTime,
                    duration_minutes: input.durationMinutes,
                    frequency: input.frequency,
                    starts_on: input.startsOn,
                    ends_on: input.endsOn ?? null,
                    notes: input.notes ?? null,
                })
                .select("id")
                .single();

            if (error || !data) {
                if (__DEV__) console.error("[createAppointment]", error);
                return { success: false, error: "Erro ao criar agendamento" };
            }

            return { success: true, data: { id: data.id } };
        },
        [ensureTrainer],
    );

    /** Update an existing rule (whole series). Exceptions remain intact. */
    const updateRecurring = useCallback(
        async (input: UpdateAppointmentInput): Promise<MutationResult> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            const { data: existing, error: fetchErr } = await supabase
                .from("recurring_appointments")
                .select("id, trainer_id, student_id, day_of_week, start_time, duration_minutes, frequency, starts_on, ends_on, notes, group_id")
                .eq("id", input.id)
                .single();
            if (fetchErr || !existing) {
                return { success: false, error: "Agendamento não encontrado" };
            }
            if (existing.trainer_id !== auth.trainerId) {
                return { success: false, error: "Sem permissão" };
            }

            // Validate ownership if studentId changed.
            if (input.studentId && input.studentId !== existing.student_id) {
                const { data: newStudent } = await supabase
                    .from("students")
                    .select("id, coach_id")
                    .eq("id", input.studentId)
                    .single();
                if (!newStudent || newStudent.coach_id !== auth.trainerId) {
                    return { success: false, error: "Aluno inválido" };
                }
            }

            const effFrequency = input.frequency ?? existing.frequency;
            const effDow = input.dayOfWeek ?? existing.day_of_week;
            const effStartsOn = input.startsOn ?? existing.starts_on;
            const effEndsOn =
                input.endsOn !== undefined ? input.endsOn : existing.ends_on;

            if (
                effFrequency === "monthly" &&
                effDow !== dayOfWeekFromDateKey(effStartsOn)
            ) {
                return {
                    success: false,
                    error: "Para rotinas mensais, o dia da semana precisa coincidir com a data de início.",
                };
            }
            if (effFrequency === "once") {
                if (effDow !== dayOfWeekFromDateKey(effStartsOn)) {
                    return {
                        success: false,
                        error: "Para agendamento único, o dia da semana precisa coincidir com a data.",
                    };
                }
                if (effEndsOn && effEndsOn !== effStartsOn) {
                    return {
                        success: false,
                        error: "Agendamento único não tem data de término.",
                    };
                }
            }

            const updates: Record<string, unknown> = {};
            if (input.studentId !== undefined) updates.student_id = input.studentId;
            if (input.dayOfWeek !== undefined) updates.day_of_week = input.dayOfWeek;
            if (input.startTime !== undefined) updates.start_time = input.startTime;
            if (input.durationMinutes !== undefined)
                updates.duration_minutes = input.durationMinutes;
            if (input.frequency !== undefined) updates.frequency = input.frequency;
            if (input.startsOn !== undefined) updates.starts_on = input.startsOn;
            if (input.endsOn !== undefined) updates.ends_on = input.endsOn;
            if (input.notes !== undefined) updates.notes = input.notes;

            if (Object.keys(updates).length === 0) return { success: true };

            const { error: updateErr } = await supabase
                .from("recurring_appointments")
                .update(updates)
                .eq("id", input.id);
            if (updateErr) {
                if (__DEV__) console.error("[updateRecurring]", updateErr);
                return { success: false, error: "Erro ao atualizar agendamento" };
            }

            // Mirror group note propagation from web action.
            if (
                existing.group_id &&
                input.notes !== undefined &&
                input.notes !== existing.notes
            ) {
                await supabase
                    .from("recurring_appointments")
                    .update({ notes: input.notes })
                    .eq("group_id", existing.group_id)
                    .eq("trainer_id", auth.trainerId)
                    .neq("id", input.id);
            }

            return { success: true };
        },
        [ensureTrainer],
    );

    /** Cancel the entire series (status='canceled' + ends_on). */
    const cancelSeries = useCallback(
        async (id: string, endsOn?: string): Promise<MutationResult> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            const { data: existing } = await supabase
                .from("recurring_appointments")
                .select("id, trainer_id")
                .eq("id", id)
                .single();
            if (!existing) return { success: false, error: "Agendamento não encontrado" };
            if (existing.trainer_id !== auth.trainerId) {
                return { success: false, error: "Sem permissão" };
            }

            const { error } = await supabase
                .from("recurring_appointments")
                .update({ status: "canceled", ends_on: endsOn ?? todayDateKey() })
                .eq("id", id);
            if (error) {
                if (__DEV__) console.error("[cancelSeries]", error);
                return { success: false, error: "Erro ao encerrar rotina" };
            }
            return { success: true };
        },
        [ensureTrainer],
    );

    /** Cancel a single occurrence — upsert in appointment_exceptions. */
    const cancelOccurrence = useCallback(
        async (input: CancelOccurrenceInput): Promise<MutationResult> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            const { data: rule } = await supabase
                .from("recurring_appointments")
                .select("id, trainer_id")
                .eq("id", input.recurringAppointmentId)
                .single();
            if (!rule) return { success: false, error: "Rotina não encontrada" };
            if (rule.trainer_id !== auth.trainerId) {
                return { success: false, error: "Sem permissão" };
            }

            const { error } = await supabase
                .from("appointment_exceptions")
                .upsert(
                    {
                        recurring_appointment_id: input.recurringAppointmentId,
                        trainer_id: auth.trainerId,
                        occurrence_date: input.occurrenceDate,
                        kind: "canceled",
                        new_date: null,
                        new_start_time: null,
                        notes: input.notes ?? null,
                    },
                    { onConflict: "recurring_appointment_id,occurrence_date" },
                );
            if (error) {
                if (__DEV__) console.error("[cancelOccurrence]", error);
                return { success: false, error: "Erro ao cancelar ocorrência" };
            }
            return { success: true };
        },
        [ensureTrainer],
    );

    /** Reschedule a single occurrence OR split the series at this occurrence. */
    const rescheduleOccurrence = useCallback(
        async (
            input: RescheduleOccurrenceInput,
        ): Promise<MutationResult<{ newRecurringAppointmentId?: string }>> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            const { data: rule } = await supabase
                .from("recurring_appointments")
                .select("id, trainer_id, student_id, day_of_week, duration_minutes, frequency, notes")
                .eq("id", input.recurringAppointmentId)
                .single();
            if (!rule) return { success: false, error: "Rotina não encontrada" };
            if (rule.trainer_id !== auth.trainerId) {
                return { success: false, error: "Sem permissão" };
            }

            if (input.scope === "only_this") {
                const { error } = await supabase
                    .from("appointment_exceptions")
                    .upsert(
                        {
                            recurring_appointment_id: input.recurringAppointmentId,
                            trainer_id: auth.trainerId,
                            occurrence_date: input.originalDate,
                            kind: "rescheduled",
                            new_date: input.newDate,
                            new_start_time: input.newStartTime,
                            notes: input.notes ?? null,
                        },
                        { onConflict: "recurring_appointment_id,occurrence_date" },
                    );
                if (error) {
                    if (__DEV__) console.error("[rescheduleOccurrence only_this]", error);
                    return { success: false, error: "Erro ao remarcar" };
                }

                // For `once` rules, mirror web behavior: also patch the rule itself
                // so projection reflects the new date. (Web does this to keep
                // Google Calendar coherent — same rationale on mobile for the
                // projection helper, since `once` only renders starts_on.)
                if (rule.frequency === "once") {
                    const newDow = parseDateKey(input.newDate).getUTCDay();
                    await supabase
                        .from("recurring_appointments")
                        .update({
                            starts_on: input.newDate,
                            start_time: input.newStartTime,
                            day_of_week: newDow,
                        })
                        .eq("id", input.recurringAppointmentId);
                }

                return { success: true };
            }

            // scope === 'this_and_future' — close original, create new rule.
            const endsOn = toDateKey(addDays(parseDateKey(input.originalDate), -1));
            const newDow = parseDateKey(input.newDate).getUTCDay();

            const { error: endError } = await supabase
                .from("recurring_appointments")
                .update({ ends_on: endsOn })
                .eq("id", input.recurringAppointmentId);
            if (endError) {
                if (__DEV__) console.error("[rescheduleOccurrence end]", endError);
                return { success: false, error: "Erro ao encerrar rotina original" };
            }

            const { data: created, error: insertError } = await supabase
                .from("recurring_appointments")
                .insert({
                    trainer_id: auth.trainerId,
                    student_id: rule.student_id,
                    day_of_week: newDow,
                    start_time: input.newStartTime,
                    duration_minutes: rule.duration_minutes,
                    frequency: rule.frequency,
                    starts_on: input.newDate,
                    ends_on: null,
                    status: "active",
                    notes: rule.notes,
                })
                .select("id")
                .single();
            if (insertError || !created) {
                if (__DEV__) console.error("[rescheduleOccurrence insert]", insertError);
                return { success: false, error: "Erro ao criar nova rotina" };
            }

            return {
                success: true,
                data: { newRecurringAppointmentId: created.id },
            };
        },
        [ensureTrainer],
    );

    /** Mark a single occurrence as completed/no_show — upsert in
     *  appointment_exceptions (kind = status). Mirrors web markOccurrenceStatus. */
    const markOccurrenceStatus = useCallback(
        async (input: MarkOccurrenceStatusInput): Promise<MutationResult> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            const { data: rule } = await supabase
                .from("recurring_appointments")
                .select("id, trainer_id")
                .eq("id", input.recurringAppointmentId)
                .single();
            if (!rule) return { success: false, error: "Rotina não encontrada" };
            if (rule.trainer_id !== auth.trainerId) {
                return { success: false, error: "Sem permissão" };
            }

            const { error } = await supabase
                .from("appointment_exceptions")
                .upsert(
                    {
                        recurring_appointment_id: input.recurringAppointmentId,
                        trainer_id: auth.trainerId,
                        occurrence_date: input.occurrenceDate,
                        kind: input.status,
                        new_date: null,
                        new_start_time: null,
                        notes: input.notes ?? null,
                    },
                    { onConflict: "recurring_appointment_id,occurrence_date" },
                );
            if (error) {
                if (__DEV__) console.error("[markOccurrenceStatus]", error);
                return { success: false, error: "Erro ao atualizar status" };
            }
            return { success: true };
        },
        [ensureTrainer],
    );

    /** Revert a completed/no_show occurrence back to scheduled by deleting the
     *  status exception. Guarded to `kind in (completed, no_show)` so a
     *  reschedule/cancel exception on the same slot is never removed. */
    const clearOccurrenceStatus = useCallback(
        async (input: ClearOccurrenceStatusInput): Promise<MutationResult> => {
            const auth = ensureTrainer();
            if ("error" in auth) return { success: false, error: auth.error };

            const { error } = await supabase
                .from("appointment_exceptions")
                .delete()
                .eq("recurring_appointment_id", input.recurringAppointmentId)
                .eq("trainer_id", auth.trainerId)
                .eq("occurrence_date", input.occurrenceDate)
                .in("kind", ["completed", "no_show"]);
            if (error) {
                if (__DEV__) console.error("[clearOccurrenceStatus]", error);
                return { success: false, error: "Erro ao desmarcar" };
            }
            return { success: true };
        },
        [ensureTrainer],
    );

    return {
        createAppointment,
        updateRecurring,
        cancelSeries,
        cancelOccurrence,
        rescheduleOccurrence,
        markOccurrenceStatus,
        clearOccurrenceStatus,
    };
}
