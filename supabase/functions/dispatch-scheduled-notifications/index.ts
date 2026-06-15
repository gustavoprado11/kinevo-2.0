import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: dispatch-scheduled-notifications
 *
 * Invocada a cada 5min pelo pg_cron. Lê até 100 linhas em
 * `scheduled_notifications` com `status='pending' AND scheduled_for <= now()`,
 * respeita preferências do aluno e insere em `student_inbox_items` — que
 * por sua vez dispara a Edge Function existente `send-push-notification`
 * via o trigger criado em 098_realtime_push_notifications.
 *
 * Em caso de sucesso, marca a linha como `sent` (e grava `sent_at`).
 * Se o aluno desligou pushes/categoria, marca como `canceled` (não tenta
 * de novo). Erro de DB → `failed` + `last_error`.
 */

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BATCH_SIZE = 100;

interface ScheduledRow {
    id: string;
    student_id: string;
    trainer_id: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
}

Deno.serve(async (req) => {
    // Auth: shared secret enviado pelo cron pg_net (migration 205, mesmo
    // secret do send-push-notification). A função roda com verify_jwt=false,
    // então este header é a ÚNICA barreira contra POST anônimo. Fail-closed.
    const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-push-secret");
    if (!expectedSecret || providedSecret !== expectedSecret) {
        console.warn("[dispatch] Rejected: bad or missing x-push-secret");
        return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401 },
        );
    }

    const nowIso = new Date().toISOString();

    const { data: rows, error: fetchError } = await supabaseAdmin
        .from("scheduled_notifications")
        .select("id, student_id, trainer_id, title, body, data")
        .eq("status", "pending")
        .lte("scheduled_for", nowIso)
        .order("scheduled_for", { ascending: true })
        .limit(BATCH_SIZE);

    if (fetchError) {
        console.error("[dispatch] fetch error:", fetchError);
        return new Response(
            JSON.stringify({ error: fetchError.message }),
            { status: 500 },
        );
    }

    const pending = (rows ?? []) as ScheduledRow[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of pending) {
        const result = await dispatchOne(row);
        if (result === "sent") sent++;
        else if (result === "skipped") skipped++;
        else failed++;
    }

    return new Response(
        JSON.stringify({ total: pending.length, sent, skipped, failed }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        },
    );
});

async function dispatchOne(
    row: ScheduledRow,
): Promise<"sent" | "skipped" | "failed"> {
    // 0. Claim atômico: pending → processing condicionado a status='pending'.
    //    Sob invocações concorrentes do cron, só UM worker vence o claim; os
    //    outros recebem 0 linhas e pulam — evita inbox/push duplicados.
    const { data: claimed, error: claimError } = await supabaseAdmin
        .from("scheduled_notifications")
        .update({ status: "processing" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id");

    if (claimError) {
        console.error("[dispatch] claim error:", claimError);
        return "failed";
    }
    if (!claimed || claimed.length === 0) {
        // Outro worker já reivindicou esta linha (ou ela saiu de 'pending').
        return "skipped";
    }

    // 1. Preferências do aluno — se desabilitou categoria 'appointment' ou
    //    push_enabled=false, cancela (não tenta de novo).
    const { data: student } = await supabaseAdmin
        .from("students")
        .select("notification_preferences")
        .eq("id", row.student_id)
        .single();

    const prefs = (student?.notification_preferences ?? null) as
        | { push_enabled?: boolean; categories?: Record<string, boolean> }
        | null;
    const pushEnabled = prefs?.push_enabled !== false;
    const categoryEnabled = prefs?.categories?.appointment !== false;

    if (!pushEnabled || !categoryEnabled) {
        await supabaseAdmin
            .from("scheduled_notifications")
            .update({ status: "canceled", sent_at: new Date().toISOString() })
            .eq("id", row.id);
        return "skipped";
    }

    // 2. Insere em student_inbox_items. O trigger 098 chama send-push.
    const { error: insertError } = await supabaseAdmin
        .from("student_inbox_items")
        .insert({
            student_id: row.student_id,
            trainer_id: row.trainer_id,
            type: "appointment",
            status: "unread",
            title: row.title,
            subtitle: row.body,
            payload: row.data ?? {},
        });

    if (insertError) {
        console.error("[dispatch] insert inbox error:", insertError);
        await supabaseAdmin
            .from("scheduled_notifications")
            .update({ status: "failed", last_error: insertError.message })
            .eq("id", row.id);
        return "failed";
    }

    // 3. Marca como sent.
    const { error: updateError } = await supabaseAdmin
        .from("scheduled_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

    if (updateError) {
        // Inbox já foi inserido e o push já disparou. Se o mark-sent falhar, a
        // linha fica em 'processing' (não volta a 'pending'), então o próximo
        // tick NÃO a reprocessa — sem risco de inbox/push duplicado. Apenas
        // logamos; a linha não fica marcada 'sent', mas a notificação saiu.
        console.error("[dispatch] mark-sent error:", updateError);
    }

    return "sent";
}
