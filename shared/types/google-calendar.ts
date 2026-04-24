/**
 * Google Calendar — Tipos mínimos
 *
 * Subconjunto da Google Calendar API v3 que o Kinevo consome. Mantido aqui
 * pra evitar dependência de `@types/gapi` / `googleapis` pesadas no bundle
 * do Next.js. Referência:
 * - https://developers.google.com/calendar/api/v3/reference/events
 * - https://developers.google.com/calendar/api/v3/reference/channels
 */

/** Resposta do endpoint /oauth2/v4/token ou /token. */
export interface GoogleOAuthTokenResponse {
    access_token: string
    expires_in: number
    /** Só vem na primeira troca (code). Refresh subsequente não retorna refresh_token. */
    refresh_token?: string
    scope: string
    token_type: 'Bearer'
    id_token?: string
}

/** Info básica da conta (retorno de /oauth2/v2/userinfo). */
export interface GoogleUserInfo {
    email: string
    verified_email?: boolean
    name?: string
    picture?: string
}

/** Entry de /calendar/v3/users/me/calendarList */
export interface GoogleCalendarListEntry {
    id: string
    summary: string
    summaryOverride?: string
    primary?: boolean
    accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner'
    timeZone?: string
    backgroundColor?: string
}

export interface GoogleCalendarList {
    kind: 'calendar#calendarList'
    items: GoogleCalendarListEntry[]
    nextPageToken?: string
}

export interface GoogleEventDateTime {
    /** ISO date-time; ex: '2026-04-24T07:00:00' */
    dateTime?: string
    /** IANA timezone; ex: 'America/Sao_Paulo' */
    timeZone?: string
    /** Usado apenas em eventos de dia inteiro */
    date?: string
}

export interface GoogleEventReminders {
    useDefault: boolean
    overrides?: Array<{
        method: 'email' | 'popup'
        minutes: number
    }>
}

/** Evento da Google Calendar API. Só campos que criamos/lemos. */
export interface GoogleEvent {
    id?: string
    status?: 'confirmed' | 'cancelled' | 'tentative'
    summary?: string
    description?: string
    start: GoogleEventDateTime
    end: GoogleEventDateTime
    /** Array de RRULE / RDATE / EXDATE */
    recurrence?: string[]
    /** Em instance overrides, aponta pro mestre. */
    recurringEventId?: string
    /** Em instance overrides, timestamp original. */
    originalStartTime?: GoogleEventDateTime
    reminders?: GoogleEventReminders
    /** Só retorno: quando foi editado no Google. */
    updated?: string
    /** Só retorno: o criador / organizador. */
    creator?: { email: string; self?: boolean }
    organizer?: { email: string; self?: boolean }
}

/** Resposta de /events/{eventId}/instances. */
export interface GoogleEventInstancesList {
    kind: 'calendar#events'
    items: GoogleEvent[]
    nextPageToken?: string
    nextSyncToken?: string
}

/** Resposta de /{calendarId}/events (listagem). */
export interface GoogleEventsList {
    kind: 'calendar#events'
    items: GoogleEvent[]
    nextPageToken?: string
    nextSyncToken?: string
}

/** Resposta de POST /{calendarId}/events/watch */
export interface GoogleWatchChannelResponse {
    kind: 'api#channel'
    id: string
    resourceId: string
    resourceUri?: string
    token?: string
    expiration: string // epoch-ms em string
}

/** Erro de API (google retorna 4xx/5xx com este shape). */
export interface GoogleApiErrorBody {
    error: {
        code: number
        message: string
        errors?: Array<{ reason: string; message: string }>
        status?: string
    }
}
