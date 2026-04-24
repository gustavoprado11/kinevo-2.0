/**
 * Google Calendar — HTTP client fino
 *
 * Todos os métodos recebem um `accessToken` já válido (renovação é
 * responsabilidade do `token-refresh.ts`). Retornam `GoogleApiResult<T>`
 * ao invés de throw-em-caso-de-erro pra que o chamador trate
 * 401/403/404/429 de forma granular.
 */

import type {
    GoogleApiErrorBody,
    GoogleCalendarList,
    GoogleEvent,
    GoogleEventsList,
    GoogleWatchChannelResponse,
} from '@kinevo/shared/types/google-calendar'

const BASE = 'https://www.googleapis.com/calendar/v3'

export type GoogleApiOk<T> = { ok: true; data: T }
export type GoogleApiErr = {
    ok: false
    status: number
    /** 'not_found', 'unauthorized', 'rate_limit', 'revoked', 'unknown' */
    kind: 'not_found' | 'unauthorized' | 'rate_limit' | 'revoked' | 'unknown'
    message: string
}
export type GoogleApiResult<T> = GoogleApiOk<T> | GoogleApiErr

async function request<T>(
    method: string,
    path: string,
    accessToken: string,
    body?: unknown,
): Promise<GoogleApiResult<T>> {
    const url = path.startsWith('http') ? path : `${BASE}${path}`
    const init: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    }
    if (body !== undefined) init.body = JSON.stringify(body)

    let res: Response
    try {
        res = await fetch(url, init)
    } catch (err) {
        return {
            ok: false,
            status: 0,
            kind: 'unknown',
            message: err instanceof Error ? err.message : String(err),
        }
    }

    if (res.status === 204) {
        return { ok: true, data: undefined as unknown as T }
    }

    const text = await res.text()
    let parsed: unknown = null
    try {
        parsed = text ? JSON.parse(text) : null
    } catch {
        parsed = null
    }

    if (res.ok) {
        return { ok: true, data: parsed as T }
    }

    const errMsg =
        (parsed as GoogleApiErrorBody | null)?.error?.message ??
        `HTTP ${res.status}`
    const kind: GoogleApiErr['kind'] =
        res.status === 404
            ? 'not_found'
            : res.status === 401
              ? 'unauthorized'
              : res.status === 403 && /rate/i.test(errMsg)
                ? 'rate_limit'
                : res.status === 429
                  ? 'rate_limit'
                  : res.status === 400 && /invalid_grant/i.test(errMsg)
                    ? 'revoked'
                    : 'unknown'
    return { ok: false, status: res.status, kind, message: errMsg }
}

// ────────── Calendars ──────────

export function listCalendars(accessToken: string) {
    return request<GoogleCalendarList>(
        'GET',
        '/users/me/calendarList',
        accessToken,
    )
}

// ────────── Events ──────────

export function createEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleEvent,
) {
    return request<GoogleEvent>(
        'POST',
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        accessToken,
        event,
    )
}

export function patchEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    patch: Partial<GoogleEvent>,
) {
    return request<GoogleEvent>(
        'PATCH',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        accessToken,
        patch,
    )
}

export function deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
) {
    return request<void>(
        'DELETE',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        accessToken,
    )
}

export function listEventInstances(
    accessToken: string,
    calendarId: string,
    eventId: string,
    params: { timeMin?: string; timeMax?: string } = {},
) {
    const qs = new URLSearchParams()
    if (params.timeMin) qs.set('timeMin', params.timeMin)
    if (params.timeMax) qs.set('timeMax', params.timeMax)
    const query = qs.toString() ? `?${qs}` : ''
    return request<GoogleEventsList>(
        'GET',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/instances${query}`,
        accessToken,
    )
}

export function patchEventInstance(
    accessToken: string,
    calendarId: string,
    instanceId: string,
    patch: Partial<GoogleEvent>,
) {
    return request<GoogleEvent>(
        'PATCH',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(instanceId)}`,
        accessToken,
        patch,
    )
}

export function deleteEventInstance(
    accessToken: string,
    calendarId: string,
    instanceId: string,
) {
    return request<void>(
        'DELETE',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(instanceId)}`,
        accessToken,
    )
}

export function listUpdatedEvents(
    accessToken: string,
    calendarId: string,
    updatedMin: string,
) {
    const qs = new URLSearchParams({
        updatedMin,
        showDeleted: 'true',
        singleEvents: 'true',
    })
    return request<GoogleEventsList>(
        'GET',
        `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`,
        accessToken,
    )
}

// ────────── Watch Channels ──────────

export function createWatchChannel(
    accessToken: string,
    calendarId: string,
    args: { id: string; address: string; token?: string; ttlSeconds?: number },
) {
    const body: Record<string, unknown> = {
        id: args.id,
        type: 'web_hook',
        address: args.address,
    }
    if (args.token) body.token = args.token
    if (args.ttlSeconds) body.params = { ttl: String(args.ttlSeconds) }
    return request<GoogleWatchChannelResponse>(
        'POST',
        `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        accessToken,
        body,
    )
}

export function stopWatchChannel(
    accessToken: string,
    channelId: string,
    resourceId: string,
) {
    return request<void>('POST', `/channels/stop`, accessToken, {
        id: channelId,
        resourceId,
    })
}
