import { describe, expect, it } from 'vitest'
import { isPixKeyFormatValid } from '../pix'

describe('isPixKeyFormatValid', () => {
    it('accepts CPF with 11 digits', () => {
        expect(isPixKeyFormatValid('000.000.000-00', 'CPF')).toBe(true) // dummy fixture, never a real CPF
        expect(isPixKeyFormatValid('12345678900', 'CPF')).toBe(true)
    })

    it('rejects CPF with wrong length', () => {
        expect(isPixKeyFormatValid('123456', 'CPF')).toBe(false)
    })

    it('accepts CNPJ with 14 digits', () => {
        expect(isPixKeyFormatValid('00.000.000/0000-00', 'CNPJ')).toBe(true) // dummy fixture, never a real CNPJ
        expect(isPixKeyFormatValid('12345678000190', 'CNPJ')).toBe(true)
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
