// ============================================================================
// Asaas — PIX key validation
// ============================================================================
// Validates a PIX key against the BACEN directory via Asaas. Returns owner
// name + bank so the UI can show "É a Maria mesmo?" antes de salvar.
// ============================================================================

import type { PixKeyType, PixKeyValidation } from '@kinevo/shared/types/asaas'
import { asaasRequest, AsaasApiError } from './client'

interface PixValidationRaw {
    ownerName?: string
    ownerType?: 'NATURAL' | 'LEGAL'
    bank?: { name?: string; ispb?: string; code?: string }
    accountAgency?: string
    accountNumber?: string
}

/** Resultado estendido — inclui motivo real quando inválido. */
export interface PixKeyValidationExt extends PixKeyValidation {
    /** Mensagem literal da Asaas quando valid=false. Use pra dar feedback útil. */
    invalidReason?: string
    /** HTTP status retornado pela Asaas (200 quando ok). */
    asaasStatus?: number
}

/**
 * Validate a PIX key. Returns valid=true + owner info on success, or
 * valid=false + invalidReason (mensagem real da Asaas) on failure.
 *
 * Asaas charges a tiny fee per lookup. NOTE: o valor recebido é normalizado
 * antes de bater na Asaas (E.164 pra telefone, apenas dígitos pra CPF/CNPJ).
 */
export async function validatePixKey(
    subaccountApiKey: string,
    pixKey: string,
    keyType: PixKeyType
): Promise<PixKeyValidationExt> {
    const normalized = normalizePixKey(pixKey, keyType)
    try {
        const raw = await asaasRequest<PixValidationRaw>({
            apiKey: subaccountApiKey,
            method: 'POST',
            path: '/pix/addressKeys/validate',
            body: {
                pixAddressKey: normalized,
                pixAddressKeyType: keyType,
            },
        })
        return {
            valid: true,
            ownerName: raw.ownerName,
            ownerType: raw.ownerType === 'LEGAL' ? 'PJ' : raw.ownerType === 'NATURAL' ? 'PF' : undefined,
            bankName: raw.bank?.name,
            asaasStatus: 200,
        }
    } catch (err) {
        // Log server-side com detalhes pra diagnóstico (status + body)
        if (err instanceof AsaasApiError) {
            console.error('[validatePixKey] Asaas rejected:', {
                status: err.status,
                message: err.message,
                body: typeof err.body === 'object' ? JSON.stringify(err.body) : err.body,
                keyType,
                keyPrefix: normalized.slice(0, 4),
            })
            return {
                valid: false,
                invalidReason: err.message,
                asaasStatus: err.status,
            }
        }
        console.error('[validatePixKey] Unexpected error:', err)
        return {
            valid: false,
            invalidReason: err instanceof Error ? err.message : 'Erro desconhecido',
        }
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
            return isValidCpf(trimmed.replace(/\D/g, ''))
        case 'CNPJ':
            return isValidCnpj(trimmed.replace(/\D/g, ''))
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

// ---------------------------------------------------------------------------
// Validação de checksum CPF/CNPJ (algoritmo brasileiro padrão)
// ---------------------------------------------------------------------------
// Rejeita CPFs/CNPJs com formato OK (11/14 dígitos) mas que falham na
// verificação. Sem isso, o frontend aprova "12672411603" como CPF válido,
// manda pra Asaas, BACEN retorna 422 "chave não cadastrada" — confunde o
// usuário porque a mensagem sugere que a chave existe mas não está no banco.

/** Valida um CPF (11 dígitos, só números). Rejeita também sequências
 *  uniformes tipo "11111111111". */
export function isValidCpf(digits: string): boolean {
    if (digits.length !== 11) return false
    if (/^(\d)\1{10}$/.test(digits)) return false

    // Primeiro dígito verificador
    let sum = 0
    for (let i = 0; i < 9; i++) {
        sum += parseInt(digits[i], 10) * (10 - i)
    }
    let check = sum % 11
    check = check < 2 ? 0 : 11 - check
    if (check !== parseInt(digits[9], 10)) return false

    // Segundo dígito verificador
    sum = 0
    for (let i = 0; i < 10; i++) {
        sum += parseInt(digits[i], 10) * (11 - i)
    }
    check = sum % 11
    check = check < 2 ? 0 : 11 - check
    return check === parseInt(digits[10], 10)
}

/** Valida um CNPJ (14 dígitos, só números). */
export function isValidCnpj(digits: string): boolean {
    if (digits.length !== 14) return false
    if (/^(\d)\1{13}$/.test(digits)) return false

    // Primeiro dígito verificador (pesos 5,4,3,2,9,8,7,6,5,4,3,2)
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < 12; i++) {
        sum += parseInt(digits[i], 10) * w1[i]
    }
    let check = sum % 11
    check = check < 2 ? 0 : 11 - check
    if (check !== parseInt(digits[12], 10)) return false

    // Segundo dígito verificador (pesos 6,5,4,3,2,9,8,7,6,5,4,3,2)
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    sum = 0
    for (let i = 0; i < 13; i++) {
        sum += parseInt(digits[i], 10) * w2[i]
    }
    check = sum % 11
    check = check < 2 ? 0 : 11 - check
    return check === parseInt(digits[13], 10)
}
