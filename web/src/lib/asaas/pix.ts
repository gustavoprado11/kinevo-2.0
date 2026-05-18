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
 *
 * NOTE: o valor recebido é normalizado antes de bater na Asaas (E.164 pra
 * telefone, apenas dígitos pra CPF/CNPJ). Isso evita 400s comuns por causa
 * de formatação que o usuário deixou.
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
                pixAddressKey: normalizePixKey(pixKey, keyType),
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
 *
 * Aceita os formatos comuns que o usuário digita (com ou sem pontuação,
 * com ou sem DDI). A normalização final pra Asaas acontece em
 * `normalizePixKey` antes do request.
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
        case 'PHONE': {
            // Aceita celular/fixo brasileiro com ou sem DDI 55. Exemplos válidos:
            //   31999064997        (DDD + celular, 11 dígitos)
            //   (31) 99906-4997    (com pontuação)
            //   +5531999064997     (E.164)
            //   5531999064997      (DDI + DDD + celular, sem +)
            //   1133334444         (DDD + fixo 8 dígitos = 10 dígitos)
            const digits = trimmed.replace(/\D/g, '')
            return /^(55)?\d{10,11}$/.test(digits)
        }
        case 'EVP':
            // chave aleatória — UUID v4
            return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
        default:
            return false
    }
}

/**
 * Normaliza a chave pro formato que a Asaas/BACEN esperam.
 *
 * - CPF/CNPJ: só dígitos
 * - PHONE:   E.164 (+55DDDNUMERO)
 * - EMAIL:   lowercase + trim
 * - EVP:     lowercase + trim
 */
export function normalizePixKey(key: string, type: PixKeyType): string {
    const trimmed = key.trim()
    switch (type) {
        case 'CPF':
        case 'CNPJ':
            return trimmed.replace(/\D/g, '')
        case 'PHONE': {
            const digits = trimmed.replace(/\D/g, '')
            // Já tem DDI 55? Mantém. Caso contrário, prepende.
            const withDdi = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
            return `+${withDdi}`
        }
        case 'EMAIL':
            return trimmed.toLowerCase()
        case 'EVP':
            return trimmed.toLowerCase()
        default:
            return trimmed
    }
}
