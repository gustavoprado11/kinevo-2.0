import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

// ── Types ──

export interface TrainerStudent {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: "active" | "inactive" | "pending";
    modality: string | null;
    avatar_url: string | null;
    created_at: string;
    is_trainer_profile: boolean;
    program_name: string | null;
    duration_weeks: number | null;
    program_started_at: string | null;
    last_session_date: string | null;
    sessions_this_week: number;
    expected_per_week: number;
}

export type StudentFilter = "all" | "attention" | "online" | "presencial" | "no_program";

// ── Hook ──

export function useTrainerStudentsList() {
    const { trainerId } = useRoleMode();
    const [students, setStudents] = useState<TrainerStudent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<StudentFilter>("all");

    const fetchStudents = useCallback(async () => {
        if (!trainerId) return;

        try {
            const { data, error: rpcError } = await supabase.rpc("get_trainer_students_list" as any);
            if (rpcError) throw new Error(rpcError.message);
            setStudents((data || []) as TrainerStudent[]);
            setError(null);
        } catch (err: any) {
            console.error("[useTrainerStudentsList] fetch error:", err);
            setError(err.message);
        }
    }, [trainerId]);

    useEffect(() => {
        if (!trainerId) return;

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchStudents();
            if (mounted) setIsLoading(false);
        })();

        return () => { mounted = false; };
    }, [trainerId, fetchStudents]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchStudents();
        setIsRefreshing(false);
    }, [fetchStudents]);

    // Filtered and searched students
    const filteredStudents = useMemo(() => {
        let result = students;

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            result = result.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.email.toLowerCase().includes(q)
            );
        }

        // Category filter
        switch (filter) {
            case "attention": {
                const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
                result = result.filter((s) => {
                    if (s.is_trainer_profile) return false;
                    if (!s.program_name) return false;
                    if (!s.last_session_date) return true;
                    return new Date(s.last_session_date) < fiveDaysAgo;
                });
                break;
            }
            case "online":
                result = result.filter((s) => s.modality === "online");
                break;
            case "presencial":
                result = result.filter((s) => s.modality === "presencial");
                break;
            case "no_program":
                result = result.filter((s) => !s.program_name && !s.is_trainer_profile);
                break;
        }

        return result;
    }, [students, search, filter]);

    const counts = useMemo(() => {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        return {
            all: students.length,
            attention: students.filter((s) => {
                if (s.is_trainer_profile || !s.program_name) return false;
                if (!s.last_session_date) return true;
                return new Date(s.last_session_date) < fiveDaysAgo;
            }).length,
            online: students.filter((s) => s.modality === "online").length,
            presencial: students.filter((s) => s.modality === "presencial").length,
            no_program: students.filter((s) => !s.program_name && !s.is_trainer_profile).length,
        };
    }, [students]);

    return {
        students: filteredStudents,
        counts,
        isLoading,
        isRefreshing,
        error,
        search,
        setSearch,
        filter,
        setFilter,
        refresh,
    };
}
