import { describe, it, expect } from 'vitest'
import {
    slugify,
    isReserved,
    isValidFormat,
    validateSlug,
    suggestVariations,
    SLUG_MIN_LENGTH,
    SLUG_MAX_LENGTH,
} from '../slug'

describe('slugify', () => {
    it('normaliza nome com acento', () => {
        expect(slugify('Gustavo Prado')).toBe('gustavo-prado')
        expect(slugify('João da Silva')).toBe('joao-da-silva')
        expect(slugify('Maria Conceição')).toBe('maria-conceicao')
    })

    it('colapsa hífens repetidos', () => {
        expect(slugify('Studio   Iron')).toBe('studio-iron')
        expect(slugify('a---b')).toBe('a-b')
    })

    it('remove caracteres especiais', () => {
        expect(slugify('Gustavo @ Prado!')).toBe('gustavo-prado')
        expect(slugify('coach/treinador')).toBe('coach-treinador')
    })

    it('remove hífens das pontas', () => {
        expect(slugify('  Gustavo  ')).toBe('gustavo')
        expect(slugify('-test-')).toBe('test')
    })

    it('respeita o limite máximo', () => {
        const long = 'a'.repeat(60)
        expect(slugify(long).length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    })

    it('lida com input vazio', () => {
        expect(slugify('')).toBe('')
        expect(slugify('   ')).toBe('')
        expect(slugify('!@#$%')).toBe('')
    })
})

describe('isReserved', () => {
    it('reconhece reservados clássicos', () => {
        expect(isReserved('admin')).toBe(true)
        expect(isReserved('api')).toBe(true)
        expect(isReserved('dashboard')).toBe(true)
        expect(isReserved('kinevo')).toBe(true)
        expect(isReserved('settings')).toBe(true)
    })

    it('é case-insensitive', () => {
        expect(isReserved('ADMIN')).toBe(true)
        expect(isReserved('Kinevo')).toBe(true)
    })

    it('libera slugs normais', () => {
        expect(isReserved('gustavo-prado')).toBe(false)
        expect(isReserved('studio-iron')).toBe(false)
    })
})

describe('isValidFormat', () => {
    it('aceita slugs válidos', () => {
        expect(isValidFormat('abc')).toBe(true)
        expect(isValidFormat('gustavo-prado')).toBe(true)
        expect(isValidFormat('studio-iron-2')).toBe(true)
        expect(isValidFormat('a1b2c3')).toBe(true)
    })

    it('rejeita slugs muito curtos', () => {
        expect(isValidFormat('ab')).toBe(false)
        expect(isValidFormat('')).toBe(false)
    })

    it('rejeita slugs muito longos', () => {
        expect(isValidFormat('a'.repeat(SLUG_MAX_LENGTH + 1))).toBe(false)
    })

    it('rejeita hífen nas pontas', () => {
        expect(isValidFormat('-gustavo')).toBe(false)
        expect(isValidFormat('gustavo-')).toBe(false)
    })

    it('rejeita maiúsculas', () => {
        expect(isValidFormat('Gustavo')).toBe(false)
        expect(isValidFormat('GUSTAVO')).toBe(false)
    })

    it('rejeita caracteres especiais', () => {
        expect(isValidFormat('gustavo_prado')).toBe(false)
        expect(isValidFormat('gustavo.prado')).toBe(false)
        expect(isValidFormat('gustavo@prado')).toBe(false)
    })
})

describe('validateSlug', () => {
    it('retorna valid:true em slug ok', () => {
        expect(validateSlug('gustavo-prado')).toEqual({ valid: true })
    })

    it('classifica reason corretamente', () => {
        expect(validateSlug('ab')).toEqual({ valid: false, reason: 'too_short' })
        expect(validateSlug('a'.repeat(50))).toEqual({ valid: false, reason: 'too_long' })
        expect(validateSlug('-gustavo')).toEqual({ valid: false, reason: 'invalid_format' })
        expect(validateSlug('admin')).toEqual({ valid: false, reason: 'reserved' })
    })

    it('encadeia precedência: too_short antes de invalid_format', () => {
        expect(validateSlug('-a')).toEqual({ valid: false, reason: 'too_short' })
    })
})

describe('suggestVariations', () => {
    it('sugere com cidade quando disponível', () => {
        const result = suggestVariations('gustavo', 'Belo Horizonte', 3)
        expect(result).toContain('gustavo-belo-horizonte')
    })

    it('sugere com número quando sem cidade', () => {
        const result = suggestVariations('pedro', undefined, 3)
        expect(result).toEqual(['pedro-2', 'pedro-3', 'pedro-4'])
    })

    it('limita ao count', () => {
        const result = suggestVariations('ana', undefined, 2)
        expect(result.length).toBeLessThanOrEqual(2)
    })

    it('retorna vazio se base for inválida', () => {
        expect(suggestVariations('', undefined, 3)).toEqual([])
        expect(suggestVariations('!@#', undefined, 3)).toEqual([])
    })

    it('não sugere reservados', () => {
        // "admin" é reservado, mas o número torna válido: admin-2 não está na lista
        const result = suggestVariations('admin', undefined, 3)
        expect(result).not.toContain('admin')
        expect(result.length).toBeGreaterThan(0)
    })
})
