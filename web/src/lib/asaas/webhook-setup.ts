// ============================================================================
// Asaas — Auto-cadastro de webhook na subconta do trainer
// ============================================================================
// Cada subconta no Asaas precisa do PRÓPRIO webhook configurado pra
// pagamentos da subconta dispararem evento pro Kinevo. Não tem herança
// automática do CNPJ Kinevo. Então toda vez que criamos/vinculamos uma
// subconta, chamamos `ensureSubaccountWebhook` pra garantir que o webhook
// existe, está enabled e ouvindo os eventos certos.
//
// Idempotente: lista os webhooks existentes da subconta e:
//   - se já tem um com a URL alvo → atualiza (token + eventos + enabled)
//   - se não tem → cria um novo
// ============================================================================

import { asaasRequest, AsaasApiError } from './client'

/** Eventos que o nosso handler /api/webhooks/asaas sabe processar. */
const KINEVO_WEBHOOK_EVENTS = [
    'PAYMENT_CREATED',
    'PAYMENT_UPDATED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE',
    'PAYMENT_REFUNDED',
    'PAYMENT_DELETED',
    'TRANSFER_CREATED',
    'TRANSFER_PENDING',
    'TRANSFER_IN_BANK_PROCESSING',
    'TRANSFER_DONE',
    'TRANSFER_FAILED',
    'TRANSFER_CANCELLED',
] as const

interface AsaasWebhookRow {
    id: string
    name?: string
    url: string
    email?: string | null
    enabled?: boolean
    interrupted?: boolean
    authToken?: string | null
    sendType?: 'SEQUENTIALLY' | 'NON_SEQUENTIALLY'
    events?: string[]
    type?: string
}

interface WebhookListResponse {
    data: AsaasWebhookRow[]
    totalCount?: number
}

/**
 * Retorna a URL que a Asaas vai chamar quando algo acontecer na subconta.
 * Lê de env (`ASAAS_WEBHOOK_URL`) com fallback pra ${NEXT_PUBLIC_APP_URL}/api/webhooks/asaas.
 */
function resolveWebhookUrl(): string {
    const explicit = process.env.ASAAS_WEBHOOK_URL
    if (explicit) return explicit
    // SEMPRE www: kinevoapp.com sem www responde 307 → webhooks não seguem
    // redirect (incidente Stripe de abr/2026, ver CLAUDE.md).
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kinevoapp.com'
    return `${base.replace(/\/$/, '')}/api/webhooks/asaas`
}

/**
 * Token compartilhado que a Asaas envia no header `asaas-access-token` e
 * que nosso handler valida. Lê de `ASAAS_WEBHOOK_TOKEN`.
 */
function resolveWebhookToken(): string {
    const token = process.env.ASAAS_WEBHOOK_TOKEN
    if (!token) {
        throw new Error(
            'ASAAS_WEBHOOK_TOKEN missing — não dá pra cadastrar webhook sem o token compartilhado.',
        )
    }
    return token
}

/**
 * Garante que a subconta tem o webhook Kinevo configurado.
 *
 * Retorno: { created: boolean, updated: boolean, webhookId: string }
 *
 * Best-effort por design: se a Asaas estiver instável, NÃO bloqueia o
 * onboarding — o caller pode logar o erro e seguir. A gente sempre pode
 * tentar de novo via endpoint de backfill ou auto-trigger na home.
 */
export async function ensureSubaccountWebhook(
    subaccountApiKey: string,
    opts?: { email?: string | null },
): Promise<{ created: boolean; updated: boolean; webhookId: string }> {
    const url = resolveWebhookUrl()
    const authToken = resolveWebhookToken()
    // A Asaas EXIGE email no cadastro de webhook (usa pra avisar de fila
    // interrompida). Sem ele o POST devolve 400 invalid_email — foi a causa
    // da falha silenciosa que deixou subcontas sem webhook (jun/2026).
    const email = opts?.email || process.env.ASAAS_WEBHOOK_EMAIL || 'gustavocostap11@gmail.com'

    // 1. Lista webhooks existentes da subconta
    const list = await asaasRequest<WebhookListResponse>({
        apiKey: subaccountApiKey,
        path: '/webhooks',
    })

    // 2. Procura um com a URL alvo
    const existing = (list.data ?? []).find(w => w.url === url)

    if (existing) {
        // Atualiza se algo divergir (token rotacionado, eventos novos, foi desabilitado)
        const needsUpdate =
            existing.enabled === false ||
            existing.interrupted === true ||
            existing.authToken !== authToken ||
            !KINEVO_WEBHOOK_EVENTS.every(e => existing.events?.includes(e))

        if (needsUpdate) {
            await asaasRequest({
                apiKey: subaccountApiKey,
                method: 'PUT',
                path: `/webhooks/${encodeURIComponent(existing.id)}`,
                body: {
                    name: existing.name ?? 'Kinevo',
                    url,
                    email: existing.email ?? email,
                    enabled: true,
                    interrupted: false,
                    authToken,
                    sendType: existing.sendType ?? 'SEQUENTIALLY',
                    events: KINEVO_WEBHOOK_EVENTS,
                },
            })
            return { created: false, updated: true, webhookId: existing.id }
        }

        return { created: false, updated: false, webhookId: existing.id }
    }

    // 3. Cria novo
    const created = await asaasRequest<AsaasWebhookRow>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: '/webhooks',
        body: {
            name: 'Kinevo',
            url,
            email,
            enabled: true,
            interrupted: false,
            authToken,
            sendType: 'SEQUENTIALLY',
            events: KINEVO_WEBHOOK_EVENTS,
        },
    })

    return { created: true, updated: false, webhookId: created.id }
}

/**
 * Wrapper que loga mas não joga. Use no onboarding pra não travar a UI se
 * o cadastro falhar — o trainer pode rodar backfill depois.
 */
export async function tryEnsureSubaccountWebhook(
    subaccountApiKey: string,
    context?: { trainerId?: string; email?: string | null },
): Promise<void> {
    try {
        const result = await ensureSubaccountWebhook(subaccountApiKey, { email: context?.email })
        if (result.created) {
            console.log('[asaas-webhook-setup] criou webhook', { ...context, webhookId: result.webhookId })
        } else if (result.updated) {
            console.log('[asaas-webhook-setup] atualizou webhook', { ...context, webhookId: result.webhookId })
        }
    } catch (err) {
        if (err instanceof AsaasApiError) {
            console.error('[asaas-webhook-setup] falhou (best-effort)', {
                ...context,
                status: err.status,
                body: err.body,
            })
        } else {
            console.error('[asaas-webhook-setup] falhou (best-effort)', context, err)
        }
    }
}
