import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks must be declared before import of the route handler.
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}))
vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}))
vi.mock('@/lib/student-notifications', () => ({
    insertStudentNotification: vi.fn(),
}))
vi.mock('@/lib/push-notifications', () => ({
    sendStudentPush: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn(() => ({ allowed: true })),
    recordRequest: vi.fn(),
}))

import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'
import { checkRateLimit } from '@/lib/rate-limit'
import { POST } from './route'

const sbCreate = vi.mocked(supabaseCreateClient)
const sbAdmin = vi.mocked(supabaseAdmin)
const insertMock = vi.mocked(insertStudentNotification)
const sendMock = vi.mocked(sendStudentPush)
const rateMock = vi.mocked(checkRateLimit)

const TRAINER_AUTH_UID = '00000000-0000-4000-8000-000000000001'
const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
    const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    }
    return new NextRequest('http://localhost/api/messages/notify-student', init as any)
}

function makeAuthClient(user: { id: string } | null, error: unknown = null) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
        },
    } as any
}

// Build a fluent admin chain:
//   supabaseAdmin.from('trainers').select('...').eq('auth_user_id', X).single()
//   supabaseAdmin.from('students').select('...').eq('id', Y).eq('coach_id', Z).single()
function stubAdmin(handlers: {
    trainer?: { id: string; name: string | null } | null
    student?: { id: string } | null
}) {
    sbAdmin.from.mockImplementation((table: string) => {
        if (table === 'trainers') {
            return {
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: handlers.trainer ?? null, error: null }),
                    }),
                }),
            } as any
        }
        if (table === 'students') {
            return {
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: handlers.student ?? null, error: null }),
                        }),
                    }),
                }),
            } as any
        }
        throw new Error(`unexpected table: ${table}`)
    })
}

describe('POST /api/messages/notify-student', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        rateMock.mockReturnValue({ allowed: true } as any)
        insertMock.mockResolvedValue('inbox-id-42')
        sendMock.mockResolvedValue(undefined)
    })

    it('returns 401 when Authorization header is absent', async () => {
        const res = await POST(makeRequest({ studentId: STUDENT_ID }))
        expect(res.status).toBe(401)
    })

    it('returns 401 when the Bearer token is invalid', async () => {
        sbCreate.mockReturnValue(makeAuthClient(null, { message: 'jwt expired' }))
        const res = await POST(
            makeRequest({ studentId: STUDENT_ID }, { Authorization: 'Bearer bad' }),
        )
        expect(res.status).toBe(401)
    })

    it('returns 400 when studentId is missing', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        const res = await POST(makeRequest({}, { Authorization: 'Bearer good' }))
        expect(res.status).toBe(400)
    })

    it('returns 400 when studentId is not a UUID', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        const res = await POST(
            makeRequest({ studentId: 'not-a-uuid' }, { Authorization: 'Bearer good' }),
        )
        expect(res.status).toBe(400)
    })

    it('returns 403 when the auth user is not a trainer', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        stubAdmin({ trainer: null })
        const res = await POST(
            makeRequest({ studentId: STUDENT_ID }, { Authorization: 'Bearer good' }),
        )
        expect(res.status).toBe(403)
    })

    it('returns 403 when the student is not coached by this trainer', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        stubAdmin({
            trainer: { id: TRAINER_ID, name: 'Coach Foo' },
            student: null,
        })
        const res = await POST(
            makeRequest({ studentId: STUDENT_ID }, { Authorization: 'Bearer good' }),
        )
        expect(res.status).toBe(403)
    })

    it('returns 429 when rate-limited', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        rateMock.mockReturnValue({ allowed: false, error: 'slow down' } as any)
        const res = await POST(
            makeRequest({ studentId: STUDENT_ID }, { Authorization: 'Bearer good' }),
        )
        expect(res.status).toBe(429)
    })

    it('returns 200 on happy path and calls insert + push with symmetric shape', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        stubAdmin({
            trainer: { id: TRAINER_ID, name: 'Coach Foo' },
            student: { id: STUDENT_ID },
        })

        const res = await POST(
            makeRequest(
                { studentId: STUDENT_ID, messageContent: 'vamos começar a sessão' },
                { Authorization: 'Bearer good' },
            ),
        )

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({ success: true })

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                studentId: STUDENT_ID,
                trainerId: TRAINER_ID,
                type: 'text_message',
                title: 'Nova mensagem de Coach Foo',
                subtitle: 'Coach Foo: vamos começar a sessão',
                payload: { trainer_id: TRAINER_ID, trainer_name: 'Coach Foo' },
            }),
        )

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                studentId: STUDENT_ID,
                title: 'Nova mensagem de Coach Foo',
                body: 'vamos começar a sessão',
                inboxItemId: 'inbox-id-42',
                data: expect.objectContaining({
                    type: 'text_message',
                    trainer_id: TRAINER_ID,
                    trainer_name: 'Coach Foo',
                }),
            }),
        )
    })

    it('falls back to "seu treinador" when trainer.name is null', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        stubAdmin({
            trainer: { id: TRAINER_ID, name: null },
            student: { id: STUDENT_ID },
        })

        const res = await POST(
            makeRequest(
                { studentId: STUDENT_ID, messageContent: 'oi' },
                { Authorization: 'Bearer good' },
            ),
        )
        expect(res.status).toBe(200)
        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Nova mensagem de seu treinador',
                subtitle: 'seu treinador: oi',
                payload: { trainer_id: TRAINER_ID, trainer_name: 'seu treinador' },
            }),
        )
    })

    it('truncates long message content to 100 chars + ellipsis in subtitle', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        stubAdmin({
            trainer: { id: TRAINER_ID, name: 'Coach' },
            student: { id: STUDENT_ID },
        })

        const long = 'a'.repeat(150)
        await POST(
            makeRequest(
                { studentId: STUDENT_ID, messageContent: long },
                { Authorization: 'Bearer good' },
            ),
        )

        const call = insertMock.mock.calls[0][0]
        expect(call.subtitle?.endsWith('...')).toBe(true)
        // 'Coach: ' (7) + 100 a's + '...' (3)
        expect(call.subtitle?.length).toBe(7 + 100 + 3)
    })

    it('uses "Enviou uma imagem" when messageContent is absent', async () => {
        sbCreate.mockReturnValue(makeAuthClient({ id: TRAINER_AUTH_UID }))
        stubAdmin({
            trainer: { id: TRAINER_ID, name: 'Coach' },
            student: { id: STUDENT_ID },
        })

        await POST(makeRequest({ studentId: STUDENT_ID }, { Authorization: 'Bearer good' }))

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: 'Enviou uma imagem' }),
        )
    })
})
