import { useCallback, useEffect, useState } from "react";
import { EventEmitter } from "events";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export interface UnreadCounts {
    messages: number;
    notifications: number;
    total: number;
}

// ── Shared module-level state ──
// All hook instances read from / write to the same state.
// An EventEmitter notifies all instances when the counts change.

const emitter = new EventEmitter();
const CHANGE_EVENT = "unread-change";

let sharedState = { messages: 0, notifications: 0 };
let initialized = false;
let activeStudentId: string | null = null;

function setSharedState(next: { messages?: number; notifications?: number }) {
    let changed = false;
    if (next.messages !== undefined && next.messages !== sharedState.messages) {
        sharedState = { ...sharedState, messages: Math.max(0, next.messages) };
        changed = true;
    }
    if (next.notifications !== undefined && next.notifications !== sharedState.notifications) {
        sharedState = { ...sharedState, notifications: Math.max(0, next.notifications) };
        changed = true;
    }
    if (changed) emitter.emit(CHANGE_EVENT);
}

/** Decrement messages count. Safe to call from anywhere (useTrainerChat, etc). */
export function decrementUnreadMessages(by: number) {
    setSharedState({ messages: sharedState.messages - by });
}

/** Decrement notifications count. Safe to call from anywhere (useInbox, etc). */
export function decrementUnreadNotifications(by: number) {
    setSharedState({ notifications: sharedState.notifications - by });
}

// ── Fetch function (reusable) ──

async function fetchCounts(studentId: string) {
    try {
        const [msgResult, inboxResult] = await Promise.all([
            (supabase as any)
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("student_id", studentId)
                .eq("sender_type", "trainer")
                .is("read_at", null),
            (supabase as any)
                .from("student_inbox_items")
                .select("id", { count: "exact", head: true })
                .eq("student_id", studentId)
                .is("read_at", null)
                .in("status", ["unread", "pending_action"]),
        ]);

        setSharedState({
            messages: msgResult.error ? sharedState.messages : (msgResult.count || 0),
            notifications: inboxResult.error ? sharedState.notifications : (inboxResult.count || 0),
        });
    } catch (err: any) {
        if (__DEV__) console.error("[useUnreadCount] error:", err);
    }
}

/** Force a full refetch of counts from DB. Call from focus events, etc. */
export function refetchUnreadCounts() {
    if (activeStudentId) fetchCounts(activeStudentId);
}

/**
 * Returns unread counts for messages and inbox items (individually + total).
 * All hook instances share the same underlying state.
 * Subscribes to Realtime for live updates (INSERT only — decrements are optimistic).
 */
export function useUnreadCount(): UnreadCounts {
    const { user } = useAuth();
    const [, forceRender] = useState(0);

    // Subscribe to shared state changes
    useEffect(() => {
        const handler = () => forceRender((n) => n + 1);
        emitter.on(CHANGE_EVENT, handler);
        return () => { emitter.off(CHANGE_EVENT, handler); };
    }, []);

    // Resolve student ID + initial fetch + Realtime (only once across all instances)
    useEffect(() => {
        if (!user) {
            activeStudentId = null;
            initialized = false;
            setSharedState({ messages: 0, notifications: 0 });
            return;
        }

        // If already initialized for this user, skip
        if (initialized && activeStudentId) return;

        let cancelled = false;

        (async () => {
            const { data }: { data: any } = await supabase
                .from("students" as any)
                .select("id")
                .eq("auth_user_id", user.id)
                .maybeSingle();

            if (cancelled || !data?.id) return;

            activeStudentId = data.id;
            initialized = true;

            await fetchCounts(data.id);

            // Realtime: messages INSERT (new trainer message → increment)
            const msgChannel = supabase
                .channel(`unread-msg-${data.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "messages",
                        filter: `student_id=eq.${data.id}`,
                    },
                    (payload) => {
                        const newMsg = payload.new as any;
                        if (newMsg.sender_type === "trainer") {
                            setSharedState({ messages: sharedState.messages + 1 });
                        }
                    },
                )
                .subscribe();

            // Realtime: inbox INSERT (new notification → increment)
            const inboxChannel = supabase
                .channel(`unread-inbox-${data.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "student_inbox_items",
                        filter: `student_id=eq.${data.id}`,
                    },
                    () => {
                        setSharedState({ notifications: sharedState.notifications + 1 });
                    },
                )
                .subscribe();

            // Cleanup stored for unmount
            cleanupRef = () => {
                supabase.removeChannel(msgChannel);
                supabase.removeChannel(inboxChannel);
            };
        })();

        return () => {
            cancelled = true;
        };
    }, [user]);

    return {
        messages: sharedState.messages,
        notifications: sharedState.notifications,
        total: sharedState.messages + sharedState.notifications,
    };
}

// Store cleanup for Realtime channels
let cleanupRef: (() => void) | null = null;

// Export for testing
export function _resetForTests() {
    sharedState = { messages: 0, notifications: 0 };
    initialized = false;
    activeStudentId = null;
    if (cleanupRef) cleanupRef();
    cleanupRef = null;
}
