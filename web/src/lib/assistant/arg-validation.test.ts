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
