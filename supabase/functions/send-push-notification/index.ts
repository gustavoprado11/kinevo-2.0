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
        // Auth: shared secret enviado pelos triggers pg_net (migration 180).
        // A função roda com verify_jwt=false (o trigger não tem JWT), então
        // este header é a ÚNICA barreira contra POST anônimo. Fail-closed:
        // sem secret configurado ou sem header válido, rejeita.
        const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
        const providedSecret = req.headers.get("x-push-secret");
        if (!expectedSecret || providedSecret !== expectedSecret) {
            console.warn("[send-push-notification] Rejected: bad or missing x-push-secret");
            return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

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

// ── Claim atômico do envio (M1, auditoria 11/jul) ──
// O mesmo evento tem DOIS emissores concorrentes: esta Edge Function (via
// trigger pg_net) e o envio direto in-process das rotas web. O dedup antigo
// era check-then-act sobre push_sent_at (os dois liam NULL → 2 pushes). Agora
// quem vence o UPDATE condicional envia; falha ANTES do envio devolve o claim.
async function claimPushSend(table: string, id: string): Promise<boolean> {
    const { data: claimed, error } = await supabaseAdmin
        .from(table)
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", id)
        .is("push_sent_at", null)
        .select("id");
    if (error) return false; // perde a corrida em vez de arriscar duplicar
    return (claimed?.length ?? 0) > 0;
}

async function releasePushClaim(table: string, id: string): Promise<void> {
    try {
        await supabaseAdmin.from(table).update({ push_sent_at: null }).eq("id", id);
    } catch (_) { /* melhor-esforço */ }
}

// ── Trainer Push ──

async function handleTrainerNotification(record: Record<string, any>) {
    const trainerId = record.trainer_id;
    const notificationId = record.id;
    const type = record.type ?? "unknown";
    const title = record.title ?? "Notificação";
    const body = record.body ?? record.message ?? "";
    const data = record.data ?? record.metadata ?? {};

    // 0. Claim atômico (anti-corrida com o envio direto das rotas web).
    if (!(await claimPushSend("trainer_notifications", notificationId))) return;

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
        await releasePushClaim("trainer_notifications", notificationId);
        return;
    }

    const result = await response.json();
    const tickets = result.data ?? [];

    // 4. Handle ticket errors — log every non-OK ticket, deactivate token on DeviceNotRegistered.
    for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (t.status !== "error") continue;
        const errType = t.details?.error ?? "unknown";

        // Structured log — never breaks send flow.
        try {
            await supabaseAdmin.from("push_errors").insert({
                push_token_id: tokens[i].id,
                user_id: trainerId,
                role: "trainer",
                notification_id: notificationId,
                error_type: errType,
                error_message: t.message ?? null,
                raw_ticket: t,
            });
        } catch (logErr) {
            console.error("[send-push] Failed to log push error:", logErr);
        }

        if (errType === "DeviceNotRegistered") {
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

    // push_sent_at já foi marcado pelo claim do passo 0.
}

// ── Student Push ──

async function handleStudentNotification(record: Record<string, any>) {
    const studentId = record.student_id;
    const inboxItemId = record.id;
    const title = record.title ?? "Notificação";
    const body = record.subtitle ?? "";
    const type = record.type ?? "unknown";
    const payload = record.payload ?? {};

    // 0. Claim atômico (anti-corrida com o envio direto das rotas web).
    if (!(await claimPushSend("student_inbox_items", inboxItemId))) return;

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
        await releasePushClaim("student_inbox_items", inboxItemId);
        return;
    }

    const result = await response.json();
    const tickets = result.data ?? [];

    for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (t.status !== "error") continue;
        const errType = t.details?.error ?? "unknown";

        // Structured log — never breaks send flow.
        try {
            await supabaseAdmin.from("push_errors").insert({
                push_token_id: tokens[i].id,
                user_id: student.auth_user_id,
                role: "student",
                notification_id: inboxItemId,
                error_type: errType,
                error_message: t.message ?? null,
                raw_ticket: t,
            });
        } catch (logErr) {
            console.error("[send-push] Failed to log push error:", logErr);
        }

        if (errType === "DeviceNotRegistered") {
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

    // push_sent_at já foi marcado pelo claim do passo 0.
}
