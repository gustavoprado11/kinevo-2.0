import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export type AppointmentReminderMinutes = 15 | 30 | 60;

export const APPOINTMENT_REMINDER_DEFAULT: AppointmentReminderMinutes = 30;

export interface TrainerAppointmentPrefs {
    /** Whether the trainer wants to receive appointment reminders. Default true. */
    appointmentRemindersEnabled: boolean;
    /** How many minutes before each appointment to fire the local push. */
    appointmentReminderMinutes: AppointmentReminderMinutes;
}

interface UseTrainerNotificationPreferencesReturn extends TrainerAppointmentPrefs {
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    setAppointmentRemindersEnabled: (enabled: boolean) => Promise<void>;
    setAppointmentReminderMinutes: (minutes: AppointmentReminderMinutes) => Promise<void>;
    refresh: () => Promise<void>;
}

const VALID_MINUTES: AppointmentReminderMinutes[] = [15, 30, 60];

function coerceMinutes(value: unknown): AppointmentReminderMinutes {
    const n = typeof value === "number" ? value : Number(value);
    if (VALID_MINUTES.includes(n as AppointmentReminderMinutes)) {
        return n as AppointmentReminderMinutes;
    }
    return APPOINTMENT_REMINDER_DEFAULT;
}

/**
 * Read/write trainer notification preferences focused on appointment reminders.
 * Stored in `trainers.notification_preferences` JSONB. Other keys (workout_completed,
 * payment_received, ...) are preserved on write.
 */
export function useTrainerNotificationPreferences(): UseTrainerNotificationPreferencesReturn {
    const { trainerId } = useRoleMode();
    const [enabled, setEnabled] = useState<boolean>(true);
    const [minutes, setMinutes] = useState<AppointmentReminderMinutes>(APPOINTMENT_REMINDER_DEFAULT);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchPrefs = useCallback(async () => {
        if (!trainerId) return;
        setError(null);
        const { data, error: queryError } = await supabase
            .from("trainers")
            .select("notification_preferences")
            .eq("id", trainerId)
            .single();
        if (queryError) {
            if (__DEV__) console.error("[useTrainerNotificationPreferences] fetch", queryError);
            if (mountedRef.current) setError(queryError.message);
            return;
        }
        const prefs = (data?.notification_preferences ?? {}) as Record<string, unknown>;
        const parsedEnabled =
            typeof prefs.appointment_reminders_enabled === "boolean"
                ? prefs.appointment_reminders_enabled
                : true;
        const parsedMinutes = coerceMinutes(prefs.appointment_reminder_minutes);
        if (!mountedRef.current) return;
        setEnabled(parsedEnabled);
        setMinutes(parsedMinutes);
    }, [trainerId]);

    useEffect(() => {
        if (!trainerId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        fetchPrefs().finally(() => {
            if (mountedRef.current) setIsLoading(false);
        });
    }, [trainerId, fetchPrefs]);

    const updatePrefs = useCallback(
        async (patch: Record<string, unknown>) => {
            if (!trainerId) return;
            setIsSaving(true);
            setError(null);

            // Read-modify-write to avoid clobbering other keys.
            const { data, error: readErr } = await supabase
                .from("trainers")
                .select("notification_preferences")
                .eq("id", trainerId)
                .single();
            if (readErr) {
                if (mountedRef.current) {
                    setError(readErr.message);
                    setIsSaving(false);
                }
                return;
            }
            const current = (data?.notification_preferences ?? {}) as Record<string, unknown>;
            const next = { ...current, ...patch };

            const { error: writeErr } = await supabase
                .from("trainers")
                .update({ notification_preferences: next as never })
                .eq("id", trainerId);
            if (writeErr) {
                if (mountedRef.current) {
                    setError(writeErr.message);
                    setIsSaving(false);
                }
                return;
            }
            if (mountedRef.current) setIsSaving(false);
        },
        [trainerId],
    );

    const setAppointmentRemindersEnabled = useCallback(
        async (next: boolean) => {
            setEnabled(next);
            await updatePrefs({ appointment_reminders_enabled: next });
        },
        [updatePrefs],
    );

    const setAppointmentReminderMinutes = useCallback(
        async (next: AppointmentReminderMinutes) => {
            setMinutes(next);
            await updatePrefs({ appointment_reminder_minutes: next });
        },
        [updatePrefs],
    );

    return {
        appointmentRemindersEnabled: enabled,
        appointmentReminderMinutes: minutes,
        isLoading,
        isSaving,
        error,
        setAppointmentRemindersEnabled,
        setAppointmentReminderMinutes,
        refresh: fetchPrefs,
    };
}

/**
 * Read-only helper for non-React contexts (e.g. mutation flows) that just need
 * the current minutes preference once. Falls back to default on any error.
 */
export async function fetchAppointmentReminderPrefs(
    trainerId: string,
): Promise<TrainerAppointmentPrefs> {
    try {
        const { data, error } = await supabase
            .from("trainers")
            .select("notification_preferences")
            .eq("id", trainerId)
            .single();
        if (error || !data) {
            return {
                appointmentRemindersEnabled: true,
                appointmentReminderMinutes: APPOINTMENT_REMINDER_DEFAULT,
            };
        }
        const prefs = (data.notification_preferences ?? {}) as Record<string, unknown>;
        return {
            appointmentRemindersEnabled:
                typeof prefs.appointment_reminders_enabled === "boolean"
                    ? prefs.appointment_reminders_enabled
                    : true,
            appointmentReminderMinutes: coerceMinutes(prefs.appointment_reminder_minutes),
        };
    } catch {
        return {
            appointmentRemindersEnabled: true,
            appointmentReminderMinutes: APPOINTMENT_REMINDER_DEFAULT,
        };
    }
}
