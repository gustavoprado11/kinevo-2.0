import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

/**
 * Returns the count of form submissions pending feedback (for tab badge).
 * Subscribes to realtime changes on form_submissions table.
 */
export function usePendingSubmissionsCount() {
    const { trainerId } = useRoleMode();
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        if (!trainerId) return;

        try {
            const { count: total, error } = await (supabase as any)
                .from("form_submissions")
                .select("id", { count: "exact", head: true })
                .eq("trainer_id", trainerId)
                .eq("status", "submitted")
                .is("feedback_sent_at", null);

            if (!error && total !== null) {
                setCount(total);
            }
        } catch (err: any) {
            if (__DEV__) console.error("[usePendingSubmissionsCount] error:", err);
        }
    }, [trainerId]);

    useEffect(() => {
        fetchCount();
    }, [fetchCount]);

    // Realtime subscription
    useEffect(() => {
        if (!trainerId) return;

        const channel = supabase
            .channel("pending-submissions-badge")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "form_submissions",
                    filter: `trainer_id=eq.${trainerId}`,
                },
                () => {
                    // Refetch count on any change to form_submissions
                    fetchCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [trainerId, fetchCount]);

    return count;
}
