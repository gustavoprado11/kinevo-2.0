import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { decrementUnreadNotifications } from "./useUnreadCount";

export type InboxItemType = "form_request" | "feedback" | "system_alert" | "text_message";
export type InboxItemStatus = "unread" | "pending_action" | "completed" | "archived";

export interface InboxItem {
    id: string;
    type: InboxItemType;
    status: InboxItemStatus;
    title: string;
    subtitle: string | null;
    payload: Record<string, any>;
    due_at: string | null;
    read_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export function useInbox() {
    const { user } = useAuth();
    const [studentId, setStudentId] = useState<string | null>(null);
    const [items, setItems] = useState<InboxItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const studentIdRef = useRef<string | null>(null);

    // Resolve student table ID from auth UID (one-time lookup)
    useEffect(() => {
        if (!user) {
            setStudentId(null);
            studentIdRef.current = null;
            return;
        }

        (async () => {
            const { data }: { data: any; error: any } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .single();

            if (data?.id) {
                setStudentId(data.id);
                studentIdRef.current = data.id;
            }
        })();
    }, [user]);

    const fetchInbox = useCallback(async () => {
        if (!user || !studentIdRef.current) return;

        const { data, error }: { data: any[] | null; error: any } = await supabase
            .from("student_inbox_items" as any)
            .select("id, type, status, title, subtitle, payload, due_at, read_at, completed_at, created_at, updated_at")
            .eq("student_id", studentIdRef.current)
            .order("created_at", { ascending: false });

        if (error) {
            if (__DEV__) console.error("[useInbox] fetch error:", error);
            return;
        }

        setItems((data || []) as InboxItem[]);
    }, [user]);

    useEffect(() => {
        let mounted = true;
        if (!user || !studentId) {
            if (!user) {
                setItems([]);
                setIsLoading(false);
            }
            return;
        }

        (async () => {
            setIsLoading(true);
            await fetchInbox();
            if (mounted) setIsLoading(false);
        })();

        const channel = supabase
            .channel(`student_inbox_${studentId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "student_inbox_items",
                    filter: `student_id=eq.${studentId}`,
                },
                () => {
                    fetchInbox();
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [user, studentId, fetchInbox]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchInbox();
        setIsRefreshing(false);
    }, [fetchInbox]);

    const markItemOpened = useCallback(async (item: InboxItem) => {
        let nextStatus: InboxItemStatus = item.status;

        if (item.status === "unread") {
            nextStatus = item.type === "form_request" ? "pending_action" : "completed";
        }

        const patch: Record<string, any> = {
            read_at: item.read_at || new Date().toISOString(),
        };

        if (nextStatus !== item.status) {
            patch.status = nextStatus;
            if (nextStatus === "completed") {
                patch.completed_at = item.completed_at || new Date().toISOString();
            }
        }

        if (!studentIdRef.current) return { success: false, error: "Student not resolved" };

        // Optimistically decrement the shared badge count
        if (item.status === "unread" && !item.read_at) {
            decrementUnreadNotifications(1);
        }

        const { error } = await supabase
            .from("student_inbox_items" as any)
            .update(patch)
            .eq("id", item.id)
            .eq("student_id", studentIdRef.current);

        if (error) {
            if (__DEV__) console.error("[useInbox] markItemOpened error:", error);
            return { success: false, error: error.message };
        }

        setItems((prev) =>
            prev.map((row) =>
                row.id === item.id
                    ? {
                        ...row,
                        ...patch,
                    }
                    : row
            )
        );

        return { success: true };
    }, []);

    const pendingItems = useMemo(
        () => items.filter((item) => item.status === "unread" || item.status === "pending_action"),
        [items]
    );

    const completedItems = useMemo(
        () => items.filter((item) => item.status === "completed"),
        [items]
    );

    const unreadCount = useMemo(
        () => items.filter((item) => item.status === "unread").length,
        [items]
    );

    return {
        items,
        pendingItems,
        completedItems,
        unreadCount,
        isLoading,
        isRefreshing,
        refresh,
        markItemOpened,
    };
}

