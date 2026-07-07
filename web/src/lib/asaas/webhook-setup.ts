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
    'PAYMENT_RECEIVED_IN_CASH',
    'PAYMENT_OVERDUE',
    'PAYMENT_REFUNDED',
    'PAYMENT_DELETED',
    // Chargeback: sem estes eventos assinados, o handler + push "responda pelo
    // painel Asaas" nunca disparam pra pagamentos de subconta — o treinador
    // perde a janela (curta) de disputa sem nem saber que ela abriu.
    'PAYMENT_CHARGEBACK_REQUESTED',
    'PAYMENT_CHARGEBACK_DISPUTE',
    'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
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
 * ÚNICO ponto de escrita de webhook no Asaas (POST cria / PUT atualiza). O
 * `authToken` é OBRIGATÓRIO no tipo — é impossível, em QUALQUER caminho
 * (automático ou gated), emitir um write sem token. Isso mata na raiz o bug do
 * PUT-que-omite-o-token: o Asaas MASCARA o authToken no GET (devolve
 * `hasAuthToken`, nunca o valor), então não há como "preservar" relendo — toda
 * escrita carrega um token explícito, por construção.
 */
interface WriteWebhookInput {
    apiKey: string
    webhookId?: string // presente → PUT (update) ; ausente → POST (create)
    url: string
    email: string
    authToken: string // OBRIGATÓRIO — omitir é erro de compilação
    name?: string
    sendType?: 'SEQUENTIALLY' | 'NON_SEQUENTIALLY'
}

async function writeWebhook(input: WriteWebhookInput): Promise<AsaasWebhookRow> {
    if (!input.authToken) {
        // Cinto+suspensório além do tipo: nunca emitir um write sem token.
        throw new Error('[asaas-webhook-setup] refusing to write webhook without authToken')
    }
    const body = {
        name: input.name ?? 'Kinevo',
        url: input.url,
        email: input.email,
        enabled: true,
        interrupted: false,
        authToken: input.authToken,
        sendType: input.sendType ?? 'SEQUENTIALLY',
        events: KINEVO_WEBHOOK_EVENTS,
    }
    return input.webhookId
        ? asaasRequest<AsaasWebhookRow>({
              apiKey: input.apiKey,
              method: 'PUT',
              path: `/webhooks/${encodeURIComponent(input.webhookId)}`,
              body,
          })
        : asaasRequest<AsaasWebhookRow>({
              apiKey: input.apiKey,
              method: 'POST',
              path: '/webhooks',
              body,
          })
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
 * Retorno: { created, updated, webhookId, needsRepair? }
 *
 * FRONTEIRA DE SEGURANÇA (self-healing × gate), revista após descobrir que o
 * Asaas MASCARA o authToken no GET (devolve `hasAuthToken`, nunca o valor):
 *   - CRIA webhook novo (onboarding) → cunha token POR SUBCONTA + grava o hash.
 *   - webhook EXISTENTE com DRIFT (disabled/interrupted/eventos) → NÃO escreve
 *     token. O caminho automático nunca reescreve token de subconta real (gate).
 *     Como o token vem mascarado e só guardamos o hash, um PUT aqui ou OMITIRIA
 *     o token (bug: o Asaas poderia limpá-lo) ou seria uma rotação não-
 *     supervisionada (fura o gate). Então SINALIZA reparo gated (`needsRepair`)
 *     — o reparo real (que escreve token) é o passo gated `rotateSubaccountWebhook`.
 *   - webhook EXISTENTE sem drift → no-op.
 *
 * Best-effort por design: se a Asaas estiver instável, NÃO bloqueia o
 * onboarding — o caller pode logar o erro e seguir.
 */
export async function ensureSubaccountWebhook(
    subaccountApiKey: string,
    opts: { trainerId: string; email?: string | null },
): Promise<{ created: boolean; updated: boolean; webhookId: string; needsRepair?: boolean }> {
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
        // Drift = enabled:false / interrupted:true / eventos incompletos. O
        // caminho AUTOMÁTICO não conserta com PUT, porque todo write carrega um
        // authToken (writeWebhook exige) e reescrever token de subconta existente
        // é exclusivo do passo gated. Detecta e SINALIZA; nunca escreve.
        const drift: string[] = []
        if (existing.enabled === false) drift.push('disabled')
        if (existing.interrupted === true) drift.push('interrupted')
        if (!KINEVO_WEBHOOK_EVENTS.every(e => existing.events?.includes(e))) drift.push('events-incomplete')

        if (drift.length > 0) {
            console.warn(
                `[asaas-webhook-setup] webhook drift (trainer ${opts.trainerId}) [${drift.join(',')}] — ` +
                'needs GATED repair (rotateSubaccountWebhook); NOT auto-writing token',
            )
            return { created: false, updated: false, webhookId: existing.id, needsRepair: true }
        }

        return { created: false, updated: false, webhookId: existing.id }
    }

    // 3. Cria novo — nasce já com token POR SUBCONTA. Grava o hash ANTES do
    //    POST: se o POST falhar não há webhook (nenhum evento chega); se
    //    gravássemos depois e o store falhasse, o Asaas mandaria um token que o
    //    banco não resolve (e, sem o global, seria rejeitado).
    const token = generateWebhookToken()
    await storeTokenHash(opts.trainerId, hashWebhookToken(token))
    const created = await writeWebhook({ apiKey: subaccountApiKey, url, email, authToken: token })
    return { created: true, updated: false, webhookId: created.id }
}

/**
 * ROTAÇÃO EXPLÍCITA E GATED do authToken de uma subconta para um token POR
 * SUBCONTA. É a ÚNICA função que reescreve o authToken de uma subconta
 * EXISTENTE no Asaas — chamada só pelo passo de rotação aprovado (nunca pelo
 * caminho self-healing). Também é o caminho de reparo gated quando o
 * `ensureSubaccountWebhook` sinaliza `needsRepair`.
 *
 * Grava o hash ANTES do write: se o PUT falhar, o Asaas segue com o token velho
 * e o handler ainda aceita pelo GLOBAL durante a transição; a próxima rotação
 * reconcilia. Pior caso = hash órfão apontando pra um token que o Asaas ainda
 * não tem → sobrescrito no próximo rotate. Falha recuperável, não estado perdido.
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

    await storeTokenHash(trainerId, hashWebhookToken(token)) // hash ANTES do write
    const row = await writeWebhook({
        apiKey: subaccountApiKey,
        webhookId: existing?.id,
        url,
        email: existing?.email ?? email,
        authToken: token, // ROTACIONA — explícito, exclusivo deste passo gated
        name: existing?.name,
        sendType: existing?.sendType,
    })
    return { webhookId: row.id, created: !existing }
}

/**
 * ROLLBACK GATED: devolve a subconta ao caminho legado (token GLOBAL) e zera o
 * hash. Envia o global EXPLÍCITO (mesma regra: nunca omitir). Ordem INVERTIDA vs
 * rotate — PUT global PRIMEIRO, zera hash DEPOIS: senão, entre zerar e PUTar, um
 * evento com o token por-subconta não resolveria (hash já nulo) nem casaria o
 * global → 401, evento perdido. PUTando o global primeiro, o dual-accept cobre a
 * janela inteira em qualquer ordem de chegada. Use se um PUT de rotação aplicar
 * mas o evento escopado não resolver na janela supervisionada.
 */
export async function revertSubaccountToGlobal(
    subaccountApiKey: string,
    trainerId: string,
): Promise<{ webhookId: string }> {
    const url = resolveWebhookUrl()
    const globalToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (!globalToken) {
        throw new Error('ASAAS_WEBHOOK_TOKEN missing — cannot revert subaccount to the legacy global path')
    }
    const email = process.env.ASAAS_WEBHOOK_EMAIL || 'gustavocostap11@gmail.com'

    const list = await asaasRequest<WebhookListResponse>({ apiKey: subaccountApiKey, path: '/webhooks' })
    const existing = (list.data ?? []).find(w => w.url === url)

    // 1) Devolve o token GLOBAL no Asaas PRIMEIRO (write explícito, nunca omite).
    const row = await writeWebhook({
        apiKey: subaccountApiKey,
        webhookId: existing?.id,
        url,
        email: existing?.email ?? email,
        authToken: globalToken,
        name: existing?.name,
        sendType: existing?.sendType,
    })
    // 2) SÓ ENTÃO zera o hash → subconta volta ao dual-accept pelo global.
    const { error } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .update({ webhook_token_hash: null })
        .eq('trainer_id', trainerId)
    if (error) {
        console.error('[asaas-webhook-setup] revert: failed to clear webhook_token_hash', { trainerId, error })
        throw error
    }
    return { webhookId: row.id }
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
