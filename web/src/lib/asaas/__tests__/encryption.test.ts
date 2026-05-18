import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptApiKey, encryptApiKey } from '../encryption'

const TEST_KEY_B64 = Buffer.alloc(32, 7).toString('base64') // 32 bytes of 0x07

describe('encryption (AES-256-GCM)', () => {
    let originalKey: string | undefined

    beforeEach(() => {
        originalKey = process.env.ASAAS_ENCRYPTION_KEY
        process.env.ASAAS_ENCRYPTION_KEY = TEST_KEY_B64
    })

    afterEach(() => {
        if (originalKey === undefined) delete process.env.ASAAS_ENCRYPTION_KEY
        else process.env.ASAAS_ENCRYPTION_KEY = originalKey
    })

    it('roundtrips a string through encrypt/decrypt', () => {
        const plaintext = 'sk_asaas_super_secret_123!@#'
        const blob = encryptApiKey(plaintext)
        expect(Buffer.isBuffer(blob)).toBe(true)
        expect(blob.length).toBeGreaterThan(plaintext.length)
        const decrypted = decryptApiKey(blob)
        expect(decrypted).toBe(plaintext)
    })

    it('produces different ciphertexts on each call (random IV)', () => {
        const plaintext = 'abc'
        const a = encryptApiKey(plaintext)
        const b = encryptApiKey(plaintext)
        expect(a.equals(b)).toBe(false)
        expect(decryptApiKey(a)).toBe(plaintext)
        expect(decryptApiKey(b)).toBe(plaintext)
    })

    it('rejects a tampered ciphertext (auth tag mismatch)', () => {
        const blob = encryptApiKey('hello')
        // Flip a byte in the ciphertext portion (after iv+tag)
        const tampered = Buffer.from(blob)
        tampered[tampered.length - 1] ^= 0x01
        expect(() => decryptApiKey(tampered)).toThrow()
    })

    it('throws when ASAAS_ENCRYPTION_KEY is missing', () => {
        delete process.env.ASAAS_ENCRYPTION_KEY
        expect(() => encryptApiKey('x')).toThrow(/ASAAS_ENCRYPTION_KEY/)
    })

    it('throws when ASAAS_ENCRYPTION_KEY is not 32 bytes', () => {
        process.env.ASAAS_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64')
        expect(() => encryptApiKey('x')).toThrow(/32 bytes/)
    })
})
