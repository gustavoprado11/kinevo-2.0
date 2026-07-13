// O estilo é PROPOSTO por um LLM a partir de uma conversa: pode chegar com 40
// séries/semana, descanso de 20 minutos ou um método inventado. Estes testes são
// a fronteira que impede isso de virar prescrição.

import { describe, it, expect } from 'vitest'
import { buildStyleBlock, isStyleEmpty, sanitizeStyle } from './style-block'
import { STYLE_VOLUME_CEILINGS } from '@kinevo/shared/types/prescription'

const META = { source: 'interview' as const, mined: null }

describe('sanitizeStyle — tetos de volume (regra de segurança)', () => {
    it('clampa volume acima do teto do playbook', () => {
        const style = sanitizeStyle(
            {
                weekly_sets_emphasized: { min: 25, max: 40 },
                weekly_sets_principal: { min: 10, max: 30 },
                weekly_sets_small: { min: 2, max: 25 },
            },
            META,
        )

        expect(style.weekly_sets_emphasized).toEqual({ min: 20, max: 20 })
        expect(style.weekly_sets_principal).toEqual({ min: 10, max: STYLE_VOLUME_CEILINGS.principal.max })
        expect(style.weekly_sets_small).toEqual({ min: 4, max: STYLE_VOLUME_CEILINGS.small.max })
    })

    it('preserva volume dentro do teto', () => {
        const style = sanitizeStyle({ weekly_sets_emphasized: { min: 14, max: 18 } }, META)
        expect(style.weekly_sets_emphasized).toEqual({ min: 14, max: 18 })
    })

    it('faixa invertida é corrigida em vez de descartada', () => {
        const style = sanitizeStyle({ weekly_sets_principal: { min: 14, max: 8 } }, META)
        expect(style.weekly_sets_principal).toEqual({ min: 8, max: 14 })
    })

    it('faixa não-numérica vira null (sem preferência)', () => {
        const style = sanitizeStyle({ weekly_sets_emphasized: { min: 'muitas', max: null } }, META)
        expect(style.weekly_sets_emphasized).toBeNull()
    })
})

describe('sanitizeStyle — demais limites', () => {
    it('clampa exercícios por sessão em [3,10] e descansos em [20,300]s', () => {
        const style = sanitizeStyle(
            {
                exercises_per_session: { min: 1, max: 20 },
                rest_compound_seconds: { min: 5, max: 900 },
                rest_accessory_seconds: { min: 45, max: 60 },
            },
            META,
        )
        expect(style.exercises_per_session).toEqual({ min: 3, max: 10 })
        expect(style.rest_compound_seconds).toEqual({ min: 20, max: 300 })
        expect(style.rest_accessory_seconds).toEqual({ min: 45, max: 60 })
    })

    it('descarta method_key que não existe no catálogo', () => {
        const style = sanitizeStyle(
            { methods_used: ['drop_set', 'super_mega_set', 'cluster'], methods_avoided: ['5x5'] },
            META,
        )
        expect(style.methods_used).toEqual(['drop_set', 'cluster'])
        expect(style.methods_avoided).toEqual(['5x5'])
    })

    it('descarta "standard"/"custom" — não são métodos de estilo', () => {
        const style = sanitizeStyle({ methods_used: ['standard', 'custom', 'drop_set'] }, META)
        expect(style.methods_used).toEqual(['drop_set'])
    })

    it('trunca strings longas e limita arrays', () => {
        const style = sanitizeStyle(
            {
                notes: 'x'.repeat(500),
                avoided_exercises: Array.from({ length: 30 }, (_, i) => `Exercício ${i}`),
            },
            META,
        )
        expect(style.notes).toHaveLength(200)
        expect(style.avoided_exercises).toHaveLength(10)
    })

    it('só aceita frequências de split conhecidas', () => {
        const style = sanitizeStyle(
            { splits_by_frequency: { '3': 'Full-body A/B/C', '9': 'Nove vezes', bobagem: 'x' } },
            META,
        )
        expect(style.splits_by_frequency).toEqual({ '3': 'Full-body A/B/C' })
    })

    it('limita favoritos a 5 grupos × 4 exercícios', () => {
        const style = sanitizeStyle(
            {
                favorite_exercises: Array.from({ length: 8 }, (_, g) => ({
                    group: `Grupo ${g}`,
                    names: Array.from({ length: 9 }, (_, i) => `Ex ${i}`),
                })),
            },
            META,
        )
        expect(style.favorite_exercises).toHaveLength(5)
        expect(style.favorite_exercises[0].names).toHaveLength(4)
    })

    it('entrada lixo vira um estilo vazio, nunca um throw', () => {
        const style = sanitizeStyle('não sou um estilo', META)
        expect(style.version).toBe(1)
        expect(isStyleEmpty(style)).toBe(true)
    })
})

describe('buildStyleBlock', () => {
    const full = sanitizeStyle(
        {
            splits_by_frequency: { '5': 'PPL + Upper/Lower', '3': 'Full-body A/B/C' },
            reps_compound: '6–8',
            reps_accessory: '10–15',
            rest_compound_seconds: { min: 120, max: 180 },
            rest_accessory_seconds: { min: 45, max: 60 },
            weekly_sets_emphasized: { min: 14, max: 18 },
            methods_used: ['drop_set'],
            superset_usage: 'ocasional',
            favorite_exercises: [{ group: 'Costas', names: ['Remada curvada', 'Puxada neutra'] }],
            progression: 'dupla progressão',
        },
        META,
    )

    it('renderiza dentro dos delimitadores, com a régua de precedência', () => {
        const block = buildStyleBlock(full)
        expect(block).toContain('<<ESTILO_DO_TREINADOR>>')
        expect(block).toContain('<<FIM_ESTILO_DO_TREINADOR>>')
        expect(block).toContain('vence o estilo')
        expect(block).toContain('vencem TUDO')
    })

    it('ordena os splits por frequência e traduz o método', () => {
        const block = buildStyleBlock(full)
        expect(block).toContain('3x/sem → Full-body A/B/C; 5x/sem → PPL + Upper/Lower')
        expect(block).toContain('Drop-set')
        expect(block).not.toContain('drop_set')
    })

    it('omite os campos sem preferência (null)', () => {
        const block = buildStyleBlock(full)
        expect(block).not.toContain('Aquecimento:')
        expect(block).not.toContain('Públicos especiais:')
    })

    it('estilo vazio não gera bloco nenhum', () => {
        expect(buildStyleBlock(sanitizeStyle({}, META))).toBe('')
    })
})
