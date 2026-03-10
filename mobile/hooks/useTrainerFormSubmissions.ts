import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface FormSubmission {
    id: string;
    student_id: string;
    student_name: string;
    student_avatar: string | null;
    template_id: string;
    template_title: string;
    template_category: string;
    status: "submitted" | "reviewed";
    submitted_at: string;
    feedback_sent_at: string | null;
    created_at: string;
}

export type SubmissionFilter = "all" | "pending" | "completed";

export function useTrainerFormSubmissions() {
    const { trainerId } = useRoleMode();
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<SubmissionFilter>("all");

    const fetchSubmissions = useCallback(async () => {
        if (!trainerId) return;

        try {
            const { data, error: rpcError } = await supabase.rpc("get_trainer_form_submissions" as any);
            if (rpcError) throw new Error(rpcError.message);
            setSubmissions((data || []) as FormSubmission[]);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useTrainerFormSubmissions] fetch error:", err);
            setError(err.message);
        }
    }, [trainerId]);

    useEffect(() => {
        if (!trainerId) return;

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchSubmissions();
            if (mounted) setIsLoading(false);
        })();

        return () => { mounted = false; };
    }, [trainerId, fetchSubmissions]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchSubmissions();
        setIsRefreshing(false);
    }, [fetchSubmissions]);

    const filteredSubmissions = useMemo(() => {
        switch (filter) {
            case "pending":
                return submissions.filter((s) => !s.feedback_sent_at);
            case "completed":
                return submissions.filter((s) => !!s.feedback_sent_at);
            default:
                return submissions;
        }
    }, [submissions, filter]);

    const counts = useMemo(() => ({
        all: submissions.length,
        pending: submissions.filter((s) => !s.feedback_sent_at).length,
        completed: submissions.filter((s) => !!s.feedback_sent_at).length,
    }), [submissions]);

    return {
        submissions: filteredSubmissions,
        counts,
        isLoading,
        isRefreshing,
        error,
        filter,
        setFilter,
        refresh,
    };
}
