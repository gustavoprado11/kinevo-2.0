import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: renew-google-watch-channels
 *
 * Invocada diariamente pelo pg_cron. Para cada conexão com watch channel
 * que expira em <2 dias, para o channel antigo e cria um novo.
 *
 * Requer que o trainer_id ainda tenha access_token válido; se o refresh
 * falhar, marca conexão como revoked e NÃO tenta renovar (a app vai
 * mostrar banner pedindo reconexão).
 */

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EXPIRY_BUFFER_MS = 2 * 24 * 60 * 60_000; // 2 dias

const CAL_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const WEBHOOK_URL = Deno.env.get("GOOGLE_WEBHOOK_URL") ??
    "https://www.kinevoapp.com/api/webhooks/google-calendar";

interface Conn {
    trainer_id: string;
    calendar_id: string;
    access_token: string;
    refresh_token: string;
    access_token_expires_at: string;
    watch_channel_id: string | null;
    watch_resource_id: string | null;
    watch_expires_at: string | null;
}

Deno.serve(async (_req) => {
    const threshold = new Date(Date.now() + EXPIRY_BUFFER_MS).toISOString();
    const { data, error } = await supabaseAdmin
        .from("google_calendar_connections")
        .select(
            "trainer_id, calendar_id, access_token, refresh_token, access_token_expires_at, watch_channel_id, watch_resource_id, watch_expires_at",
        )
        .eq("status", "active")
        .not("watch_channel_id", "is", null)
        .lte("watch_expires_at", threshold);

    if (error) {
        return json({ error: error.message }, 500);
    }

    const conns = (data ?? []) as Conn[];
    let renewed = 0;
    let failed = 0;

    for (const conn of conns) {
        try {
            const accessToken = await ensureAccessToken(conn);
            if (!accessToken) {
                failed++;
                continue;
            }

            if (conn.watch_channel_id && conn.watch_resource_id) {
                await stopChannel(
                    accessToken,
                    conn.watch_channel_id,
                    conn.watch_resource_id,
                );
            }

            const newChannelId = crypto.randomUUID();
            const res = await fetch(
                `${CAL_BASE}/calendars/${encodeURIComponent(conn.calendar_id)}/events/watch`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id: newChannelId,
                        type: "web_hook",
                        address: WEBHOOK_URL,
                        token: conn.trainer_id,
                        params: { ttl: "604800" }, // 7 dias
                    }),
                },
            );
            if (!res.ok) {
                const text = await res.text();
                console.error("[renew] watch create failed:", res.status, text);
                await supabaseAdmin
                    .from("google_calendar_connections")
                    .update({ last_sync_error: `watch renew: ${text}` })
                    .eq("trainer_id", conn.trainer_id);
                failed++;
                continue;
            }
            const body = await res.json();
            await supabaseAdmin
                .from("google_calendar_connections")
                .update({
                    watch_channel_id: body.id,
                    watch_resource_id: body.resourceId,
                    watch_expires_at: new Date(parseInt(body.expiration, 10)).toISOString(),
                    last_sync_error: null,
                })
                .eq("trainer_id", conn.trainer_id);
            renewed++;
        } catch (err) {
            console.error("[renew] unexpected error:", err);
            failed++;
        }
    }

    return json({ scanned: conns.length, renewed, failed });
});

async function ensureAccessToken(conn: Conn): Promise<string | null> {
    const exp = new Date(conn.access_token_expires_at).getTime();
    if (exp - Date.now() > 2 * 60_000) return conn.access_token;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("[renew] GOOGLE_OAUTH_CLIENT_ID/SECRET não configurados");
        return null;
    }

    const body = new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
    });
    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error("[renew] refresh failed:", res.status, text);
        if (/invalid_grant/i.test(text)) {
            await supabaseAdmin
                .from("google_calendar_connections")
                .update({ status: "revoked", last_sync_error: text })
                .eq("trainer_id", conn.trainer_id);
        }
        return null;
    }
    const payload = await res.json();
    const newExp = new Date(Date.now() + payload.expires_in * 1000).toISOString();
    await supabaseAdmin
        .from("google_calendar_connections")
        .update({
            access_token: payload.access_token,
            access_token_expires_at: newExp,
        })
        .eq("trainer_id", conn.trainer_id);
    return payload.access_token;
}

async function stopChannel(
    accessToken: string,
    channelId: string,
    resourceId: string,
): Promise<void> {
    await fetch(`${CAL_BASE}/channels/stop`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: channelId, resourceId }),
    }).catch(() => undefined);
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
