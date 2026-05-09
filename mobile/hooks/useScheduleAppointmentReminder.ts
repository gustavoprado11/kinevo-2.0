import { useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { iterateValidDates } from "@kinevo/shared/utils/appointments-projection";
import type {
    AppointmentException,
    RecurringAppointment,
} from "@kinevo/shared/types/appointments";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import {
    clearReminderIds,
    getAllRuleIds,
    getReminderIds,
    setReminderIds,
} from "../lib/appointment-reminders";
import {
    APPOINTMENT_REMINDER_DEFAULT,
    fetchAppointmentReminderPrefs,
    type AppointmentReminderMinutes,
} from "./useTrainerNotificationPreferences";

/**
 * Local push reminder scheduling for trainer appointments. Mirrors web
 * `scheduled_notifications` behavior client-side via expo-notifications:
 *
 * - On rule create/edit/reschedule (whole_series): cancel old + schedule next N.
 * - On rule cancel (series): cancel old, no new schedule.
 * - On occurrence reschedule (only_this): also reschedule the affected push.
 * - On occurrence cancel (only_this): cancel that one push.
 *
 * Cap: 12 future occurrences per rule. expo-notifications has a per-device
 * scheduled-trigger limit (iOS 64 total). 12 × N rules is a safer ceiling.
 *
 * Permission: relies on permission already requested by `usePushNotifications`.
 * If denied, scheduling silently no-ops.
 */

const MAX_FUTURE_OCCURRENCES = 12;
/** Lookahead window for projection. 180 days covers monthly cap easily. */
const HORIZON_DAYS = 180;

export interface PermissionStatus {
    granted: boolean;
    canAskAgain: boolean;
}

export async function getReminderPermissionStatus(): Promise<PermissionStatus> {
    if (Platform.OS === "web") return { granted: false, canAskAgain: false };
    const res = await Notifications.getPermissionsAsync();
    return {
        granted: res.status === "granted",
        canAskAgain: res.canAskAgain,
    };
}

export async function requestReminderPermission(): Promise<PermissionStatus> {
    if (Platform.OS === "web") return { granted: false, canAskAgain: false };
    const res = await Notifications.requestPermissionsAsync();
    return {
        granted: res.status === "granted",
        canAskAgain: res.canAskAgain,
    };
}

function parseDateKey(key: string): Date {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function buildOccurrenceTrigger(dateKey: string, hhmm: string, minutesBefore: number): Date | null {
    const [y, m, d] = dateKey.split("-").map(Number);
    const [hh, mm] = hhmm.split(":").map(Number);
    // Interpret in local device timezone — same calendar day/time the trainer typed.
    const slot = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
    const triggerAt = new Date(slot.getTime() - minutesBefore * 60 * 1000);
    if (triggerAt.getTime() <= Date.now() + 5_000) return null;
    return triggerAt;
}

function buildBody(studentName: string, hhmm: string, minutesBefore: number): {
    title: string;
    body: string;
} {
    const minLabel = minutesBefore === 60 ? "1 hora" : `${minutesBefore} min`;
    return {
        title: `Atendimento em ${minLabel}`,
        body: `${studentName} · ${hhmm}`,
    };
}

async function fetchRule(ruleId: string): Promise<RecurringAppointment | null> {
    const { data, error } = await supabase
        .from("recurring_appointments")
        .select("*")
        .eq("id", ruleId)
        .single();
    if (error || !data) return null;
    return data as unknown as RecurringAppointment;
}

async function fetchExceptions(
    ruleId: string,
    rangeStartKey: string,
    rangeEndKey: string,
): Promise<AppointmentException[]> {
    const { data, error } = await supabase
        .from("appointment_exceptions")
        .select("*")
        .eq("recurring_appointment_id", ruleId)
        .or(
            `and(occurrence_date.gte.${rangeStartKey},occurrence_date.lte.${rangeEndKey}),and(new_date.gte.${rangeStartKey},new_date.lte.${rangeEndKey})`,
        );
    if (error || !data) return [];
    return data as unknown as AppointmentException[];
}

async function fetchStudentName(studentId: string): Promise<string> {
    const { data } = await supabase
        .from("students")
        .select("name")
        .eq("id", studentId)
        .single();
    return data?.name ?? "atendimento";
}

function toDateKeyUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDaysUTC(d: Date, days: number): Date {
    const r = new Date(d);
    r.setUTCDate(r.getUTCDate() + days);
    return r;
}

async function cancelStoredRemindersForRule(ruleId: string): Promise<void> {
    const ids = getReminderIds(ruleId);
    if (ids.length === 0) return;
    await Promise.all(
        ids.map((id) =>
            Notifications.cancelScheduledNotificationAsync(id).catch((err) => {
                if (__DEV__) console.warn("[reminders] cancel failed", id, err);
            }),
        ),
    );
    clearReminderIds(ruleId);
}

async function scheduleForOccurrence(args: {
    ruleId: string;
    studentName: string;
    dateKey: string; // effective date (after exceptions)
    startTime: string;
    minutesBefore: number;
}): Promise<string | null> {
    const { ruleId, studentName, dateKey, startTime, minutesBefore } = args;
    const trigger = buildOccurrenceTrigger(dateKey, startTime, minutesBefore);
    if (!trigger) return null;
    const { title, body } = buildBody(studentName, startTime, minutesBefore);
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: {
                    type: "appointment_reminder",
                    recurring_appointment_id: ruleId,
                    occurrence_date: dateKey,
                    start_time: startTime,
                },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: trigger,
            },
        });
        return id;
    } catch (err) {
        if (__DEV__) console.warn("[reminders] schedule failed", err);
        return null;
    }
}

/**
 * (Re)schedule reminders for a whole rule. Cancels any existing pushes for it
 * first, then schedules up to 12 upcoming occurrences (respecting exceptions).
 */
export async function rescheduleRuleReminders(
    ruleId: string,
    minutesBefore: AppointmentReminderMinutes,
): Promise<void> {
    if (Platform.OS === "web") return;

    const perm = await getReminderPermissionStatus();
    if (!perm.granted) {
        // No permission → cleanup local map (we can't have any active pushes).
        await cancelStoredRemindersForRule(ruleId);
        return;
    }

    await cancelStoredRemindersForRule(ruleId);

    const rule = await fetchRule(ruleId);
    if (!rule || rule.status !== "active") return;

    const today = new Date();
    const rangeStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const rangeEnd = addDaysUTC(rangeStart, HORIZON_DAYS);
    const rangeStartKey = toDateKeyUTC(rangeStart);
    const rangeEndKey = toDateKeyUTC(rangeEnd);

    const originalDates = iterateValidDates(rule, rangeStart, rangeEnd);
    if (originalDates.length === 0) return;

    const exceptions = await fetchExceptions(ruleId, rangeStartKey, rangeEndKey);
    const excByOriginal = new Map<string, AppointmentException>();
    for (const exc of exceptions) {
        excByOriginal.set(exc.occurrence_date, exc);
    }

    const studentName = await fetchStudentName(rule.student_id);

    type Slot = { dateKey: string; startTime: string };
    const slots: Slot[] = [];
    for (const originalDate of originalDates) {
        if (slots.length >= MAX_FUTURE_OCCURRENCES) break;
        const originalKey = toDateKeyUTC(originalDate);
        const exc = excByOriginal.get(originalKey);
        if (!exc) {
            slots.push({ dateKey: originalKey, startTime: rule.start_time.slice(0, 5) });
            continue;
        }
        if (exc.kind === "canceled" || exc.kind === "completed" || exc.kind === "no_show") {
            continue;
        }
        if (exc.kind === "rescheduled") {
            slots.push({
                dateKey: exc.new_date ?? originalKey,
                startTime: (exc.new_start_time ?? rule.start_time).slice(0, 5),
            });
        }
    }

    const newIds: string[] = [];
    for (const slot of slots) {
        const id = await scheduleForOccurrence({
            ruleId,
            studentName,
            dateKey: slot.dateKey,
            startTime: slot.startTime,
            minutesBefore,
        });
        if (id) newIds.push(id);
    }

    setReminderIds(ruleId, newIds);
}

/** Cancel all pushes for a rule (used on cancelSeries). */
export async function cancelRuleReminders(ruleId: string): Promise<void> {
    if (Platform.OS === "web") return;
    await cancelStoredRemindersForRule(ruleId);
}

/**
 * Sync everything tracked locally: re-runs scheduling for each rule still
 * present in the MMKV map. Useful on app launch + when minutesBefore changes.
 */
export async function syncAllRuleReminders(
    minutesBefore: AppointmentReminderMinutes,
): Promise<void> {
    if (Platform.OS === "web") return;
    const ids = getAllRuleIds();
    for (const ruleId of ids) {
        await rescheduleRuleReminders(ruleId, minutesBefore);
    }
}

/**
 * React hook exposing the orchestration to UI code (sheets call these after
 * mutations succeed). All methods are no-ops without trainer/permission.
 */
export function useScheduleAppointmentReminder() {
    const { trainerId } = useRoleMode();

    const getMinutes = useCallback(async (): Promise<{
        enabled: boolean;
        minutes: AppointmentReminderMinutes;
    }> => {
        if (!trainerId) {
            return { enabled: false, minutes: APPOINTMENT_REMINDER_DEFAULT };
        }
        const prefs = await fetchAppointmentReminderPrefs(trainerId);
        return {
            enabled: prefs.appointmentRemindersEnabled,
            minutes: prefs.appointmentReminderMinutes,
        };
    }, [trainerId]);

    /** Call after createAppointment / updateRecurring (whole series). */
    const scheduleForRule = useCallback(
        async (ruleId: string) => {
            const { enabled, minutes } = await getMinutes();
            if (!enabled) {
                await cancelStoredRemindersForRule(ruleId);
                return;
            }
            await rescheduleRuleReminders(ruleId, minutes);
        },
        [getMinutes],
    );

    /** Call after cancelSeries. */
    const cancelForRule = useCallback(async (ruleId: string) => {
        await cancelRuleReminders(ruleId);
    }, []);

    /**
     * Call after only_this mutations (cancelOccurrence / rescheduleOccurrence).
     * Re-runs the full scheduling for the rule — simpler than tracking
     * occurrence-level ids and matches the cap-of-12 invariant.
     */
    const refreshForRule = useCallback(
        async (ruleId: string) => {
            const { enabled, minutes } = await getMinutes();
            if (!enabled) {
                await cancelStoredRemindersForRule(ruleId);
                return;
            }
            await rescheduleRuleReminders(ruleId, minutes);
        },
        [getMinutes],
    );

    return {
        getReminderPermissionStatus,
        requestReminderPermission,
        scheduleForRule,
        cancelForRule,
        refreshForRule,
    };
}
