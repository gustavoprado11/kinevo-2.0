// ============================================================================
// /financial/wallet — Carteira Kinevo (Asaas)
// ============================================================================
// Server component: carrega o estado atual da Carteira do treinador (status,
// saldo se já ativa, pix keys) e delega pra o client component.
// ============================================================================

import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, getBalance, listPendingDocuments } from '@/lib/asaas'
import { getWalletRow, summarizeWallet } from '@/lib/asaas/wallet-service'
import { decryptApiKey } from '@/lib/asaas/encryption'
import { WalletClient } from './wallet-client'
import type { KinevoWalletSummary, AsaasDocumentGroup } from '@/lib/asaas'

interface PixKeyRow {
    id: string
    alias: string
    pix_key: string
    key_type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
    owner_name: string | null
    bank_name: string | null
    is_default: boolean
}

interface StudentLite {
    id: string
    name: string
    email: string | null
}

export default async function WalletPage() {
    const { trainer } = await getTrainerWithSubscription()

    // 1. Wallet status
    const row = await getWalletRow(trainer.id)
    const summary: KinevoWalletSummary = summarizeWallet(row)

    // Helper: decrypt apiKey lazily (used for balance + documents)
    const apiKey: string | null = (() => {
        if (!row || !row.asaas_api_key_encrypted) return null
        const blob = Buffer.isBuffer(row.asaas_api_key_encrypted)
            ? (row.asaas_api_key_encrypted as Buffer)
            : Buffer.from(String(row.asaas_api_key_encrypted).replace(/^\\x/, ''), 'hex')
        return decryptApiKey(blob)
    })()

    // 2. Balance (only when approved)
    let balance: number | null = null
    let balanceError: string | null = null
    if (apiKey && summary.status === 'approved') {
        try {
            const b = await getBalance(apiKey)
            balance = b.balance
        } catch (err) {
            if (err instanceof AsaasApiError) balanceError = err.message
            else balanceError = 'Não foi possível consultar o saldo agora.'
        }
    }

    // 2b. Pending KYC documents (only when wallet exists but not approved yet)
    let pendingDocuments: AsaasDocumentGroup[] = []
    let documentsError: string | null = null
    if (apiKey && (summary.status === 'pending' || summary.status === 'awaiting' || summary.status === 'rejected')) {
        try {
            pendingDocuments = await listPendingDocuments(apiKey)
        } catch (err) {
            if (err instanceof AsaasApiError) {
                // 15s grace period — if Asaas says not ready yet, surface friendly note
                documentsError = err.message
            } else {
                documentsError = 'Não foi possível carregar os documentos agora.'
            }
        }
    }

    // 3. PIX keys
    const { data: pixKeysRaw } = await supabaseAdmin
        .from('pix_keys')
        .select('id, alias, pix_key, key_type, owner_name, bank_name, is_default')
        .eq('trainer_id', trainer.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
    const pixKeys = (pixKeysRaw ?? []) as PixKeyRow[]

    // 4. Trainer's students (for charge modal)
    const { data: studentsRaw } = await supabaseAdmin
        .from('students')
        .select('id, name, email')
        .eq('coach_id', trainer.id)
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(200)
    const students = (studentsRaw ?? []) as StudentLite[]

    // 5. Pre-fill activation form with trainer data
    const prefill = {
        name: trainer.name ?? '',
        email: trainer.email ?? '',
    }

    return (
        <WalletClient
            summary={summary}
            balance={balance}
            balanceError={balanceError}
            pendingDocuments={pendingDocuments}
            documentsError={documentsError}
            pixKeys={pixKeys}
            students={students}
            prefill={prefill}
            trainer={{
                name: trainer.name,
                email: trainer.email,
                avatarUrl: trainer.avatar_url,
                theme: trainer.theme as 'light' | 'dark' | 'system' | null,
            }}
        />
    )
}
