// ============================================================================
// Asaas — Subaccount KYC documents
// ============================================================================
// Two-step submission:
//   1. listPendingDocuments(apiKey) → lista grupos de documentos esperados
//   2a. Pra grupos com onboardingUrl: abrir o link no navegador (cadastro.io,
//       fluxo white-label do Asaas).
//   2b. Pra grupos SEM onboardingUrl: uploadDocument(apiKey, groupId, file)
//
// Ambas as chamadas usam a apiKey DA SUBCONTA do trainer (não a principal).
// ============================================================================

import type { AsaasDocumentGroup } from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface ListDocumentsRaw {
    data?: AsaasDocumentGroup[]
    totalCount?: number
}

/**
 * Lista os grupos de documentos pendentes/já aprovados/rejeitados da
 * subconta. Asaas exige aguardar ~15s após a criação da subconta antes
 * de chamar — antes disso, a lista pode vir vazia.
 */
export async function listPendingDocuments(
    subaccountApiKey: string
): Promise<AsaasDocumentGroup[]> {
    const raw = await asaasRequest<ListDocumentsRaw>({
        apiKey: subaccountApiKey,
        path: '/myAccount/documents',
    })
    return raw.data ?? []
}

/**
 * Envia um arquivo pra um grupo de documentos que NÃO possui onboardingUrl.
 * Tenta enviar via API; se o grupo só aceita onboardingUrl, o Asaas retorna 400.
 *
 * Aceita o arquivo como ArrayBuffer + nome + mime, pra ser usado tanto
 * em servidor quanto em browser.
 */
export async function uploadDocument(
    subaccountApiKey: string,
    documentGroupId: string,
    file: { data: ArrayBuffer | Blob; filename: string; contentType: string },
    documentType: string = 'IDENTIFICATION'
): Promise<AsaasDocumentGroup> {
    const form = new FormData()
    const blob =
        file.data instanceof Blob
            ? file.data
            : new Blob([file.data], { type: file.contentType })
    form.append('documentFile', blob, file.filename)
    form.append('type', documentType)

    // The Asaas client wraps fetch with auth headers + retry. For multipart we
    // need direct fetch because asaasRequest assumes JSON. Build URL inline.
    const env = process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox'
    const base =
        env === 'production'
            ? 'https://api.asaas.com/v3'
            : 'https://sandbox.asaas.com/api/v3'
    const url = `${base}/myAccount/documents/${encodeURIComponent(documentGroupId)}`

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            access_token: subaccountApiKey,
            'User-Agent': 'Kinevo/1.0',
            Accept: 'application/json',
            // Don't set Content-Type — fetch + FormData adds boundary automatically
        },
        body: form,
        signal: AbortSignal.timeout(60_000), // upload can be slower than JSON calls
    })
    const text = await res.text()
    let parsed: unknown = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }

    if (!res.ok) {
        const errBody = parsed as { errors?: Array<{ description?: string }> } | null
        const msg = errBody?.errors?.[0]?.description ?? `Falha no upload (${res.status})`
        throw new Error(msg)
    }
    return parsed as AsaasDocumentGroup
}

/**
 * Resumo amigável do estado dos documentos pendentes.
 */
export function summarizeDocuments(groups: AsaasDocumentGroup[]): {
    total: number
    pending: number
    approved: number
    rejected: number
    blockingOnboarding: boolean   // tem algum com onboardingUrl pendente
} {
    let pending = 0
    let approved = 0
    let rejected = 0
    let blockingOnboarding = false
    for (const g of groups) {
        if (g.status === 'APPROVED') approved++
        else if (g.status === 'REJECTED') rejected++
        else {
            pending++
            if (g.onboardingUrl) blockingOnboarding = true
        }
    }
    return { total: groups.length, pending, approved, rejected, blockingOnboarding }
}
