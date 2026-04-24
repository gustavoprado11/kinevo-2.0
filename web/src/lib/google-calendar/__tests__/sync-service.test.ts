import { describe, it, expect, vi } from 'vitest'
import { withTimeout } from '../sync-service'

describe('withTimeout', () => {
    it('resolve com o valor quando promessa termina antes do timeout', async () => {
        const result = await withTimeout(
            new Promise<string>((r) => setTimeout(() => r('ok'), 10)),
            100,
        )
        expect(result.timedOut).toBe(false)
        expect(result.value).toBe('ok')
    })

    it('marca timedOut quando a promessa é mais lenta que ms', async () => {
        const result = await withTimeout(
            new Promise<string>((r) => setTimeout(() => r('late'), 100)),
            10,
        )
        expect(result.timedOut).toBe(true)
        expect(result.value).toBeUndefined()
    })
})

// ─────────────────────────────────────────────────────────────
// Sync service flow tests — usam mocks heavy do supabase-admin
// e da client.ts. Verificam apenas o fluxo "happy path" síncrono
// e o comportamento em caso de 404/401 — retries in-process não
// são testados (débito MVP).
// ─────────────────────────────────────────────────────────────

const mockCreateEvent = vi.fn()
const mockPatchEvent = vi.fn()
const mockDeleteEvent = vi.fn()
vi.mock('../client', () => ({
    createEvent: (...args: unknown[]) => mockCreateEvent(...args),
    patchEvent: (...args: unknown[]) => mockPatchEvent(...args),
    deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
    patchEventInstance: vi.fn(),
    deleteEventInstance: vi.fn(),
    listEventInstances: vi.fn(),
}))

const mockGetFreshAccessToken = vi.fn()
const mockMarkRevoked = vi.fn()
vi.mock('../token-refresh', () => ({
    getFreshAccessToken: (...args: unknown[]) => mockGetFreshAccessToken(...args),
    markRevoked: (...args: unknown[]) => mockMarkRevoked(...args),
}))

// supabase-admin mock — chainable, retorna o que configurarmos por (table, op)
type Resolved = { data: unknown; error: unknown }
const chainResponses: {
    select: Resolved | null
    update: Resolved | null
} = { select: null, update: null }
function resetChain() {
    chainResponses.select = null
    chainResponses.update = null
}
function makeChain() {
    const chain = {
        select: vi.fn(() => chain),
        update: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        not: vi.fn(() => chain),
        in: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => chainResponses.select ?? { data: null, error: null }),
        single: vi.fn(async () => chainResponses.select ?? { data: null, error: null }),
        then: (r: (v: Resolved) => unknown) =>
            Promise.resolve(
                chainResponses.update ?? chainResponses.select ?? { data: null, error: null },
            ).then(r),
    }
    return chain
}
vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: vi.fn(() => makeChain()),
    },
}))

import {
    syncCreateAppointment,
    syncUpdateAppointment,
    syncDeleteAppointment,
} from '../sync-service'

function primeRule() {
    chainResponses.select = {
        data: {
            id: 'ra-1',
            trainer_id: 't-1',
            student_id: 's-1',
            day_of_week: 2,
            start_time: '07:00',
            duration_minutes: 60,
            frequency: 'weekly',
            starts_on: '2026-04-07',
            ends_on: null,
            status: 'active',
            notes: null,
            group_id: null,
            google_event_id: null,
            google_sync_status: 'not_synced',
            created_at: '2026-04-01T00:00:00Z',
            updated_at: '2026-04-01T00:00:00Z',
            students: { name: 'João' },
        },
        error: null,
    }
}

describe('syncCreateAppointment', () => {
    it('skipped quando trainer não tem conexão Google', async () => {
        resetChain()
        primeRule()
        mockGetFreshAccessToken.mockResolvedValueOnce(null)
        const out = await syncCreateAppointment('ra-1')
        expect(out.skipped).toBe(true)
        expect(out.synced).toBe(false)
    })

    it('synced quando a API responde rápido com id', async () => {
        resetChain()
        primeRule()
        mockGetFreshAccessToken.mockResolvedValueOnce({
            accessToken: 'at',
            calendarId: 'cal-1',
        })
        mockCreateEvent.mockResolvedValueOnce({
            ok: true,
            data: { id: 'evt-1' },
        })
        const out = await syncCreateAppointment('ra-1')
        expect(out.synced).toBe(true)
    })

    it('marca revoked e retorna error em 401', async () => {
        resetChain()
        primeRule()
        mockGetFreshAccessToken.mockResolvedValueOnce({
            accessToken: 'at',
            calendarId: 'cal-1',
        })
        mockCreateEvent.mockResolvedValueOnce({
            ok: false,
            status: 401,
            kind: 'unauthorized',
            message: 'invalid credentials',
        })
        const out = await syncCreateAppointment('ra-1')
        expect(out.error).toBe(true)
        expect(mockMarkRevoked).toHaveBeenCalled()
    })
})

describe('syncUpdateAppointment', () => {
    it('fallback pra create quando não há google_event_id', async () => {
        resetChain()
        primeRule()
        // 2 chamadas a getFreshAccessToken (update + create em cascata)
        mockGetFreshAccessToken.mockResolvedValue({
            accessToken: 'at',
            calendarId: 'cal-1',
        })
        mockCreateEvent.mockResolvedValueOnce({
            ok: true,
            data: { id: 'evt-new' },
        })
        await syncUpdateAppointment('ra-1')
        // O importante é ter caído no caminho de create
        expect(mockCreateEvent).toHaveBeenCalled()
    })
})

describe('syncDeleteAppointment', () => {
    it('skipped quando rotina não tem google_event_id', async () => {
        resetChain()
        chainResponses.select = {
            data: { trainer_id: 't-1', google_event_id: null },
            error: null,
        }
        mockGetFreshAccessToken.mockResolvedValueOnce({
            accessToken: 'at',
            calendarId: 'cal-1',
        })
        const out = await syncDeleteAppointment('ra-1')
        expect(out.skipped).toBe(true)
    })

    it('404 no Google é tratado como sucesso', async () => {
        resetChain()
        chainResponses.select = {
            data: { trainer_id: 't-1', google_event_id: 'evt-1' },
            error: null,
        }
        mockGetFreshAccessToken.mockResolvedValueOnce({
            accessToken: 'at',
            calendarId: 'cal-1',
        })
        mockDeleteEvent.mockResolvedValueOnce({
            ok: false,
            status: 404,
            kind: 'not_found',
            message: 'Not Found',
        })
        const out = await syncDeleteAppointment('ra-1')
        expect(out.synced).toBe(true)
    })
})
