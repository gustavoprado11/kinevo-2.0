// ============================================================================
// Asaas — WalletService (Kinevo-side helper)
// ============================================================================
// Encapsulates:
//   - Loading a trainer's Asaas account row (with decrypted apiKey).
//   - Authenticating an incoming request (cookie OR Bearer token).
//   - Persisting new accounts / payouts.
//
// This keeps the API route handlers thin.
// ============================================================================

import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase/server'
import {
    createSubaccount,
    getSubaccount,
    getMyAccountInfo,
    encryptApiKey,
    decryptApiKey,
    AsaasApiError,
    tryEnsureSubaccountWebhook,
} from '@/lib/asaas'
import type {
    CreateAsaasAccountInput,
    KinevoWalletMode,
    KinevoWalletStatus,
    KinevoWalletSummary,
} from '@/lib/asaas'

// ---------------------------------------------------------------------------
// Authentication: resolve current trainer from cookie OR Bearer token
// ---------------------------------------------------------------------------

export interface ResolvedTrainer {
    id: string                 // trainers.id
    authUserId: string         // auth.users.id
    email: string
    name: string | null
}

export class WalletAuthError extends Error {
    readonly status: number
    constructor(message: string, status = 401) {
        super(message)
        this.name = 'WalletAuthError'
        this.status = status
    }
}

/**
 * Resolves the trainer for a request. Tries Bearer token first (mobile),
 * then cookie (web). Throws WalletAuthError on failure — let the route
 * map it to a NextResponse.
 */
export async function requireTrainer(request: NextRequest): Promise<ResolvedTrainer> {
    const auth = request.headers.get('authorization')

    if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7).trim()
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
        if (error || !user) {
            throw new WalletAuthError('Token inválido', 401)
        }
        return resolveTrainerByAuthId(user.id, user.email ?? '')
    }

    // Cookie-based (web)
    const sb = await createClient()
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) {
        throw new WalletAuthError('Não autenticado', 401)
    }
    return resolveTrainerByAuthId(user.id, user.email ?? '')
}

async function resolveTrainerByAuthId(authUserId: string, email: string): Promise<ResolvedTrainer> {
    const { data: trainer, error } = await supabaseAdmin
        .from('trainers')
        .select('id, name, email')
        .eq('auth_user_id', authUserId)
        .single()

    if (error || !trainer) {
        throw new WalletAuthError('Treinador não encontrado', 404)
    }
    return {
        id: trainer.id,
        authUserId,
        email: trainer.email ?? email,
        name: trainer.name ?? null,
    }
}

// ---------------------------------------------------------------------------
// trainer_payment_accounts CRUD
// ---------------------------------------------------------------------------

export interface TrainerPaymentAccountRow {
    id: string
    trainer_id: string
    asaas_account_id: string | null
    asaas_wallet_id: string | null
    // Supabase JS returns BYTEA as a hex string ("\x..."). We keep type wide
    // to allow either string or Buffer (Buffer when read via raw connection).
    asaas_api_key_encrypted: string | Buffer | null
    status: KinevoWalletStatus
    account_mode: KinevoWalletMode
    rejection_reason: string | null
    legal_name: string | null
    cpf_cnpj: string | null
    company_type: string | null
    email: string | null
    mobile_phone: string | null
    address: string | null
    address_number: string | null
    province: string | null
    postal_code: string | null
    income_value: number | null
    created_at: string
    updated_at: string
    activated_at: string | null
    /** Quando o webhook Kinevo foi cadastrado na subconta Asaas. Null = nunca rodou. */
    webhook_configured_at: string | null
}

/**
 * Returns the trainer's wallet row, or null if not yet started.
 */
export async function getWalletRow(trainerId: string): Promise<TrainerPaymentAccountRow | null> {
    const { data, error } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .select('*')
        .eq('trainer_id', trainerId)
        .maybeSingle()
    if (error) throw error
    return data as TrainerPaymentAccountRow | null
}

/**
 * Returns a UI-friendly summary (camelCase, no encrypted secrets).
 */
export function summarizeWallet(row: TrainerPaymentAccountRow | null): KinevoWalletSummary {
    if (!row) {
        return {
            status: 'not_started',
            mode: 'subaccount',
            asaasAccountId: null,
            asaasWalletId: null,
            canReceivePayments: false,
            canPayout: false,
        }
    }
    return {
        status: row.status,
        mode: row.account_mode ?? 'subaccount',
        asaasAccountId: row.asaas_account_id,
        asaasWalletId: row.asaas_wallet_id,
        rejectionReason: row.rejection_reason ?? null,
        canReceivePayments: row.status === 'approved',
        canPayout: row.status === 'approved',
        activatedAt: row.activated_at ?? null,
        ownerLabel: row.legal_name ?? null,
    }
}

/**
 * Loads the decrypted API key for a trainer's subaccount.
 * Throws if wallet isn't approved or apiKey is missing.
 */
export async function getDecryptedApiKey(trainerId: string): Promise<string> {
    const row = await getWalletRow(trainerId)
    if (!row || !row.asaas_api_key_encrypted) {
        throw new WalletAuthError('Carteira não ativada', 409)
    }
    if (row.status !== 'approved') {
        throw new WalletAuthError(`Carteira em status: ${row.status}`, 409)
    }
    // Supabase returns bytea as a Buffer (or hex-encoded string depending on driver).
    const blob = row.asaas_api_key_encrypted
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(String(blob).replace(/^\\x/, ''), 'hex')
    return decryptApiKey(buf)
}

// ---------------------------------------------------------------------------
// Activate: create Asaas subaccount + persist (encrypted)
// ---------------------------------------------------------------------------

// Same shape as Asaas input for now; aliased here so callers don't need to
// import from the lib (decouples API routes from the underlying Asaas types).
export type ActivateWalletInput = CreateAsaasAccountInput

/**
 * Creates (or re-uses) the trainer's Asaas subaccount.
 *
 * Idempotent: if a row already exists and is `not_started` or `rejected`,
 * we update + retry. If `pending`/`awaiting`/`approved`/`blocked`, we noop
 * and return the existing summary (UI should not call activate again).
 */
export async function activateWallet(
    trainerId: string,
    input: ActivateWalletInput
): Promise<KinevoWalletSummary> {
    const existing = await getWalletRow(trainerId)

    if (existing && ['pending', 'awaiting', 'approved'].includes(existing.status)) {
        return summarizeWallet(existing)
    }

    // Create at Asaas
    const account = await createSubaccount(input)
    if (!account.apiKey) {
        // Should not happen — Asaas always returns it on creation.
        throw new Error('Asaas did not return apiKey on account creation')
    }

    const encrypted = encryptApiKey(account.apiKey)
    // Postgres BYTEA over PostgREST (Supabase JS) accepts the `\xDEADBEEF` hex
    // literal as a string, but NOT raw Buffer instances (those serialize as
    // `{ type: "Buffer", data: [...] }` which Postgres rejects). Convert here.
    const encryptedHex = '\\x' + encrypted.toString('hex')

    const localStatus = mapAsaasStatusToLocal(account.accountStatus)

    const baseFields = {
        trainer_id: trainerId,
        asaas_account_id: account.id,
        asaas_wallet_id: account.walletId,
        asaas_api_key_encrypted: encryptedHex,
        status: localStatus,
        account_mode: 'subaccount' as const,
        rejection_reason: account.rejectReason ?? null,
        legal_name: input.name,
        cpf_cnpj: input.cpfCnpj.replace(/\D/g, ''),
        company_type: input.companyType ?? null,
        email: input.email,
        mobile_phone: input.mobilePhone.replace(/\D/g, ''),
        address: input.address,
        address_number: input.addressNumber,
        province: input.province,
        postal_code: input.postalCode.replace(/\D/g, ''),
        income_value: input.incomeValue ?? null,
        activated_at: localStatus === 'approved' ? new Date().toISOString() : null,
    }

    if (existing) {
        const { error } = await supabaseAdmin
            .from('trainer_payment_accounts')
            .update(baseFields)
            .eq('trainer_id', trainerId)
        if (error) throw error
    } else {
        const { error } = await supabaseAdmin
            .from('trainer_payment_accounts')
            .insert(baseFields)
        if (error) throw error
    }

    // Cadastra o webhook Kinevo na subconta — best-effort, não bloqueia
    // onboarding se falhar (trainer pode rodar backfill depois).
    await tryEnsureSubaccountWebhook(account.apiKey, { trainerId })

    const fresh = await getWalletRow(trainerId)
    return summarizeWallet(fresh)
}

/**
 * Sync the trainer's wallet status from Asaas (manual refresh).
 *
 * For `subaccount` mode we hit /v3/accounts/{id} using the Kinevo master key.
 * For `linked` mode we have no /accounts/{id} permission (Kinevo isn't the
 * owner), so we just confirm the API key still works via /myAccount/info.
 */
export async function syncWalletStatus(trainerId: string): Promise<KinevoWalletSummary> {
    const row = await getWalletRow(trainerId)
    if (!row) return summarizeWallet(row)

    if (row.account_mode === 'linked') {
        return syncLinkedWalletStatus(row)
    }

    if (!row.asaas_account_id) return summarizeWallet(row)

    const remote = await getSubaccount(row.asaas_account_id)
    const newStatus = mapAsaasStatusToLocal(remote.accountStatus)

    const update: Record<string, unknown> = {
        status: newStatus,
        rejection_reason: remote.rejectReason ?? null,
    }
    if (newStatus === 'approved' && !row.activated_at) {
        update.activated_at = new Date().toISOString()
    }

    const { error } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .update(update)
        .eq('trainer_id', trainerId)
    if (error) throw error

    return summarizeWallet({ ...row, ...update } as TrainerPaymentAccountRow)
}

async function syncLinkedWalletStatus(row: TrainerPaymentAccountRow): Promise<KinevoWalletSummary> {
    if (!row.asaas_api_key_encrypted) return summarizeWallet(row)
    const blob = row.asaas_api_key_encrypted
    const buf = Buffer.isBuffer(blob)
        ? blob
        : Buffer.from(String(blob).replace(/^\\x/, ''), 'hex')
    const apiKey = decryptApiKey(buf)

    try {
        const info = await getMyAccountInfo(apiKey)
        const newStatus: KinevoWalletStatus = info.status
            ? mapAsaasStatusToLocal(info.status)
            : row.status
        const update: Record<string, unknown> = {
            status: newStatus,
            rejection_reason: null,
        }
        if (info.name && !row.legal_name) update.legal_name = info.name
        if (info.cpfCnpj && !row.cpf_cnpj) update.cpf_cnpj = info.cpfCnpj
        if (newStatus === 'approved' && !row.activated_at) {
            update.activated_at = new Date().toISOString()
        }
        const { error } = await supabaseAdmin
            .from('trainer_payment_accounts')
            .update(update)
            .eq('trainer_id', row.trainer_id)
        if (error) throw error
        return summarizeWallet({ ...row, ...update } as TrainerPaymentAccountRow)
    } catch {
        // API key likely revoked or invalid — mark as blocked so UI prompts re-link.
        const update = { status: 'blocked' as const, rejection_reason: 'Chave de API inválida ou revogada' }
        await supabaseAdmin
            .from('trainer_payment_accounts')
            .update(update)
            .eq('trainer_id', row.trainer_id)
        return summarizeWallet({ ...row, ...update } as TrainerPaymentAccountRow)
    }
}

// ---------------------------------------------------------------------------
// Link an existing Asaas account (trainer pasted their own apiKey + walletId)
// ---------------------------------------------------------------------------

export interface LinkExistingAccountInput {
    apiKey: string                 // chave de API da conta Asaas do treinador
    walletId: string               // wallet ID (UUID) exibido no painel Asaas
}

/**
 * Vincula uma conta Asaas existente ao Kinevo.
 *
 * Diferente do `activateWallet`, aqui o Kinevo NÃO cria nada do lado do Asaas
 * — apenas guarda a chave de API e o wallet ID que o treinador colou. Usamos
 * `/v3/myAccount/info` pra validar a chave e capturar nome/CPF/email.
 *
 * Idempotente: se já existir wallet em mode='subaccount' ativa, recusa (UI deve
 * ter mostrado tela de erro). Se existir em mode='linked' (re-vinculação),
 * atualiza a chave.
 */
export async function linkExistingAccount(
    trainerId: string,
    input: LinkExistingAccountInput
): Promise<KinevoWalletSummary> {
    const apiKey = input.apiKey.trim()
    const walletId = input.walletId.trim()

    if (!apiKey.startsWith('$aact_')) {
        throw new WalletAuthError('A chave de API da Asaas começa com "$aact_". Confira se copiou ela inteira.', 400)
    }
    if (walletId.length < 16) {
        throw new WalletAuthError('O ID da carteira (Wallet ID) parece incompleto. Confira no painel da Asaas.', 400)
    }

    const existing = await getWalletRow(trainerId)
    if (existing && existing.account_mode === 'subaccount' && existing.status === 'approved') {
        throw new WalletAuthError(
            'Você já tem uma Carteira Kinevo ativa criada pelo nosso fluxo. Pra trocar pra uma conta Asaas existente, fale com o suporte.',
            409
        )
    }

    // Valida a chave chamando /myAccount/commercialInfo (ou /finance/balance
    // como fallback). Erros são logados server-side e bubblados pro usuário
    // com o motivo real — assim ele consegue distinguir "chave errada" de
    // "ambiente errado" ou "Asaas fora do ar".
    let info: Awaited<ReturnType<typeof getMyAccountInfo>>
    try {
        info = await getMyAccountInfo(apiKey)
    } catch (err) {
        console.error('[wallet/link] Asaas validation failed:', {
            asaasEnv: process.env.ASAAS_ENV ?? '(unset → defaults to sandbox)',
            keyPrefix: apiKey.slice(0, 12),
            status: err instanceof AsaasApiError ? err.status : 'n/a',
            message: err instanceof Error ? err.message : String(err),
            body: err instanceof AsaasApiError ? JSON.stringify(err.body) : undefined,
        })
        if (err instanceof AsaasApiError) {
            if (err.status === 401 || err.status === 403) {
                throw new WalletAuthError(
                    'A Asaas rejeitou a chave (não autorizada). Confira no painel da Asaas se a chave está ativa, se é de produção (não sandbox) e se tem permissão pra leitura de conta.',
                    400
                )
            }
            if (err.status === 404) {
                throw new WalletAuthError(
                    'A Asaas não encontrou os endpoints esperados com essa chave. Pode ser ambiente errado (sandbox vs produção) ou um tipo de conta que não suporta vinculação direta. Fala com a gente que te ajudamos.',
                    400
                )
            }
            throw new WalletAuthError(
                `A Asaas retornou erro ${err.status}: ${err.message}. Tente novamente em alguns minutos.`,
                400
            )
        }
        throw new WalletAuthError(
            'Não conseguimos conectar na Asaas pra validar a chave. Confira sua conexão e tente novamente.',
            400
        )
    }

    const encrypted = encryptApiKey(apiKey)
    const encryptedHex = '\\x' + encrypted.toString('hex')
    const remoteStatus = info.status ? mapAsaasStatusToLocal(info.status) : 'approved'

    const baseFields = {
        trainer_id: trainerId,
        asaas_account_id: info.id ?? null,
        asaas_wallet_id: walletId,
        asaas_api_key_encrypted: encryptedHex,
        status: remoteStatus,
        account_mode: 'linked' as const,
        rejection_reason: null,
        legal_name: info.name ?? existing?.legal_name ?? null,
        cpf_cnpj: info.cpfCnpj ?? existing?.cpf_cnpj ?? null,
        email: info.email ?? existing?.email ?? null,
        activated_at: remoteStatus === 'approved' ? new Date().toISOString() : null,
    }

    if (existing) {
        const { error } = await supabaseAdmin
            .from('trainer_payment_accounts')
            .update(baseFields)
            .eq('trainer_id', trainerId)
        if (error) throw error
    } else {
        const { error } = await supabaseAdmin
            .from('trainer_payment_accounts')
            .insert(baseFields)
        if (error) throw error
    }

    // Modo linked: trainer trouxe a própria chave — cadastra webhook na
    // conta dele pra pagamentos chegarem no Kinevo. Best-effort.
    await tryEnsureSubaccountWebhook(apiKey, { trainerId })

    const fresh = await getWalletRow(trainerId)
    return summarizeWallet(fresh)
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function mapAsaasStatusToLocal(asaasStatus: string): KinevoWalletStatus {
    switch (asaasStatus.toUpperCase()) {
        case 'PENDING': return 'pending'
        case 'AWAITING': return 'awaiting'
        case 'APPROVED': return 'approved'
        case 'REJECTED': return 'rejected'
        case 'BLOCKED': return 'blocked'
        default: return 'pending'
    }
}
