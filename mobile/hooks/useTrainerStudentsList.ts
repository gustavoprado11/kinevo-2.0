import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import { useDebounce } from "./useDebounce";
import { useCachedQuery } from "./useCachedQuery";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cache-keys";

// ── Types ──

export interface TrainerStudent {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: "active" | "inactive" | "pending" | "archived";
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
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [filter, setFilter] = useState<StudentFilter>("all");

    const fetcher = useCallback(async (): Promise<TrainerStudent[]> => {
        const { data, error } = await supabase.rpc("get_trainer_students_list" as any);
        if (error) throw new Error(error.message);
        // TODO: mover filtro pro RPC quando houver tela de restaurados.
        const all = (data || []) as TrainerStudent[];
        return all.filter((s) => s.status !== "archived");
    }, [trainerId]);

    const { data: students, isLoading, isRefreshing, error, refresh } = useCachedQuery<TrainerStudent[]>({
        cacheKey: CACHE_KEYS.STUDENTS_LIST,
        fetcher,
        ttl: CACHE_TTL.STUDENTS_LIST,
        enabled: !!trainerId,
    });

    const allStudents = students ?? [];

    // Filtered and searched students
    const filteredStudents = useMemo(() => {
        let result = allStudents;

        // Search filter (uses debounced value)
        if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase().trim();
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
    }, [allStudents, debouncedSearch, filter]);

    const counts = useMemo(() => {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        return {
            all: allStudents.length,
            attention: allStudents.filter((s) => {
                if (s.is_trainer_profile || !s.program_name) return false;
                if (!s.last_session_date) return true;
                return new Date(s.last_session_date) < fiveDaysAgo;
            }).length,
            online: allStudents.filter((s) => s.modality === "online").length,
            presencial: allStudents.filter((s) => s.modality === "presencial").length,
            no_program: allStudents.filter((s) => !s.program_name && !s.is_trainer_profile).length,
        };
    }, [allStudents]);

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
