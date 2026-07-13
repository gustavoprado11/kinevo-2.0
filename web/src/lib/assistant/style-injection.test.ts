// A injeção do estilo no prompt de build — o elo entre "o treinador configurou" e
// "o assistente prescreve assim". O que o LLM FAZ com o bloco é assunto dos evals
// (RUN_EVALS=1); aqui travamos o que é determinístico: o bloco certo, na hora certa.

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadStyleBlock } from './style-block'

/** Stub mínimo: admin.from('trainers').select(...).eq(...).single() */
function fakeAdmin(prescriptionStyle: unknown): SupabaseClient {
    const single = vi.fn().mockResolvedValue({ data: { prescription_style: prescriptionStyle } })
    return {
        from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
    } as unknown as SupabaseClient
}

describe('loadStyleBlock', () => {
    it('sem estilo configurado, não injeta nada (o assistente segue o playbook)', async () => {
        expect(await loadStyleBlock(fakeAdmin(null), 't1')).toBe('')
    })

    it('com estilo, injeta o bloco delimitado com os valores do treinador', async () => {
        const block = await loadStyleBlock(
            fakeAdmin({
                version: 1,
                source: 'hybrid',
                reps_compound: '5–8',
                rest_compound_seconds: { min: 150, max: 150 },
                splits_by_frequency: { '5': 'PPL (push/pull/legs)' },
                methods_used: ['drop_set'],
            }),
            't1',
        )

        expect(block).toContain('<<ESTILO_DO_TREINADOR>>')
        expect(block).toContain('compostos 5–8')
        expect(block).toContain('compostos 150s')
        expect(block).toContain('5x/sem → PPL (push/pull/legs)')
        expect(block).toContain('Drop-set')
    })

    it('estilo gravado ACIMA do teto é clampado na leitura, não só no save', async () => {
        // Defesa em profundidade: um estilo escrito direto no banco (ou por uma versão
        // anterior) não pode fazer o assistente prescrever 40 séries/semana.
        const block = await loadStyleBlock(
            fakeAdmin({ version: 1, source: 'interview', weekly_sets_emphasized: { min: 30, max: 40 } }),
            't1',
        )
        expect(block).toContain('enfatizado 20')
        expect(block).not.toContain('40')
    })

    it('falha de leitura não derruba o turno — só prescreve sem estilo', async () => {
        const broken = {
            from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.reject(new Error('db down')) }) }) }),
        } as unknown as SupabaseClient
        expect(await loadStyleBlock(broken, 't1')).toBe('')
    })
})
