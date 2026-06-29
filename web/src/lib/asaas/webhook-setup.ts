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
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateWebhookToken, hashWebhookToken } from './webhook'

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

/** Persiste só o HASH do token por-subconta (nunca o token cru). */
async function storeTokenHash(trainerId: string, tokenHash: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .update({ webhook_token_hash: tokenHash })
        .eq('trainer_id', trainerId)
    if (error) {
        console.error('[asaas-webhook-setup] failed to store webhook_token_hash', { trainerId, error })
        throw error
    }
}

/** Critério EXPLÍCITO de aposentadoria do token GLOBAL legado: toda subconta
 *  APROVADA já tem webhook_token_hash não-nulo. Enquanto false, o dual-accept do
 *  handler segue necessário. Usado pelo passo de rotação / monitoramento. */
export async function allApprovedSubaccountsRotated(): Promise<boolean> {
    const { count, error } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .is('webhook_token_hash', null)
    if (error || count == null) return false // fail-safe: não afirma aposentadoria sem certeza
    return count === 0
}

/**
 * Garante que a subconta tem o webhook Kinevo configurado.
 *
 * Retorno: { created: boolean, updated: boolean, webhookId: string }
 *
 * FRONTEIRA DE SEGURANÇA (self-healing × gate): esta função é o caminho
 * AUTOMÁTICO (onboarding, backfill, auto-trigger na home). Ela:
 *   - CRIA webhook novo → cunha um token POR SUBCONTA e grava o hash;
 *   - webhook EXISTENTE → NUNCA reescreve o authToken (preserva o atual);
 *     só conserta enabled/interrupted/eventos.
 * A rotação do authToken de uma subconta existente é o passo EXPLÍCITO e
 * gated `rotateSubaccountWebhook` — nunca acontece sozinha aqui.
 *
 * Best-effort por design: se a Asaas estiver instável, NÃO bloqueia o
 * onboarding — o caller pode logar o erro e seguir.
 */
export async function ensureSubaccountWebhook(
    subaccountApiKey: string,
    opts: { trainerId: string; email?: string | null },
): Promise<{ created: boolean; updated: boolean; webhookId: string }> {
    const url = resolveWebhookUrl()
    // A Asaas EXIGE email no cadastro de webhook (usa pra avisar de fila
    // interrompida). Sem ele o POST devolve 400 invalid_email — foi a causa
    // da falha silenciosa que deixou subcontas sem webhook (jun/2026).
    const email = opts.email || process.env.ASAAS_WEBHOOK_EMAIL || 'gustavocostap11@gmail.com'

    // 1. Lista webhooks existentes da subconta
    const list = await asaasRequest<WebhookListResponse>({
        apiKey: subaccountApiKey,
        path: '/webhooks',
    })

    // 2. Procura um com a URL alvo
    const existing = (list.data ?? []).find(w => w.url === url)

    if (existing) {
        // Conserta SÓ enabled/interrupted/eventos. O authToken é PRESERVADO —
        // não comparamos nem reescrevemos (isso é exclusivo do passo gated de
        // rotação). Subcontas legadas seguem com o token global até a rotação.
        const needsUpdate =
            existing.enabled === false ||
            existing.interrupted === true ||
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
                    authToken: existing.authToken ?? undefined, // PRESERVA — nunca rotaciona aqui
                    sendType: existing.sendType ?? 'SEQUENTIALLY',
                    events: KINEVO_WEBHOOK_EVENTS,
                },
            })
            return { created: false, updated: true, webhookId: existing.id }
        }

        return { created: false, updated: false, webhookId: existing.id }
    }

    // 3. Cria novo — nasce já com token POR SUBCONTA. Grava o hash ANTES do
    //    POST: se o POST falhar não há webhook (nenhum evento chega); se
    //    gravássemos depois e o store falhasse, o Asaas mandaria um token que o
    //    banco não resolve (e, sem o global, seria rejeitado).
    const token = generateWebhookToken()
    await storeTokenHash(opts.trainerId, hashWebhookToken(token))
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
            authToken: token,
            sendType: 'SEQUENTIALLY',
            events: KINEVO_WEBHOOK_EVENTS,
        },
    })

    return { created: true, updated: false, webhookId: created.id }
}

/**
 * ROTAÇÃO EXPLÍCITA E GATED do authToken de uma subconta para um token POR
 * SUBCONTA. É a ÚNICA função que reescreve o authToken de uma subconta
 * EXISTENTE no Asaas — chamada só pelo passo de rotação aprovado (nunca pelo
 * caminho self-healing). Grava o hash ANTES do write no Asaas: se o PUT
 * falhar, o Asaas segue com o token velho e o handler ainda aceita pelo GLOBAL
 * durante a transição; a próxima rotação reconcilia. (Gravar depois arriscaria
 * o Asaas mandar um token que o banco não resolve.)
 */
export async function rotateSubaccountWebhook(
    subaccountApiKey: string,
    trainerId: string,
    opts?: { email?: string | null },
): Promise<{ webhookId: string; created: boolean }> {
    const url = resolveWebhookUrl()
    const email = opts?.email || process.env.ASAAS_WEBHOOK_EMAIL || 'gustavocostap11@gmail.com'
    const token = generateWebhookToken()

    const list = await asaasRequest<WebhookListResponse>({ apiKey: subaccountApiKey, path: '/webhooks' })
    const existing = (list.data ?? []).find(w => w.url === url)

    await storeTokenHash(trainerId, hashWebhookToken(token))

    if (existing) {
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
                authToken: token, // ROTACIONA — exclusivo deste passo gated
                sendType: existing.sendType ?? 'SEQUENTIALLY',
                events: KINEVO_WEBHOOK_EVENTS,
            },
        })
        return { webhookId: existing.id, created: false }
    }
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
            authToken: token,
            sendType: 'SEQUENTIALLY',
            events: KINEVO_WEBHOOK_EVENTS,
        },
    })
    return { webhookId: created.id, created: true }
}

/**
 * Wrapper que loga mas não joga. Use no onboarding pra não travar a UI se
 * o cadastro falhar — o trainer pode rodar backfill depois.
 */
export async function tryEnsureSubaccountWebhook(
    subaccountApiKey: string,
    context: { trainerId: string; email?: string | null },
): Promise<void> {
    try {
        const result = await ensureSubaccountWebhook(subaccountApiKey, {
            trainerId: context.trainerId,
            email: context.email,
        })
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
