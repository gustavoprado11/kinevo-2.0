import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface SubmissionDetail {
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
    trainer_feedback: { message?: string; text?: string } | null;
    answers_json: { answers: Record<string, any> } | null;
    schema_snapshot_json: { questions: SchemaQuestion[] } | null;
    created_at: string;
}

export interface SchemaQuestion {
    id: string;
    type: "short_text" | "long_text" | "single_choice" | "scale" | "photo";
    label: string;
    required?: boolean;
    options?: { label: string; value: string }[];
    scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
}

export function useTrainerFormSubmissionDetail(submissionId: string | null) {
    const { trainerId } = useRoleMode();
    const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!trainerId || !submissionId) return;

        setIsLoading(true);
        try {
            const { data, error: rpcError } = await supabase.rpc(
                "get_form_submission_detail" as any,
                { p_submission_id: submissionId }
            );
            if (rpcError) throw new Error(rpcError.message);
            setSubmission(data as SubmissionDetail);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useTrainerFormSubmissionDetail] fetch error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [trainerId, submissionId]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { submission, isLoading, error, refetch: fetch };
}
