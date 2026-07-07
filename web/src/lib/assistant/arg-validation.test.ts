import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateConfirmArgs } from './arg-validation'

// Stub encadeável: qualquer método retorna o mesmo proxy (select/eq/maybeSingle
// encadeiam) e o proxy é thenable — await resolve no resultado da tabela.
function chain(result: unknown) {
    const p = Promise.resolve(result)
    const proxy: unknown = new Proxy(function () {}, {
        get(_t, prop) {
            if (prop === 'then') return p.then.bind(p)
            if (prop === 'catch') return p.catch.bind(p)
            if (prop === 'finally') return p.finally.bind(p)
            return () => proxy
        },
        apply() {
            return proxy
        },
    })
    return proxy
}

/** admin mockado: mapeia tabela → resultado ({ data }). */
function makeAdmin(byTable: Record<string, { data: unknown }>): SupabaseClient {
    return {
        from: (t: string) => chain(byTable[t] ?? { data: null }),
    } as unknown as SupabaseClient
}

const T = 't1' // trainerId

describe('validateConfirmArgs — convert_lead', () => {
    it('ok: lead do treinador, não convertido → alvo = nome', async () => {
        const admin = makeAdmin({
            trainer_leads: { data: { name: 'Ana', trainer_id: T, converted_to_student_id: null } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_convert_lead', { lead_id: 'l1' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.target?.label).toBe('Ana')
    })

    it('bloqueia: lead já convertido', async () => {
        const admin = makeAdmin({
            trainer_leads: { data: { name: 'Ana', trainer_id: T, converted_to_student_id: 's9' } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_convert_lead', { lead_id: 'l1' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/convertido/i)
    })

    it('bloqueia: lead de outro treinador', async () => {
        const admin = makeAdmin({
            trainer_leads: { data: { name: 'Ana', trainer_id: 'outro', converted_to_student_id: null } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_convert_lead', { lead_id: 'l1' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/não é seu|não encontrado/i)
    })
})

describe('validateConfirmArgs — contratos', () => {
    it('cancel: bloqueia contrato já cancelado', async () => {
        const admin = makeAdmin({
            student_contracts: { data: { trainer_id: T, student_id: 's1', amount: 199, status: 'canceled' } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_cancel_contract', { contract_id: 'c1' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/já está cancelado/i)
    })

    it('mark_paid: ok → alvo com nome do aluno e valor', async () => {
        const admin = makeAdmin({
            student_contracts: { data: { trainer_id: T, student_id: 's1', amount: 199, status: 'active' } },
            students: { data: { name: 'Pedro' } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_mark_payment_as_paid', { contract_id: 'c1' })
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.target?.label).toMatch(/Pedro/)
            expect(r.target?.label).toMatch(/R\$/)
        }
    })

    it('mark_paid: bloqueia contrato de outro treinador', async () => {
        const admin = makeAdmin({
            student_contracts: { data: { trainer_id: 'outro', student_id: 's1', amount: 199, status: 'active' } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_mark_payment_as_paid', { contract_id: 'c1' })
        expect(r.ok).toBe(false)
    })

    it('create: bloqueia quando o aluno não é da carteira', async () => {
        const admin = makeAdmin({ students: { data: null } })
        const r = await validateConfirmArgs(admin, T, 'kinevo_create_contract', {
            student_id: 's1',
            billing_type: 'manual_recurring',
            plan_id: 'p1',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/aluno/i)
    })
})

describe('validateConfirmArgs — sem validador estrito', () => {
    it('tool destrutiva de treino libera com target null (posse checada na execução)', async () => {
        const admin = makeAdmin({})
        const r = await validateConfirmArgs(admin, T, 'kinevo_delete_workout_item', { item_id: 'i1' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.target).toBeNull()
    })
})

/** admin p/ send_message: `maybeSingle` → destinatário; await da lista → roster. */
function makeSendMsgAdmin(recipientName: string | null, roster: Array<{ name: string }>): SupabaseClient {
    const single = { data: recipientName ? { name: recipientName } : null }
    const pList = Promise.resolve({ data: roster })
    const proxy: unknown = new Proxy(function () {}, {
        get(_t, prop) {
            if (prop === 'maybeSingle') return () => Promise.resolve(single)
            if (prop === 'then') return pList.then.bind(pList)
            if (prop === 'catch') return pList.catch.bind(pList)
            if (prop === 'finally') return pList.finally.bind(pList)
            return () => proxy
        },
        apply() {
            return proxy
        },
    })
    return { from: () => proxy } as unknown as SupabaseClient
}

describe('validateConfirmArgs — send_message (guardrail anti-destinatário-errado)', () => {
    const roster = [{ name: 'Gustavo Prado' }, { name: 'Giovanna Prado' }, { name: 'Marina Lanza' }]

    it('BLOQUEIA: mensagem endereçada a "Gustavo" mas o destinatário é Giovanna', async () => {
        const admin = makeSendMsgAdmin('Giovanna Prado', roster)
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_message', {
            student_id: 's-gi',
            content: 'Gustavo, bora treinar hoje? Tô aqui pra te apoiar.',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/Gustavo[\s\S]*destinat|não bate/i)
    })

    it('OK: a mensagem cita o próprio destinatário (Marina)', async () => {
        const admin = makeSendMsgAdmin('Marina Lanza', roster)
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_message', {
            student_id: 's-ma',
            content: 'Oi Marina! Senti sua falta, bora retomar?',
        })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.target?.details?.recipientName).toBe('Marina Lanza')
    })

    it('OK: saudação genérica sem citar outro aluno NÃO bloqueia', async () => {
        const admin = makeSendMsgAdmin('Giovanna Prado', roster)
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_message', {
            student_id: 's-gi',
            content: 'Bora treinar hoje! Tô aqui pra te apoiar.',
        })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.target?.details?.recipientName).toBe('Giovanna Prado')
    })

    it('BLOQUEIA (A2): aluno que não é da carteira → motivo tipado, não fail-open', async () => {
        const admin = makeSendMsgAdmin(null, roster)
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_message', {
            student_id: 's-de-outro-treinador',
            content: 'Oi! Bora treinar?',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/não encontrado/i)
    })

    it('BLOQUEIA (A2): sem student_id → motivo tipado', async () => {
        const admin = makeSendMsgAdmin(null, roster)
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_message', {
            content: 'Oi! Bora treinar?',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/faltou indicar/i)
    })
})

describe('validateConfirmArgs — posse estrita nas ações externas (A2)', () => {
    it('send_form: BLOQUEIA lote com id de aluno estranho', async () => {
        const admin = makeAdmin({
            students: { data: [{ id: 's1' }] }, // só 1 dos 2 ids pertence ao treinador
            form_templates: { data: { title: 'Check-in' } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_form', {
            template_id: 'tpl1',
            student_ids: ['s1', 's-estranho'],
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/não pertencem/i)
    })

    it('send_form: OK quando todos os alunos são da carteira', async () => {
        const admin = makeAdmin({
            students: { data: [{ id: 's1' }, { id: 's2' }] },
            form_templates: { data: { title: 'Check-in' } },
        })
        const r = await validateConfirmArgs(admin, T, 'kinevo_send_form', {
            template_id: 'tpl1',
            student_ids: ['s1', 's2'],
        })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.target?.label).toMatch(/2 alunos/)
    })

    it('checkout_link: BLOQUEIA aluno que não é da carteira', async () => {
        const admin = makeAdmin({ students: { data: null } })
        const r = await validateConfirmArgs(admin, T, 'kinevo_generate_checkout_link', {
            student_id: 's-estranho',
            plan_id: 'p1',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/não encontrado/i)
    })
})
