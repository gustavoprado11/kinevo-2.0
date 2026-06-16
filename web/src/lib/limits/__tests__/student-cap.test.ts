import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import {
    STUDENT_CAP,
    assertCanCreateStudent,
    assertCanDowngradeToFree,
    StudentCapError,
    StudentDowngradeError,
} from '../student-cap'

// Fake admin que devolve um count fixo para students.select(count).eq(coach_id)
function fakeAdmin(count: number, error: unknown = null): SupabaseClient<Database> {
    return {
        from: () => ({
            select: () => ({
                eq: () => Promise.resolve({ count, error }),
            }),
        }),
    } as unknown as SupabaseClient<Database>
}

describe('student-cap', () => {
    it('Free = 1; pago = ilimitado', () => {
        expect(STUDENT_CAP.free).toBe(1)
        expect(STUDENT_CAP.essencial).toBe(Infinity)
        expect(STUDENT_CAP.pro_ia).toBe(Infinity)
        expect(STUDENT_CAP.premium_ia).toBe(Infinity)
    })

    it('Free com 0 alunos permite criar o 1º (self-student)', async () => {
        await expect(assertCanCreateStudent(fakeAdmin(0), 't1', 'free')).resolves.toBeUndefined()
    })

    it('Free com 1 aluno bloqueia o 2º', async () => {
        await expect(assertCanCreateStudent(fakeAdmin(1), 't1', 'free')).rejects.toBeInstanceOf(
            StudentCapError,
        )
    })

    it('Pago libera mesmo com muitos alunos (sem nem contar)', async () => {
        await expect(assertCanCreateStudent(fakeAdmin(999), 't1', 'pro_ia')).resolves.toBeUndefined()
        await expect(assertCanCreateStudent(fakeAdmin(999), 't1', 'essencial')).resolves.toBeUndefined()
    })

    it('erro de contagem não bloqueia criação legítima', async () => {
        await expect(
            assertCanCreateStudent(fakeAdmin(0, { message: 'boom' }), 't1', 'free'),
        ).resolves.toBeUndefined()
    })

    it('downgrade→free: bloqueia com aluno real (>1), libera com ≤1', async () => {
        await expect(assertCanDowngradeToFree(fakeAdmin(2), 't1')).rejects.toBeInstanceOf(
            StudentDowngradeError,
        )
        await expect(assertCanDowngradeToFree(fakeAdmin(1), 't1')).resolves.toBeUndefined()
        await expect(assertCanDowngradeToFree(fakeAdmin(0), 't1')).resolves.toBeUndefined()
    })
})
