import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: extend-scheduled-notifications
 *
 * Invocada diariamente pelo pg_cron. Garante que toda rotina ativa tem
 * lembretes pendentes na janela dos próximos 30 dias.
 *
 * Estratégia:
 * 1. Para cada rotina ativa (não encerrada e não passada):
 *    a. Calcula as ocorrências da rotina entre hoje e hoje+30d
 *    b. Para cada ocorrência, garante via UPSERT com onConflict que
 *       (recurring_appointment_id, occurrence_date, 'appointment_reminder')
 *       existe em `scheduled_notifications`. A UNIQUE constraint cuida
 *       do resto — linhas já existentes (pending ou sent) não são tocadas.
 *
 * Não usa os helpers do web workspace — reimplementa a projeção aqui
 * (weekly / biweekly / monthly) pra manter a Edge Function auto-contida.
 */

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WINDOW_DAYS = 30;
const REMINDER_LEAD_MINUTES = 60;
const SAO_PAULO_TZ = "America/Sao_Paulo";

const DAY_NAMES_SHORT: Record<number, string> = {
    0: "domingo", 1: "segunda", 2: "terça", 3: "quarta",
    4: "quinta", 5: "sexta", 6: "sábado",
};

interface RecurringRow {
    id: string;
    trainer_id: string;
    student_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    frequency: "weekly" | "biweekly" | "monthly";
    starts_on: string;
    ends_on: string | null;
    status: string;
    group_id: string | null;
}

Deno.serve(async (_req) => {
    const today = new Date();
    const windowEnd = new Date(
        today.getTime() + WINDOW_DAYS * 24 * 60 * 60_000,
    );
    const todayKey = toDateKey(today);
    const windowEndKey = toDateKey(windowEnd);

    // Busca apenas regras ativas cuja janela vigente sobreponha [today, windowEnd].
    const { data: rulesData, error: rulesErr } = await supabaseAdmin
        .from("recurring_appointments")
        .select(
            "id, trainer_id, student_id, day_of_week, start_time, duration_minutes, frequency, starts_on, ends_on, status, group_id",
        )
        .eq("status", "active")
        .lte("starts_on", windowEndKey);

    if (rulesErr) {
        console.error("[extend] rules fetch error:", rulesErr);
        return new Response(JSON.stringify({ error: rulesErr.message }), {
            status: 500,
        });
    }

    const rules = (rulesData ?? []) as RecurringRow[];

    // Resolve trainer names pra reusar nos pushes de lembrete
    const trainerIds = Array.from(new Set(rules.map((r) => r.trainer_id)));
    const { data: trainersData } = trainerIds.length > 0
        ? await supabaseAdmin
            .from("trainers")
            .select("id, name")
            .in("id", trainerIds)
        : { data: [] };
    const trainerNameById = new Map<string, string>(
        (trainersData ?? []).map((t: { id: string; name: string }) => [t.id, t.name]),
    );

    let inspected = 0;
    let inserted = 0;
    let skipped = 0;

    const now = Date.now();

    for (const rule of rules) {
        if (rule.ends_on && rule.ends_on < todayKey) continue;
        const trainerName = trainerNameById.get(rule.trainer_id) ?? "seu treinador";
        const occurrenceDates = enumerateOccurrences(rule, todayKey, windowEndKey);
        for (const dateKey of occurrenceDates) {
            inspected++;
            const reminderAt = computeReminderAtIso(dateKey, rule.start_time);
            const reminderInstant = new Date(reminderAt).getTime();
            if (reminderInstant <= now) {
                skipped++;
                continue;
            }
            const startShort = rule.start_time.slice(0, 5);
            const title = "Treino em 1 hora";
            const body = `Seu treino com ${trainerName} é às ${startShort}`;

            const { error: upsertError } = await supabaseAdmin
                .from("scheduled_notifications")
                .upsert(
                    {
                        student_id: rule.student_id,
                        trainer_id: rule.trainer_id,
                        scheduled_for: reminderAt,
                        title,
                        body,
                        data: {
                            recurring_appointment_id: rule.id,
                            occurrence_date: dateKey,
                            group_id: rule.group_id,
                            day_of_week_name: DAY_NAMES_SHORT[rule.day_of_week],
                        },
                        source: "appointment_reminder",
                        recurring_appointment_id: rule.id,
                        occurrence_date: dateKey,
                        status: "pending",
                    },
                    {
                        onConflict: "recurring_appointment_id,occurrence_date,source",
                        ignoreDuplicates: true,
                    },
                );
            if (upsertError) {
                console.error("[extend] upsert error:", upsertError);
                skipped++;
                continue;
            }
            inserted++;
        }
    }

    return new Response(
        JSON.stringify({ rules: rules.length, inspected, inserted, skipped }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    );
});

// ── Helpers ──────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(d: Date, days: number): Date {
    const r = new Date(d);
    r.setUTCDate(r.getUTCDate() + days);
    return r;
}

function addMonthsUTC(d: Date, months: number): Date {
    const r = new Date(d);
    r.setUTCMonth(r.getUTCMonth() + months);
    return r;
}

function alignToDowForward(d: Date, dow: number): Date {
    const delta = (dow - d.getUTCDay() + 7) % 7;
    return addDaysUTC(d, delta);
}

function enumerateOccurrences(
    rule: RecurringRow,
    startKey: string,
    endKey: string,
): string[] {
    const startsOn = parseDateKey(rule.starts_on);
    const endsOn = rule.ends_on ? parseDateKey(rule.ends_on) : null;
    const rangeStart = parseDateKey(startKey);
    const rangeEnd = parseDateKey(endKey);
    const effStart = startsOn.getTime() > rangeStart.getTime() ? startsOn : rangeStart;
    const effEnd = endsOn && endsOn.getTime() < rangeEnd.getTime() ? endsOn : rangeEnd;
    if (effEnd.getTime() < effStart.getTime()) return [];

    const result: string[] = [];

    if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
        const step = rule.frequency === "weekly" ? 7 : 14;
        let cursor = alignToDowForward(effStart, rule.day_of_week);
        if (cursor.getTime() < startsOn.getTime()) {
            cursor = alignToDowForward(startsOn, rule.day_of_week);
        }
        if (rule.frequency === "biweekly") {
            const anchor = alignToDowForward(startsOn, rule.day_of_week);
            const diffDays = Math.floor(
                (cursor.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
            );
            const mod = ((diffDays % 14) + 14) % 14;
            if (mod !== 0) cursor = addDaysUTC(cursor, 14 - mod);
        }
        while (cursor.getTime() <= effEnd.getTime()) {
            result.push(toDateKey(cursor));
            cursor = addDaysUTC(cursor, step);
        }
        return result;
    }

    if (rule.frequency === "monthly") {
        let cursor = new Date(startsOn);
        while (cursor.getTime() < effStart.getTime()) {
            cursor = addMonthsUTC(cursor, 1);
        }
        while (cursor.getTime() <= effEnd.getTime()) {
            result.push(toDateKey(cursor));
            cursor = addMonthsUTC(cursor, 1);
        }
        return result;
    }
    return result;
}

/** Retorna ISO em UTC do lembrete 1h antes da ocorrência (TZ São Paulo). */
function computeReminderAtIso(dateKey: string, startTime: string): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const [hh, mm] = startTime.slice(0, 5).split(":").map(Number);
    const candidateUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: SAO_PAULO_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = Object.fromEntries(
        fmt.formatToParts(candidateUtc).map((p) => [p.type, p.value]),
    );
    const tzHour = parseInt(parts.hour);
    const tzMinute = parseInt(parts.minute);
    const diffMinutes = (tzHour - hh) * 60 + (tzMinute - mm);
    const occurrenceInstant = new Date(
        candidateUtc.getTime() - diffMinutes * 60_000,
    );
    const reminder = new Date(
        occurrenceInstant.getTime() - REMINDER_LEAD_MINUTES * 60_000,
    );
    return reminder.toISOString();
}
