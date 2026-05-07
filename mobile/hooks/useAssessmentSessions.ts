import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type {
    AssessmentSessionListItem,
    AssessmentSessionStatus,
} from "@kinevo/shared/types/assessments";
import { useAssessmentDraftStore, type AssessmentDraft } from "../stores/assessmentDraftStore";

export type SessionsFilter = "all" | "overdue" | "upcoming" | "completed";

export interface UseAssessmentSessionsOptions {
    studentId?: string;
    /** Optional pre-filter applied at the RPC level. UI filtering uses
     *  `filteredSessions` derived from `filter`. */
    status?: AssessmentSessionStatus;
    limit?: number;
}

const OVERDUE_DAYS = 7;

/**
 * Lists assessment sessions for the current trainer. Adds:
 *   - `filter` for the four chips on the Presenciais tab
 *   - `drafts` from the local store (for the pinned "in progress" section)
 *   - convenient counts for the FilterChips
 */
export function useAssessmentSessions(options: UseAssessmentSessionsOptions = {}) {
    const { trainerId } = useRoleMode();
    const { studentId, status, limit = 50 } = options;

    const [sessions, setSessions] = useState<AssessmentSessionListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<SessionsFilter>("all");

    const drafts = useAssessmentDraftStore((s) => s.drafts);

    const fetchSessions = useCallback(async () => {
        if (!trainerId) return;
        try {
            const { data, error: rpcError } = await supabase.rpc(
                "get_assessment_sessions" as never,
                {
                    p_student_id: studentId ?? null,
                    p_status: status ?? null,
                    p_limit: limit,
                } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            const fresh = ((data as unknown) as AssessmentSessionListItem[]) ?? [];
            setSessions(fresh);
            setError(null);

            // Self-healing cleanup: any local draft whose server status is
            // terminal (completed/cancelled) is purged here, post-fetch.
            // Done outside React's render cycle (no useEffect deps to
            // mismanage) and using getState() so we don't add the store
            // ref to fetchSessions deps.
            const store = useAssessmentDraftStore.getState();
            for (const s of fresh) {
                if (
                    (s.status === 'completed' || s.status === 'cancelled')
                    && store.drafts[s.id]
                ) {
                    store.removeDraft(s.id);
                }
            }
        } catch (err: any) {
            if (__DEV__) console.error("[useAssessmentSessions] fetch error:", err);
            setError(err?.message ?? "Erro ao buscar sessões");
        }
    }, [trainerId, studentId, status, limit]);

    useEffect(() => {
        if (!trainerId) return;
        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchSessions();
            if (mounted) setIsLoading(false);
        })();
        return () => { mounted = false; };
    }, [trainerId, fetchSessions]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchSessions();
        setIsRefreshing(false);
    }, [fetchSessions]);

    const filteredSessions = useMemo(() => filterSessions(sessions, filter), [sessions, filter]);

    const counts = useMemo(() => ({
        all: sessions.length,
        overdue: filterSessions(sessions, "overdue").length,
        upcoming: filterSessions(sessions, "upcoming").length,
        completed: filterSessions(sessions, "completed").length,
    }), [sessions]);

    /** Stable serialized key of the terminal session ids — primitive so
     *  downstream memo deps don't churn on every Set identity change. */
    const terminalIdsKey = useMemo(() => {
        const ids: string[] = [];
        for (const s of sessions) {
            if (s.status === 'completed' || s.status === 'cancelled') ids.push(s.id);
        }
        ids.sort();
        return ids.join('|');
    }, [sessions]);

    /** Drafts ordered by recency (most recent activity first), used by the
     *  pinned "Em andamento" section in the Presenciais tab. Drafts whose
     *  server-side status is terminal (completed/cancelled) are filtered
     *  out so the user doesn't see ghosts after finalize.
     *
     *  Active store cleanup happens inside `fetchSessions` (post-RPC) using
     *  `getState()` — that path doesn't risk a render-time effect loop.
     *  Here we only filter for the synchronous render. */
    const inProgressDrafts = useMemo<AssessmentDraft[]>(() => {
        const terminal = new Set(terminalIdsKey ? terminalIdsKey.split('|') : []);
        return Object.values(drafts)
            .filter((d) => !terminal.has(d.session_id))
            .sort((a, b) => Date.parse(b.last_touched_at) - Date.parse(a.last_touched_at));
    }, [drafts, terminalIdsKey]);

    return {
        sessions: filteredSessions,
        rawSessions: sessions,
        inProgressDrafts,
        counts,
        filter,
        setFilter,
        isLoading,
        isRefreshing,
        error,
        refresh,
    };
}

function filterSessions(
    sessions: AssessmentSessionListItem[],
    filter: SessionsFilter,
): AssessmentSessionListItem[] {
    if (filter === "all") return sessions;
    const now = Date.now();
    const overdueCutoff = now - OVERDUE_DAYS * 24 * 60 * 60 * 1000;

    return sessions.filter((s) => {
        if (filter === "completed") return s.status === "completed";
        if (filter === "overdue") {
            if (s.status === "completed" || s.status === "cancelled") return false;
            const ref = s.scheduled_at ? Date.parse(s.scheduled_at) : null;
            return ref !== null && ref < overdueCutoff;
        }
        if (filter === "upcoming") {
            if (s.status === "completed" || s.status === "cancelled") return false;
            const ref = s.scheduled_at ? Date.parse(s.scheduled_at) : null;
            return ref === null || ref >= overdueCutoff;
        }
        return true;
    });
}
