// ============================================================================
// Asaas — PIX key validation
// ============================================================================
// Validates a PIX key against the BACEN directory via Asaas. Returns owner
// name + bank so the UI can show "É a Maria mesmo?" antes de salvar.
// ============================================================================

import type { PixKeyType, PixKeyValidation } from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface PixValidationRaw {
    ownerName?: string
    ownerType?: 'NATURAL' | 'LEGAL'
    bank?: { name?: string; ispb?: string; code?: string }
    accountAgency?: string
    accountNumber?: string
}

/**
 * Validate a PIX key. Throws AsaasApiError when Asaas rejects the lookup
 * (chave inexistente). Returns owner info on success.
 *
 * Asaas charges a tiny fee per lookup, so cache the validated value for
 * 7 days client-side if you re-validate.
 */
export async function validatePixKey(
    subaccountApiKey: string,
    pixKey: string,
    keyType: PixKeyType
): Promise<PixKeyValidation> {
    try {
        const raw = await asaasRequest<PixValidationRaw>({
            apiKey: subaccountApiKey,
            method: 'POST',
            path: '/pix/addressKeys/validate',
            body: {
                pixAddressKey: pixKey.trim(),
                pixAddressKeyType: keyType,
            },
        })
        return {
            valid: true,
            ownerName: raw.ownerName,
            ownerType: raw.ownerType === 'LEGAL' ? 'PJ' : raw.ownerType === 'NATURAL' ? 'PF' : undefined,
            bankName: raw.bank?.name,
        }
    } catch {
        return { valid: false }
    }
}

/**
 * Quick local sanity check (format only — does NOT prove the key exists).
 * Use before calling Asaas to give the user faster feedback.
 */
export function isPixKeyFormatValid(key: string, type: PixKeyType): boolean {
    const trimmed = key.trim()
    if (!trimmed) return false
    switch (type) {
        case 'CPF':
            return /^\d{11}$/.test(trimmed.replace(/\D/g, ''))
        case 'CNPJ':
            return /^\d{14}$/.test(trimmed.replace(/\D/g, ''))
        case 'EMAIL':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
        case 'PHONE':
            return /^\+?55?\d{10,11}$/.test(trimmed.replace(/\D/g, ''))
        case 'EVP':
            // chave aleatória — UUID v4
            return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
        default:
            return false
    }
}
