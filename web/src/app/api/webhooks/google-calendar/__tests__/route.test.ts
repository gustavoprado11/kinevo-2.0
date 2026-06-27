import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseAdminStub, type SupabaseAdminStub } from '@/test/supabase-admin-stub'

// Holder mutável pro stub (factories de vi.mock são hoisted).
const h = vi.hoisted(() => ({
    stub: null as unknown as {
        from: (table: string) => unknown
        rpc: (fn: string, args?: unknown) => Promise<unknown>
    },
}))

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (table: string) => h.stub.from(table),
        rpc: (fn: string, args?: unknown) => h.stub.rpc(fn, args),
    },
}))

vi.mock('@/lib/google-calendar/token-refresh', () => ({
    getFreshAccessToken: vi.fn(),
}))
vi.mock('@/lib/google-calendar/client', () => ({
    listUpdatedEvents: vi.fn(),
}))

import { getFreshAccessToken } from '@/lib/google-calendar/token-refresh'
import { POST } from '../route'

const getFreshMock = vi.mocked(getFreshAccessToken)

const CHANNEL = 'chan-123'
const TRAINER = 'trainer-1'

function makeRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest('http://localhost/api/webhooks/google-calendar', {
        method: 'POST',
        headers,
    })
}

describe('POST /api/webhooks/google-calendar — channel token validation', () => {
    let stub: SupabaseAdminStub
    beforeEach(() => {
        vi.clearAllMocks()
        stub = createSupabaseAdminStub()
        h.stub = stub
        // A busca da conexão pelo channel id devolve um trainer conhecido.
        stub.onQuery((q) => {
            if (q.table === 'google_calendar_connections' && q.op === 'select') {
                return { data: { trainer_id: TRAINER, calendar_id: 'cal-1', last_sync_at: null } }
            }
            return undefined
        })
        getFreshMock.mockResolvedValue(null)
    })

    it('rejects when the X-Goog-Channel-Token header is ABSENT (the hole)', async () => {
        const res = await POST(makeRequest({
            'x-goog-channel-id': CHANNEL,
            'x-goog-resource-state': 'exists',
            // sem x-goog-channel-token
        }))
        expect(await res.json()).toEqual({ ok: true, ignored: 'token mismatch' })
        // Não passou da validação: nada de buscar credenciais nem processar.
        expect(getFreshMock).not.toHaveBeenCalled()
    })

    it('rejects when the token does not match the trainer_id', async () => {
        const res = await POST(makeRequest({
            'x-goog-channel-id': CHANNEL,
            'x-goog-resource-state': 'exists',
            'x-goog-channel-token': 'wrong-token',
        }))
        expect(await res.json()).toEqual({ ok: true, ignored: 'token mismatch' })
        expect(getFreshMock).not.toHaveBeenCalled()
    })

    it('proceeds past token validation when the token matches the trainer_id', async () => {
        const res = await POST(makeRequest({
            'x-goog-channel-id': CHANNEL,
            'x-goog-resource-state': 'exists',
            'x-goog-channel-token': TRAINER,
        }))
        // Passou da validação → tentou buscar credenciais (mock devolve null).
        expect(getFreshMock).toHaveBeenCalledWith(TRAINER)
        expect(await res.json()).toEqual({ ok: true, ignored: 'no active connection' })
    })
})
