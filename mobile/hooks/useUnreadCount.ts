import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export interface UnreadCounts {
    messages: number;
    notifications: number;
    total: number;
}

/**
 * Returns unread counts for messages and inbox items (individually + total).
 * Subscribes to Realtime for live updates. Used for tab badge + segmented control badges.
 */
export function useUnreadCount(): UnreadCounts {
    const { user } = useAuth();
    const [studentId, setStudentId] = useState<string | null>(null);
    const [messages, setMessages] = useState(0);
    const [notifications, setNotifications] = useState(0);

    // Resolve student table ID from auth UID
    useEffect(() => {
        if (!user) {
            setStudentId(null);
            setMessages(0);
            setNotifications(0);
            return;
        }

        (async () => {
            const { data }: { data: any } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .maybeSingle();

            if (data?.id) setStudentId(data.id);
        })();
    }, [user]);

    const fetchCount = useCallback(async () => {
        if (!studentId) return;

        try {
            // Unread messages from trainer
            const { count: msgCount, error: msgError } = await (supabase as any)
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("student_id", studentId)
                .eq("sender_type", "trainer")
                .is("read_at", null);

            // Unread inbox items (forms, feedback, etc)
            const { count: inboxCount, error: inboxError } = await (supabase as any)
                .from("student_inbox_items")
                .select("id", { count: "exact", head: true })
                .eq("student_id", studentId)
                .is("read_at", null)
                .in("status", ["unread", "pending_action"]);

            if (!msgError) setMessages(msgCount || 0);
            if (!inboxError) setNotifications(inboxCount || 0);
        } catch (err: any) {
            if (__DEV__) console.error("[useUnreadCount] error:", err);
        }
    }, [studentId]);

    useEffect(() => {
        fetchCount();
    }, [fetchCount]);

    // Realtime: messages
    useEffect(() => {
        if (!studentId) return;

        const channel = supabase
            .channel(`unread-messages-badge-${studentId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "messages",
                    filter: `student_id=eq.${studentId}`,
                },
                () => fetchCount(),
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [studentId, fetchCount]);

    // Realtime: inbox items
    useEffect(() => {
        if (!studentId) return;

        const channel = supabase
            .channel(`unread-inbox-badge-${studentId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "student_inbox_items",
                    filter: `student_id=eq.${studentId}`,
                },
                () => fetchCount(),
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [studentId, fetchCount]);

    return { messages, notifications, total: messages + notifications };
}
