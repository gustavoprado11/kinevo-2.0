import { describe, it, expect } from 'vitest'
import { buildDraftContext } from './student-context'

// Chainable Supabase-query stub: any method returns the same proxy (so .select,
// .eq, .gte, .in, .order, .limit, .maybeSingle all chain), and the proxy is
// thenable — awaiting it (or a terminal call) resolves to the table's result.
function chain(result: unknown) {
    const p = Promise.resolve(result)
    const proxy: unknown = new Proxy(function () {}, {
        get(_t, prop) {
            if (prop === 'then') return p.then.bind(p)
            if (prop === 'catch') return p.catch.bind(p)
            if (prop === 'finally') return p.finally.bind(p)
            return () => proxy
        },
    })
    return proxy
}

function makeAdmin(tables: Record<string, unknown>) {
    return {
        from: (table: string) => {
            if (!(table in tables)) throw new Error(`unexpected table: ${table}`)
            return chain({ data: tables[table], error: null })
        },
    } as never
}

const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

describe('buildDraftContext', () => {
    it('retorna null quando o aluno não pertence ao treinador', async () => {
        const admin = makeAdmin({ students: null })
        const ctx = await buildDraftContext(admin, TRAINER_ID, STUDENT_ID)
        expect(ctx).toBeNull()
    })

    it('computa frequência, RPE médio e dias desde o último treino', async () => {
        const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        const older = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
        const admin = makeAdmin({
            students: { id: STUDENT_ID, name: 'João' },
            workout_sessions: [
                { completed_at: recent, rpe: 8 },
                { completed_at: older, rpe: 7 },
            ],
            form_submissions: [
                {
                    trigger_context: 'post_workout',
                    submitted_at: recent,
                    answers_json: { energia: 2 },
                    form_templates: { title: 'Check-in pós-treino' },
                },
            ],
        })

        const ctx = await buildDraftContext(admin, TRAINER_ID, STUDENT_ID)
        expect(ctx).not.toBeNull()
        expect(ctx!.studentName).toBe('João')
        expect(ctx!.sessionsLast30d).toBe(2)
        expect(ctx!.avgRpe).toBe(7.5)
        expect(ctx!.lastSessionAt).toBe(recent)
        expect(ctx!.daysSinceLast).toBe(5)
        expect(ctx!.checkins).toHaveLength(1)
        expect(ctx!.checkins[0].formTitle).toBe('Check-in pós-treino')
        expect(ctx!.hasData).toBe(true)
    })

    it('marca hasData=false e nulls quando não há sessões nem check-ins', async () => {
        const admin = makeAdmin({
            students: { id: STUDENT_ID, name: 'Maria' },
            workout_sessions: [],
            form_submissions: [],
        })
        const ctx = await buildDraftContext(admin, TRAINER_ID, STUDENT_ID)
        expect(ctx!.hasData).toBe(false)
        expect(ctx!.avgRpe).toBeNull()
        expect(ctx!.daysSinceLast).toBeNull()
        expect(ctx!.lastSessionAt).toBeNull()
    })

    it('ignora RPE nulo no cálculo da média', async () => {
        const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        const admin = makeAdmin({
            students: { id: STUDENT_ID, name: 'Ana' },
            workout_sessions: [
                { completed_at: recent, rpe: 10 },
                { completed_at: recent, rpe: null },
            ],
            form_submissions: [],
        })
        const ctx = await buildDraftContext(admin, TRAINER_ID, STUDENT_ID)
        expect(ctx!.avgRpe).toBe(10)
        expect(ctx!.sessionsLast30d).toBe(2)
        expect(ctx!.hasData).toBe(true)
    })
})
