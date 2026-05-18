// ============================================================================
// Asaas — apiKey encryption helpers
// ============================================================================
// Each trainer's subaccount comes with its own apiKey. We store it
// encrypted-at-rest using AES-256-GCM with a key derived from
// ASAAS_ENCRYPTION_KEY (32 random bytes, base64-encoded).
//
// Generate ASAAS_ENCRYPTION_KEY with:   openssl rand -base64 32
//
// The output of encrypt() is a single base64 string: [iv|authTag|ciphertext].
// Persisted as BYTEA in trainer_payment_accounts.asaas_api_key_encrypted.
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12     // GCM standard
const TAG_LEN = 16

function getKey(): Buffer {
    const raw = process.env.ASAAS_ENCRYPTION_KEY
    if (!raw) {
        throw new Error(
            'ASAAS_ENCRYPTION_KEY is missing. Generate with: openssl rand -base64 32 ' +
            'and add to your environment. See docs/asaas-integration/SETUP.md.'
        )
    }
    const buf = Buffer.from(raw, 'base64')
    if (buf.length !== 32) {
        throw new Error(
            `ASAAS_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). ` +
            'Regenerate with: openssl rand -base64 32'
        )
    }
    return buf
}

/**
 * Encrypts a plaintext apiKey. Returns a Buffer suitable for BYTEA insert.
 */
export function encryptApiKey(plaintext: string): Buffer {
    const key = getKey()
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGO, key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // Layout: iv (12) | tag (16) | ciphertext
    return Buffer.concat([iv, tag, ciphertext])
}

/**
 * Decrypts an apiKey blob stored in BYTEA.
 */
export function decryptApiKey(blob: Buffer): string {
    if (blob.length < IV_LEN + TAG_LEN + 1) {
        throw new Error('Encrypted blob is too short to be valid')
    }
    const key = getKey()
    const iv = blob.subarray(0, IV_LEN)
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const ciphertext = blob.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
}
