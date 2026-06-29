// ============================================================================
// Asaas — Webhook verification + parsing
// ============================================================================
// Asaas authenticates webhooks via a shared secret in the `asaas-access-token`
// header (sent as exact value, NOT HMAC — see docs). We compare against the
// secret we set when configuring the webhook in the Asaas panel.
//
// Each event has a stable `id` we use for idempotency in webhook_events.
// ============================================================================

import { createHash, randomBytes } from 'crypto'
import type { AsaasWebhookEvent } from '@kinevo/shared/types/asaas'

const ASAAS_WEBHOOK_TOKEN_HEADER = 'asaas-access-token'

// ── Token POR SUBCONTA (Fase 2) ─────────────────────────────────────────────
// Cada subconta tem um authToken aleatório próprio. Guardamos só o HASH no
// banco (trainer_payment_accounts.webhook_token_hash); o token cru vive só no
// Asaas (authToken da subconta) e no header que ele manda de volta.

/** Gera um token aleatório de alta entropia pro authToken de uma subconta. */
export function generateWebhookToken(): string {
    return randomBytes(32).toString('hex')
}

/** sha256 hex do token — o que persistimos e comparamos. */
export function hashWebhookToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

/**
 * Verify the Asaas webhook secret. Returns true if the header matches the
 * configured ASAAS_WEBHOOK_TOKEN. Use timing-safe comparison.
 */
export function verifyWebhookSecret(headerValue: string | null | undefined): boolean {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN
    if (!expected) {
        console.error('[asaas-webhook] ASAAS_WEBHOOK_TOKEN not set — rejecting all events')
        return false
    }
    if (!headerValue) return false
    return timingSafeEqual(headerValue, expected)
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let mismatch = 0
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return mismatch === 0
}

/**
 * Parse the raw Asaas webhook body. Validates basic shape.
 */
export function parseWebhookEvent(body: unknown): AsaasWebhookEvent {
    if (!body || typeof body !== 'object') {
        throw new Error('Invalid webhook body: not an object')
    }
    const obj = body as Record<string, unknown>
    if (typeof obj.id !== 'string' || typeof obj.event !== 'string') {
        throw new Error('Invalid webhook body: missing id or event field')
    }
    return body as AsaasWebhookEvent
}

export { ASAAS_WEBHOOK_TOKEN_HEADER }

/**
 * Erro PERMANENTE de processamento de webhook: reprocessar não vai ajudar
 * (payload estruturalmente inválido, recurso que nunca vai existir, regra de
 * negócio definitivamente violada). Um handler lança isto para sinalizar
 * "dá ACK (200) e NÃO re-entrega" — em vez do default RETRYABLE (que libera a
 * linha de idempotência e devolve 500 para o Asaas reentregar). Sem essa
 * distinção, um erro determinístico viraria loop de reentrega (mensagem-veneno).
 * Hoje os casos conhecidos/não-processáveis já retornam cedo (200) sem lançar;
 * esta classe é o canal explícito para abortar como permanente no meio do
 * processamento.
 */
export class PermanentWebhookError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PermanentWebhookError'
    }
}
