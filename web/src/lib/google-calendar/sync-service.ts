/**
 * Google Calendar — Sync Service
 *
 * Orquestra todas as mutações Kinevo → Google. Padrão híbrido:
 *   - Síncrono com `Promise.race(apiCall, timeout=3s)`.
 *   - Se bater o timeout, marca `google_sync_status='pending'` e
 *     retorna — mutação principal não bloqueia resposta pro trainer.
 *   - Débito técnico MVP: retry in-process com setTimeout. Fila real
 *     via tabela + Edge Function fica pra V2.
 *
 * Todos os métodos são tolerantes: nunca throw. Logam erros e marcam
 * o agendamento com status apropriado. Se a conexão Google não existe
 * ou está `revoked`, a função retorna `{ synced: false, skipped: true }`
 * sem fazer nada — o agendamento no Kinevo fica íntegro.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
    RecurringAppointment,
    AppointmentException,
} from '@kinevo/shared/types/appointments'
import type { GoogleEvent } from '@kinevo/shared/types/google-calendar'
import {
    createEvent,
    deleteEvent,
    deleteEventInstance,
    listEventInstances,
    patchEvent,
    patchEventInstance,
} from './client'
import {
    buildGoogleEvent,
    buildInstanceOverride,
    computeInstanceIdHint,
} from './event-mapper'
import { getFreshAccessToken, markRevoked } from './token-refresh'

export const SYNC_TIMEOUT_MS = 3000
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] // 30s, 2min, 10min

export interface SyncOutcome {
    synced: boolean
    /** Não havia conexão ativa ou trainer desligado. */
    skipped: boolean
    /** Se marcamos como pending (timeout, rate-limit, transient). */
    pending: boolean
    /** Se marcamos como error (falha persistente). */
    error: boolean
    message?: string
}

function ok(): SyncOutcome {
    return { synced: true, skipped: false, pending: false, error: false }
}
function skipped(reason: string): SyncOutcome {
    return {
        synced: false,
        skipped: true,
        pending: false,
        error: false,
        message: reason,
    }
}
function pending(reason: string): SyncOutcome {
    return {
        synced: false,
        skipped: false,
        pending: true,
        error: false,
        message: reason,
    }
}
function errored(reason: string): SyncOutcome {
    return {
        synced: false,
        skipped: false,
        pending: false,
        error: true,
        message: reason,
    }
}

interface WithTimeoutResult<T> {
    timedOut: boolean
    value?: T
}

export async function withTimeout<T>(
    p: Promise<T>,
    ms: number,
): Promise<WithTimeoutResult<T>> {
    let to: ReturnType<typeof setTimeout> | undefined
    const timer = new Promise<WithTimeoutResult<T>>((resolve) => {
        to = setTimeout(() => resolve({ timedOut: true }), ms)
    })
    const real = p.then((value) => {
        if (to) clearTimeout(to)
        return { timedOut: false, value }
    })
    return Promise.race([real, timer])
}

/**
 * Carrega rotina + nome do aluno. Helper usado antes de qualquer
 * mutação que precisa do payload completo.
 */
async function loadRuleWithStudent(
    ruleId: string,
): Promise<{ rule: RecurringAppointment; studentName: string } | null> {
    const { data } = await supabaseAdmin
        .from('recurring_appointments')
        .select(
            'id, trainer_id, student_id, day_of_week, start_time, duration_minutes, frequency, starts_on, ends_on, status, notes, group_id, google_event_id, google_sync_status, created_at, updated_at, students:student_id(name)',
        )
        .eq('id', ruleId)
        .maybeSingle()
    if (!data) return null
    const studentName =
        (data.students as { name?: string } | null)?.name ?? 'Aluno'
    const rule: RecurringAppointment = {
        id: data.id,
        trainer_id: data.trainer_id,
        student_id: data.student_id,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        duration_minutes: data.duration_minutes,
        frequency: data.frequency,
        starts_on: data.starts_on,
        ends_on: data.ends_on,
        status: data.status,
        notes: data.notes,
        group_id: data.group_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
    }
    return { rule, studentName }
}

async function setSyncStatus(
    ruleId: string,
    status: 'synced' | 'pending' | 'error' | 'disabled',
    googleEventId?: string,
): Promise<void> {
    const patch: Record<string, unknown> = { google_sync_status: status }
    if (googleEventId !== undefined) patch.google_event_id = googleEventId
    await supabaseAdmin
        .from('recurring_appointments')
        .update(patch)
        .eq('id', ruleId)
}

/** Schedule a retry attempt with backoff. In-process; MVP débito técnico. */
function scheduleRetry(
    fn: () => Promise<SyncOutcome>,
    attempt: number,
): void {
    const delay = RETRY_DELAYS_MS[attempt]
    if (delay === undefined) return
    setTimeout(() => {
        void fn()
            .then((o) => {
                if (o.pending) scheduleRetry(fn, attempt + 1)
            })
            .catch((err) => {
                console.error('[google-sync] retry error:', err)
            })
    }, delay).unref?.()
}

// ────────── Public API ──────────

/**
 * Cria o evento recorrente no Google pra uma rotina nova.
 * A rotina já foi persistida no Kinevo. Se Google falhar, apenas marca
 * `pending`/`error`; não reverte a rotina.
 */
export async function syncCreateAppointment(
    ruleId: string,
): Promise<SyncOutcome> {
    const loaded = await loadRuleWithStudent(ruleId)
    if (!loaded) return errored('rotina não encontrada')
    const creds = await getFreshAccessToken(loaded.rule.trainer_id)
    if (!creds) return skipped('trainer sem conexão Google ativa')

    await setSyncStatus(ruleId, 'pending')

    const event = buildGoogleEvent(loaded.rule, {
        studentName: loaded.studentName,
    })

    const raced = await withTimeout(
        createEvent(creds.accessToken, creds.calendarId, event),
        SYNC_TIMEOUT_MS,
    )

    if (raced.timedOut) {
        scheduleRetry(() => syncCreateAppointment(ruleId), 0)
        return pending('timeout — retry agendado')
    }

    const result = raced.value
    if (!result) return errored('sem resposta da API')

    if (!result.ok) {
        if (result.kind === 'unauthorized' || result.kind === 'revoked') {
            await markRevoked(loaded.rule.trainer_id, result.message)
            return errored(`auth: ${result.message}`)
        }
        if (result.kind === 'rate_limit') {
            scheduleRetry(() => syncCreateAppointment(ruleId), 0)
            return pending('rate-limit — retry agendado')
        }
        await setSyncStatus(ruleId, 'error')
        return errored(result.message)
    }

    const googleEventId = result.data.id
    if (!googleEventId) {
        await setSyncStatus(ruleId, 'error')
        return errored('google não retornou id')
    }
    await setSyncStatus(ruleId, 'synced', googleEventId)
    await supabaseAdmin
        .from('google_calendar_connections')
        .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
        .eq('trainer_id', loaded.rule.trainer_id)
    return ok()
}

/** PATCH no evento recorrente quando a rotina é editada. */
export async function syncUpdateAppointment(
    ruleId: string,
): Promise<SyncOutcome> {
    const loaded = await loadRuleWithStudent(ruleId)
    if (!loaded) return errored('rotina não encontrada')
    if (!loaded.rule.trainer_id) return errored('sem trainer_id')
    const creds = await getFreshAccessToken(loaded.rule.trainer_id)
    if (!creds) return skipped('trainer sem conexão Google ativa')

    // Se não tem event_id, o evento ainda não foi criado no Google
    // (ou a sync inicial falhou). Cai pra fluxo de create.
    const { data: current } = await supabaseAdmin
        .from('recurring_appointments')
        .select('google_event_id')
        .eq('id', ruleId)
        .maybeSingle()
    if (!current?.google_event_id) {
        return syncCreateAppointment(ruleId)
    }

    await setSyncStatus(ruleId, 'pending')
    const event = buildGoogleEvent(loaded.rule, {
        studentName: loaded.studentName,
    })

    const raced = await withTimeout(
        patchEvent(
            creds.accessToken,
            creds.calendarId,
            current.google_event_id,
            event,
        ),
        SYNC_TIMEOUT_MS,
    )
    if (raced.timedOut) {
        scheduleRetry(() => syncUpdateAppointment(ruleId), 0)
        return pending('timeout — retry agendado')
    }
    const result = raced.value
    if (!result) return errored('sem resposta')

    if (!result.ok) {
        if (result.kind === 'not_found') {
            // Evento sumiu no Google — recria.
            await setSyncStatus(ruleId, 'not_synced' as never)
            return syncCreateAppointment(ruleId)
        }
        if (result.kind === 'unauthorized' || result.kind === 'revoked') {
            await markRevoked(loaded.rule.trainer_id, result.message)
            return errored(`auth: ${result.message}`)
        }
        if (result.kind === 'rate_limit') {
            scheduleRetry(() => syncUpdateAppointment(ruleId), 0)
            return pending('rate-limit — retry agendado')
        }
        await setSyncStatus(ruleId, 'error')
        return errored(result.message)
    }

    await setSyncStatus(ruleId, 'synced')
    return ok()
}

/** DELETE no evento recorrente quando a rotina é encerrada. */
export async function syncDeleteAppointment(
    ruleId: string,
): Promise<SyncOutcome> {
    const { data } = await supabaseAdmin
        .from('recurring_appointments')
        .select('trainer_id, google_event_id')
        .eq('id', ruleId)
        .maybeSingle()
    if (!data) return skipped('rotina não encontrada')
    if (!data.google_event_id) return skipped('sem google_event_id')
    const creds = await getFreshAccessToken(data.trainer_id)
    if (!creds) return skipped('trainer sem conexão Google ativa')

    const raced = await withTimeout(
        deleteEvent(creds.accessToken, creds.calendarId, data.google_event_id),
        SYNC_TIMEOUT_MS,
    )
    if (raced.timedOut) {
        scheduleRetry(() => syncDeleteAppointment(ruleId), 0)
        return pending('timeout — retry agendado')
    }
    const result = raced.value
    if (!result) return errored('sem resposta')

    if (!result.ok) {
        if (result.kind === 'not_found') {
            // Já sumiu no Google — considera ok.
            return ok()
        }
        if (result.kind === 'unauthorized' || result.kind === 'revoked') {
            await markRevoked(data.trainer_id, result.message)
            return errored(`auth: ${result.message}`)
        }
        if (result.kind === 'rate_limit') {
            scheduleRetry(() => syncDeleteAppointment(ruleId), 0)
            return pending('rate-limit — retry agendado')
        }
        return errored(result.message)
    }
    return ok()
}

/** Instance override quando a ocorrência é remarcada. */
export async function syncRescheduleOccurrence(
    ruleId: string,
    exception: Pick<
        AppointmentException,
        'occurrence_date' | 'new_date' | 'new_start_time'
    >,
): Promise<SyncOutcome> {
    const loaded = await loadRuleWithStudent(ruleId)
    if (!loaded) return errored('rotina não encontrada')
    const creds = await getFreshAccessToken(loaded.rule.trainer_id)
    if (!creds) return skipped('trainer sem conexão Google ativa')

    const { data: current } = await supabaseAdmin
        .from('recurring_appointments')
        .select('google_event_id')
        .eq('id', ruleId)
        .maybeSingle()
    if (!current?.google_event_id) return skipped('sem google_event_id')

    const newDate = exception.new_date ?? exception.occurrence_date
    const newTime = (exception.new_start_time ?? loaded.rule.start_time).slice(0, 5)

    const patch = buildInstanceOverride({
        originalDate: exception.occurrence_date,
        originalStartHHMM: loaded.rule.start_time.slice(0, 5),
        newDate,
        newStartHHMM: newTime,
        durationMinutes: loaded.rule.duration_minutes,
    })

    const instanceId = await resolveInstanceId(
        creds.accessToken,
        creds.calendarId,
        current.google_event_id,
        exception.occurrence_date,
        loaded.rule.start_time.slice(0, 5),
    )
    if (!instanceId) return errored('não foi possível localizar a instância no Google')

    const raced = await withTimeout(
        patchEventInstance(creds.accessToken, creds.calendarId, instanceId, patch),
        SYNC_TIMEOUT_MS,
    )
    if (raced.timedOut) {
        scheduleRetry(
            () => syncRescheduleOccurrence(ruleId, exception),
            0,
        )
        return pending('timeout — retry agendado')
    }
    const result = raced.value
    if (!result) return errored('sem resposta')
    if (!result.ok) {
        if (result.kind === 'unauthorized' || result.kind === 'revoked') {
            await markRevoked(loaded.rule.trainer_id, result.message)
            return errored(`auth: ${result.message}`)
        }
        if (result.kind === 'rate_limit') {
            scheduleRetry(
                () => syncRescheduleOccurrence(ruleId, exception),
                0,
            )
            return pending('rate-limit — retry agendado')
        }
        return errored(result.message)
    }
    return ok()
}

/** DELETE na instance quando a ocorrência é cancelada. */
export async function syncCancelOccurrence(
    ruleId: string,
    occurrenceDate: string,
): Promise<SyncOutcome> {
    const loaded = await loadRuleWithStudent(ruleId)
    if (!loaded) return errored('rotina não encontrada')
    const creds = await getFreshAccessToken(loaded.rule.trainer_id)
    if (!creds) return skipped('trainer sem conexão Google ativa')

    const { data: current } = await supabaseAdmin
        .from('recurring_appointments')
        .select('google_event_id')
        .eq('id', ruleId)
        .maybeSingle()
    if (!current?.google_event_id) return skipped('sem google_event_id')

    const instanceId = await resolveInstanceId(
        creds.accessToken,
        creds.calendarId,
        current.google_event_id,
        occurrenceDate,
        loaded.rule.start_time.slice(0, 5),
    )
    if (!instanceId) return errored('instância não encontrada')

    const raced = await withTimeout(
        deleteEventInstance(creds.accessToken, creds.calendarId, instanceId),
        SYNC_TIMEOUT_MS,
    )
    if (raced.timedOut) {
        scheduleRetry(
            () => syncCancelOccurrence(ruleId, occurrenceDate),
            0,
        )
        return pending('timeout — retry agendado')
    }
    const result = raced.value
    if (!result) return errored('sem resposta')
    if (!result.ok) {
        if (result.kind === 'not_found') return ok()
        if (result.kind === 'unauthorized' || result.kind === 'revoked') {
            await markRevoked(loaded.rule.trainer_id, result.message)
            return errored(`auth: ${result.message}`)
        }
        if (result.kind === 'rate_limit') {
            scheduleRetry(
                () => syncCancelOccurrence(ruleId, occurrenceDate),
                0,
            )
            return pending('rate-limit — retry agendado')
        }
        return errored(result.message)
    }
    return ok()
}

/**
 * Localiza o instance id real listando as instâncias em torno da data.
 * Google aceita ids "basic" como `<eventId>_YYYYMMDDTHHMMSSZ` mas em
 * edge cases (DST, eventos antigos) o id real pode divergir — listar é
 * mais confiável.
 */
async function resolveInstanceId(
    accessToken: string,
    calendarId: string,
    eventId: string,
    occurrenceDate: string,
    originalStartHHMM: string,
): Promise<string | null> {
    // Janela de 1 dia ao redor da ocorrência
    const timeMin = `${occurrenceDate}T00:00:00-03:00`
    const timeMax = `${occurrenceDate}T23:59:59-03:00`
    const result = await listEventInstances(accessToken, calendarId, eventId, {
        timeMin,
        timeMax,
    })
    if (!result.ok) {
        // Fallback: id "basic"
        return computeInstanceIdHint(eventId, occurrenceDate, originalStartHHMM)
    }
    const items = (result.data as { items?: GoogleEvent[] }).items ?? []
    // Casamos pela data local do start
    const match = items.find((ev) => {
        const dt = ev.start?.dateTime
        if (!dt) return false
        return dt.startsWith(occurrenceDate)
    })
    return match?.id ?? null
}
