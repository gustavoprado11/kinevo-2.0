import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * Edge Function: send-push-notification
 *
 * Triggered by a Database Webhook on trainer_notifications INSERT.
 * Sends an Expo push notification to the trainer's registered devices immediately.
 *
 * Also handles student_inbox_items INSERT when the payload contains table = "student_inbox_items".
 */
Deno.serve(async (req) => {
    try {
        const payload = await req.json();

        // Database webhook sends: { type: "INSERT", table, record, ... }
        const table = payload.table as string;
        const record = payload.record;

        if (!record) {
            return new Response(JSON.stringify({ error: "No record in payload" }), { status: 400 });
        }

        if (table === "trainer_notifications") {
            await handleTrainerNotification(record);
        } else if (table === "student_inbox_items") {
            await handleStudentNotification(record);
        } else {
            return new Response(JSON.stringify({ error: `Unknown table: ${table}` }), { status: 400 });
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[send-push-notification] Error:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});

// ── Trainer Push ──

async function handleTrainerNotification(record: Record<string, any>) {
    const trainerId = record.trainer_id;
    const notificationId = record.id;
    const type = record.type ?? "unknown";
    const title = record.title ?? "Notificação";
    const body = record.body ?? record.message ?? "";
    const data = record.data ?? record.metadata ?? {};

    // 0. Check if push was already sent (avoid double-send from API routes)
    const { data: existingNotif } = await supabaseAdmin
        .from("trainer_notifications")
        .select("push_sent_at")
        .eq("id", notificationId)
        .single();

    if (existingNotif?.push_sent_at) return;

    // 1. Check trainer notification preferences
    const { data: trainer } = await supabaseAdmin
        .from("trainers")
        .select("notification_preferences")
        .eq("id", trainerId)
        .single();

    if (!trainer) return;

    const prefs = (trainer.notification_preferences ?? {}) as Record<string, boolean>;
    if (prefs[type] === false) return;

    // 2. Get active push tokens
    const { data: tokens } = await supabaseAdmin
        .from("push_tokens")
        .select("id, expo_push_token")
        .eq("trainer_id", trainerId)
        .eq("role", "trainer")
        .eq("active", true);

    if (!tokens || tokens.length === 0) return;

    // 3. Send via Expo Push API
    const messages = tokens.map((t: any) => ({
        to: t.expo_push_token,
        sound: "default",
        title,
        body,
        data: {
            notificationId,
            type,
            ...data,
        },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
    });

    if (!response.ok) {
        console.error("[send-push] Expo API error:", response.status);
        return;
    }

    const result = await response.json();
    const tickets = result.data ?? [];

    // 4. Handle DeviceNotRegistered
    for (let i = 0; i < tickets.length; i++) {
        if (tickets[i].status === "error" && tickets[i].details?.error === "DeviceNotRegistered") {
            await supabaseAdmin
                .from("push_tokens")
                .update({ active: false, updated_at: new Date().toISOString() })
                .eq("id", tokens[i].id);
        }
    }

    // 5. Save tickets for receipt checking
    const ticketRows = tickets
        .map((ticket: any, i: number) => {
            if (ticket.status === "ok" && ticket.id) {
                return {
                    ticket_id: ticket.id,
                    push_token_id: tokens[i].id,
                    user_id: trainerId,
                    role: "trainer",
                    notification_id: notificationId,
                };
            }
            return null;
        })
        .filter(Boolean);

    if (ticketRows.length > 0) {
        await supabaseAdmin.from("push_tickets").insert(ticketRows);
    }

    // 6. Mark push_sent_at
    await supabaseAdmin
        .from("trainer_notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notificationId);
}

// ── Student Push ──

async function handleStudentNotification(record: Record<string, any>) {
    const studentId = record.student_id;
    const inboxItemId = record.id;
    const title = record.title ?? "Notificação";
    const body = record.subtitle ?? "";
    const type = record.type ?? "unknown";
    const payload = record.payload ?? {};

    // 0. Check if push was already sent
    const { data: existingItem } = await supabaseAdmin
        .from("student_inbox_items")
        .select("push_sent_at")
        .eq("id", inboxItemId)
        .single();

    if (existingItem?.push_sent_at) return;

    // 1. Get student auth_user_id and preferences
    const { data: student } = await supabaseAdmin
        .from("students")
        .select("auth_user_id, notification_preferences")
        .eq("id", studentId)
        .single();

    if (!student?.auth_user_id) return;

    const prefs = student.notification_preferences as {
        push_enabled?: boolean;
        categories?: Record<string, boolean>;
    } | null;
    if (prefs) {
        if (prefs.push_enabled === false) return;
        if (type && prefs.categories?.[type] === false) return;
    }

    // 2. Get active push tokens
    const { data: tokens } = await supabaseAdmin
        .from("push_tokens")
        .select("id, expo_push_token")
        .eq("user_id", student.auth_user_id)
        .eq("role", "student")
        .eq("active", true);

    if (!tokens || tokens.length === 0) return;

    // 3. Send via Expo Push API
    const messages = tokens.map((t: any) => ({
        to: t.expo_push_token,
        sound: "default",
        title,
        body,
        data: {
            notificationId: inboxItemId,
            type,
            ...payload,
        },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
    });

    if (!response.ok) {
        console.error("[send-push] Expo API error (student):", response.status);
        return;
    }

    const result = await response.json();
    const tickets = result.data ?? [];

    for (let i = 0; i < tickets.length; i++) {
        if (tickets[i].status === "error" && tickets[i].details?.error === "DeviceNotRegistered") {
            await supabaseAdmin
                .from("push_tokens")
                .update({ active: false, updated_at: new Date().toISOString() })
                .eq("id", tokens[i].id);
        }
    }

    const ticketRows = tickets
        .map((ticket: any, i: number) => {
            if (ticket.status === "ok" && ticket.id) {
                return {
                    ticket_id: ticket.id,
                    push_token_id: tokens[i].id,
                    user_id: student.auth_user_id,
                    role: "student",
                    notification_id: inboxItemId,
                };
            }
            return null;
        })
        .filter(Boolean);

    if (ticketRows.length > 0) {
        await supabaseAdmin.from("push_tickets").insert(ticketRows);
    }

    // Mark push_sent_at
    await supabaseAdmin
        .from("student_inbox_items")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", inboxItemId);
}
