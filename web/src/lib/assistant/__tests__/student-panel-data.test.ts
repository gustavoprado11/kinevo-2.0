import { describe, it, expect } from 'vitest'
import { getStudentPanelData } from '../student-panel-data'

// Stub de query Supabase encadeável: qualquer método devolve o mesmo proxy (para
// .select/.eq/.in/.order/.limit/.maybeSingle encadearem) e o proxy é thenable —
// aguardá-lo resolve para o resultado da tabela. Espelha student-context.test.ts.
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

function makeClient(tables: Record<string, unknown>) {
    return {
        from: (table: string) => {
            if (!(table in tables)) throw new Error(`unexpected table: ${table}`)
            return chain({ data: tables[table], error: null })
        },
    } as never
}

const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'
// Quarta 2026-07-08 12:00 em São Paulo (semana seg 07-06 → dom 07-12).
const NOW = new Date('2026-07-08T15:00:00.000Z')
const OPTS = { now: NOW, timeZone: 'America/Sao_Paulo' as const }

describe('getStudentPanelData', () => {
    it('retorna null quando o aluno não pertence ao treinador (→ 404)', async () => {
        const sb = makeClient({ students: null })
        const payload = await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS)
        expect(payload).toBeNull()
    })

    it('monta o payload completo (programa, aderência, alerta, histórico, notas)', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'João', avatar_url: 'http://a', status: 'active', trainer_notes: 'Cuidar do joelho', coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [{
                id: 'p1', name: 'Hipertrofia 3x', current_week: 5, duration_weeks: 8, started_at: '2026-06-01',
                assigned_workouts: [{ scheduled_days: [1, 4] }, { scheduled_days: [2, 5] }], // expected = 4
            }],
            workout_sessions: [
                { id: 's2', completed_at: '2026-07-08T13:00:00Z', assigned_workouts: { name: 'Treino B' } }, // Hoje
                { id: 's1', completed_at: '2026-07-06T14:00:00Z', assigned_workouts: { name: 'Treino A' } }, // há 2 dias
            ],
            assistant_insights: [
                { id: 'i1', category: 'alert', priority: 'high', title: 'Estagnado em 4 exercícios', body: 'platô' },
            ],
        })

        const payload = await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS)
        expect(payload).not.toBeNull()
        const p = payload!

        expect(p.student).toEqual({ id: STUDENT_ID, name: 'João', avatarUrl: 'http://a', status: 'active' })
        expect(p.program).toEqual({ id: 'p1', name: 'Hipertrofia 3x', currentWeek: 5, durationWeeks: 8, startedAt: '2026-06-01' })
        expect(p.adherence).toEqual({ done: 2, expected: 4, pct: 50 })

        expect(p.alert).not.toBeNull()
        expect(p.alert!.insightId).toBe('i1')
        expect(p.alert!.kind).toBe('estagnado')
        expect(p.alert!.label).toBe('Estagnado em 4 exercícios')
        expect(p.alert!.prompt).toContain('João')

        expect(p.history).toEqual([
            { id: 's2', text: 'Treino B concluído', dateLabel: 'Hoje', completedAt: '2026-07-08T13:00:00Z' },
            { id: 's1', text: 'Treino A concluído', dateLabel: 'há 2 dias', completedAt: '2026-07-06T14:00:00Z' },
        ])
        expect(p.notes).toBe('Cuidar do joelho')
        expect(p.readOnly).toBe(false)
    })

    it('aluno sem programa ativo: program e adherence nulos, histórico ainda aparece', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Ana', avatar_url: null, status: 'active', trainer_notes: null, coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [],
            workout_sessions: [
                { id: 's1', completed_at: '2026-07-07T14:00:00Z', assigned_workouts: { name: 'Full body' } },
            ],
            assistant_insights: [],
        })

        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS))!
        expect(p.program).toBeNull()
        expect(p.adherence).toBeNull()
        expect(p.alert).toBeNull()
        expect(p.history).toHaveLength(1)
        expect(p.history[0].text).toBe('Full body concluído')
        expect(p.notes).toBeNull()
    })

    it('sem histórico: history vazio; com programa, aderência é done 0', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Bia', avatar_url: null, status: 'active', trainer_notes: '   ', coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [{
                id: 'p1', name: 'Base', current_week: 1, duration_weeks: 4, started_at: '2026-07-01',
                assigned_workouts: [{ scheduled_days: [1, 3, 5] }], // expected = 3
            }],
            workout_sessions: [],
            assistant_insights: [],
        })

        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS))!
        expect(p.history).toEqual([])
        expect(p.adherence).toEqual({ done: 0, expected: 3, pct: 0 })
        expect(p.notes).toBeNull() // trainer_notes só com espaços → escondido
    })

    it('programa ativo sem dias agendados: adherence null (esconde "0/0")', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Duda', avatar_url: null, status: 'active', trainer_notes: null, coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [{
                id: 'p1', name: 'Sem agenda', current_week: 1, duration_weeks: 4, started_at: '2026-07-01',
                assigned_workouts: [{ scheduled_days: [] }, { scheduled_days: null }], // expected = 0
            }],
            workout_sessions: [
                { id: 's1', completed_at: '2026-07-07T14:00:00Z', assigned_workouts: { name: 'Treino A' } },
            ],
            assistant_insights: [],
        })
        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS))!
        expect(p.program).not.toBeNull()
        expect(p.adherence).toBeNull()
    })

    it('readOnly é refletido no payload', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Léo', avatar_url: null, status: 'inactive', trainer_notes: null, coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [],
            workout_sessions: [],
            assistant_insights: [],
        })
        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, { ...OPTS, readOnly: true }))!
        expect(p.readOnly).toBe(true)
        expect(p.student.status).toBe('inactive')
    })

    it('escolhe o insight de maior prioridade (high > medium)', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Rui', avatar_url: null, status: 'active', trainer_notes: null, coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [],
            workout_sessions: [],
            assistant_insights: [
                { id: 'low1', category: 'summary', priority: 'medium', title: 'Resumo', body: '' },
                { id: 'hi1', category: 'progression', priority: 'high', title: 'Pronto p/ evoluir', body: '' },
            ],
        })
        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS))!
        expect(p.alert!.insightId).toBe('hi1')
        expect(p.alert!.kind).toBe('pronto_para_evoluir')
    })

    it('critical vence high na escolha do alerta', async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Zoe', avatar_url: null, status: 'active', trainer_notes: null, coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [],
            workout_sessions: [],
            assistant_insights: [
                { id: 'hi1', category: 'alert', priority: 'high', title: 'Sumiu dos treinos', body: '' },
                { id: 'cr1', category: 'alert', priority: 'critical', title: 'Dor reportada', body: '' },
            ],
        })
        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS))!
        expect(p.alert!.insightId).toBe('cr1')
    })

    it("insight de estagnação (key stagnation:*) é 'estagnado' mesmo com category progression", async () => {
        const sb = makeClient({
            students: { id: STUDENT_ID, name: 'Ivo', avatar_url: null, status: 'active', trainer_notes: null, coach_id: TRAINER_ID, organization_id: null },
            assigned_programs: [],
            workout_sessions: [],
            assistant_insights: [
                // O detector do cron grava estagnação com category='progression'
                // (pré-existente) — a insight_key é o contrato que corrige a leitura.
                { id: 'st1', category: 'progression', priority: 'high', title: 'Estagnado em 4 exercícios', body: '', insight_key: `stagnation:${STUDENT_ID}` },
            ],
        })
        const p = (await getStudentPanelData(sb, TRAINER_ID, STUDENT_ID, OPTS))!
        expect(p.alert!.kind).toBe('estagnado')
    })
})
