import { describe, expect, it } from 'vitest'
import { isPixKeyFormatValid } from '../pix'

describe('isPixKeyFormatValid', () => {
    it('accepts a valid CPF (com e sem pontuação)', () => {
        // isPixKeyFormatValid valida o dígito verificador, não só o tamanho —
        // a Asaas rejeitaria CPF inválido de qualquer forma. Fixtures válidos:
        expect(isPixKeyFormatValid('529.982.247-25', 'CPF')).toBe(true)
        expect(isPixKeyFormatValid('11144477735', 'CPF')).toBe(true)
    })

    it('rejects CPF with wrong length', () => {
        expect(isPixKeyFormatValid('123456', 'CPF')).toBe(false)
    })

    it('rejects CPF com dígito verificador inválido', () => {
        expect(isPixKeyFormatValid('123.456.789-00', 'CPF')).toBe(false)
        expect(isPixKeyFormatValid('000.000.000-00', 'CPF')).toBe(false)
    })

    it('accepts a valid CNPJ (com e sem pontuação)', () => {
        expect(isPixKeyFormatValid('11.222.333/0001-81', 'CNPJ')).toBe(true)
        expect(isPixKeyFormatValid('04252011000110', 'CNPJ')).toBe(true)
    })

    it('rejects CNPJ com dígito verificador inválido', () => {
        expect(isPixKeyFormatValid('11.222.333/0001-00', 'CNPJ')).toBe(false)
    })

    it('accepts valid email', () => {
        expect(isPixKeyFormatValid('joao@kinevo.com.br', 'EMAIL')).toBe(true)
    })

    it('rejects invalid email', () => {
        expect(isPixKeyFormatValid('joao', 'EMAIL')).toBe(false)
        expect(isPixKeyFormatValid('joao@', 'EMAIL')).toBe(false)
    })

    it('accepts BR phone numbers with optional +55', () => {
        expect(isPixKeyFormatValid('+5511987654321', 'PHONE')).toBe(true)
        expect(isPixKeyFormatValid('11987654321', 'PHONE')).toBe(true)
        expect(isPixKeyFormatValid('(11) 98765-4321', 'PHONE')).toBe(true)
    })

    it('accepts EVP (UUID v4)', () => {
        expect(isPixKeyFormatValid('123e4567-e89b-42d3-a456-426614174000', 'EVP')).toBe(true)
    })

    it('rejects EVP that is not a UUID', () => {
        expect(isPixKeyFormatValid('not-a-uuid', 'EVP')).toBe(false)
    })

    it('rejects empty input for any type', () => {
        expect(isPixKeyFormatValid('', 'CPF')).toBe(false)
        expect(isPixKeyFormatValid('   ', 'EMAIL')).toBe(false)
    })
})
