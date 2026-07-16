import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import { expandAppointments } from "@kinevo/shared/utils/appointments-projection";
import type {
    AppointmentException,
    AppointmentFrequency,
    AppointmentOccurrence,
    RecurringAppointment,
} from "@kinevo/shared/types/appointments";

export interface AgendaStudentLite {
    id: string;
    name: string;
    avatar_url: string | null;
}

export interface AgendaOccurrence extends AppointmentOccurrence {
    student: AgendaStudentLite | null;
    frequency: AppointmentFrequency;
}

interface UseAgendaOccurrencesArgs {
    rangeStart: Date;
    rangeEnd: Date;
    /** Estúdios: 'me' (default, fluxo original) | 'all' | trainerId de um coach. */
    scope?: string;
}

interface UseAgendaOccurrencesReturn {
    occurrences: AgendaOccurrence[];
    students: Map<string, AgendaStudentLite>;
    /** Estúdios: coaches ativos do estúdio (vazio p/ solo) — alimenta o filtro. */
    studioCoaches: { id: string; name: string }[];
    isLoading: boolean;
    isRefreshing: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

function toDateKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Mobile-side projection of recurring_appointments + appointment_exceptions
 * within [rangeStart, rangeEnd]. Mirrors web `listAppointmentsInRange` action.
 *
 * RLS scopes rows to the authenticated trainer; we still pass trainer_id to
 * narrow indexes.
 */
export function useAgendaOccurrences({
    rangeStart,
    rangeEnd,
    scope = "me",
}: UseAgendaOccurrencesArgs): UseAgendaOccurrencesReturn {
    const { trainerId } = useRoleMode();
    const [occurrences, setOccurrences] = useState<AgendaOccurrence[]>([]);
    const [students, setStudents] = useState<Map<string, AgendaStudentLite>>(
        new Map(),
    );
    const [studioCoaches, setStudioCoaches] = useState<{ id: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);
    // MB8: navegar vários dias em sequência dispara fetches concorrentes — uma
    // resposta ANTIGA (janela de outro dia) podia resolver por último e
    // sobrescrever a atual. Só a resposta do fetch mais recente aplica estado.
    const requestSeqRef = useRef(0);

    const rangeStartKey = useMemo(() => toDateKey(rangeStart), [rangeStart]);
    const rangeEndKey = useMemo(() => toDateKey(rangeEnd), [rangeEnd]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchData = useCallback(async () => {
        if (!trainerId) return;
        const seq = ++requestSeqRef.current;

        // Estúdios: visão da equipe via RPC (RLS de recurring_appointments é
        // por-trainer). A projeção continua client-side (mesma engine).
        if (scope !== "me") {
            const { data: payload, error: orgError } = await (supabase as any).rpc(
                "get_studio_agenda_data",
                { p_start: rangeStartKey, p_end: rangeEndKey },
            );
            if (orgError) throw new Error(orgError.message);
            if (!payload) throw new Error("Você não pertence a um estúdio");

            const allRules = (payload.rules ?? []) as RecurringAppointment[];
            const rules = scope === "all" ? allRules : allRules.filter((r) => r.trainer_id === scope);
            const exceptions = (payload.exceptions ?? []) as AppointmentException[];
            const coachName = new Map<string, string>(
                ((payload.coaches ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
            );
            const studentNameById = new Map<string, string>(
                ((payload.students ?? []) as { id: string; name: string }[]).map((st) => [st.id, st.name]),
            );

            const expanded = expandAppointments(rules, exceptions, rangeStart, rangeEnd);
            const ruleFrequencyById = new Map<string, AppointmentFrequency>();
            for (const r of rules) ruleFrequencyById.set(r.id, r.frequency);

            const studentMap = new Map<string, AgendaStudentLite>();
            const enriched: AgendaOccurrence[] = expanded.map((o) => {
                const base = studentNameById.get(o.studentId) ?? "Aluno";
                const suffix = o.trainerId === trainerId ? "" : ` · ${(coachName.get(o.trainerId) ?? "").split(" ")[0]}`;
                const lite = { id: o.studentId, name: `${base}${suffix}`, avatar_url: null };
                studentMap.set(o.studentId, lite);
                return {
                    ...o,
                    student: lite,
                    frequency: ruleFrequencyById.get(o.recurringAppointmentId) ?? "weekly",
                };
            });

            if (!mountedRef.current || seq !== requestSeqRef.current) return;
            setOccurrences(enriched);
            setStudents(studentMap);
            setStudioCoaches(
                ((payload.coaches ?? []) as { id: string; name: string }[])
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
            );
            setError(null);
            return;
        }

        const { data: rulesRows, error: rulesError } = await supabase
            .from("recurring_appointments")
            .select("*")
            .eq("trainer_id", trainerId)
            .eq("status", "active")
            .lte("starts_on", rangeEndKey)
            .or(`ends_on.is.null,ends_on.gte.${rangeStartKey}`);

        if (rulesError) {
            throw new Error(rulesError.message);
        }

        const rules = (rulesRows ?? []) as unknown as RecurringAppointment[];
        const ruleIds = rules.map((r) => r.id);

        let exceptions: AppointmentException[] = [];
        if (ruleIds.length > 0) {
            const { data: excRows, error: excError } = await supabase
                .from("appointment_exceptions")
                .select("*")
                .eq("trainer_id", trainerId)
                .in("recurring_appointment_id", ruleIds)
                .or(
                    `and(occurrence_date.gte.${rangeStartKey},occurrence_date.lte.${rangeEndKey}),and(new_date.gte.${rangeStartKey},new_date.lte.${rangeEndKey})`,
                );
            if (excError) throw new Error(excError.message);
            exceptions = (excRows ?? []) as unknown as AppointmentException[];
        }

        const expanded = expandAppointments(
            rules,
            exceptions,
            rangeStart,
            rangeEnd,
        );

        // Resolve student profiles in a single query.
        const studentIds = Array.from(new Set(expanded.map((o) => o.studentId)));
        const studentMap = new Map<string, AgendaStudentLite>();
        if (studentIds.length > 0) {
            const { data: studentRows, error: studentsError } = await supabase
                .from("students")
                .select("id, name, avatar_url")
                .in("id", studentIds);
            if (studentsError) throw new Error(studentsError.message);
            for (const s of studentRows ?? []) {
                studentMap.set(s.id, {
                    id: s.id,
                    name: s.name,
                    avatar_url: s.avatar_url ?? null,
                });
            }
        }

        const ruleFrequencyById = new Map<string, AppointmentFrequency>();
        for (const r of rules) {
            ruleFrequencyById.set(r.id, r.frequency);
        }

        const enriched: AgendaOccurrence[] = expanded.map((o) => ({
            ...o,
            student: studentMap.get(o.studentId) ?? null,
            frequency: ruleFrequencyById.get(o.recurringAppointmentId) ?? "weekly",
        }));

        if (!mountedRef.current || seq !== requestSeqRef.current) return;
        setOccurrences(enriched);
        setStudents(studentMap);
        setError(null);
    }, [trainerId, scope, rangeStart, rangeEnd, rangeStartKey, rangeEndKey]);

    useEffect(() => {
        if (!trainerId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        fetchData()
            .catch((err) => {
                if (!mountedRef.current) return;
                const msg = err instanceof Error ? err.message : "Erro ao carregar agenda";
                setError(msg);
                if (__DEV__) console.error("[useAgendaOccurrences]", err);
            })
            .finally(() => {
                if (mountedRef.current) setIsLoading(false);
            });
    }, [fetchData, trainerId]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await fetchData();
        } catch (err) {
            if (!mountedRef.current) return;
            const msg = err instanceof Error ? err.message : "Erro ao carregar agenda";
            setError(msg);
        } finally {
            if (mountedRef.current) setIsRefreshing(false);
        }
    }, [fetchData]);

    return { occurrences, students, studioCoaches, isLoading, isRefreshing, error, refresh };
}
