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

Deno.serve(async (_req) => {
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
        // Inbox já foi inserido; se falhar o UPDATE o próximo tick pode
        // re-enviar. Protegido pela UNIQUE(recurring_appointment_id,
        // occurrence_date, source): não há risco de segundo insert de
        // lembrete. Mas o dispatcher pode re-entrar por este mesmo `id`
        // e re-inserir em inbox — pra evitar, apenas logamos.
        console.error("[dispatch] mark-sent error:", updateError);
    }

    return "sent";
}
