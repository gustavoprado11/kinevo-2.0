// ============================================================================
// Asaas — Transfers (PIX out / saque do treinador)
// ============================================================================
// Roda na subconta do treinador. Asaas debita o saldo dele e envia PIX pra
// qualquer chave externa (mesma titularidade ou terceiros, configurável).
// ============================================================================

import type {
    AsaasTransfer,
    AsaasTransferStatus,
    CreateAsaasTransferInput,
    PixKeyType,
} from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface AsaasTransferRaw {
    id: string
    value: number
    netValue?: number
    status: AsaasTransferStatus
    endToEndIdentifier?: string | null
    failReason?: string | null
    scheduleDate?: string | null
    effectiveDate?: string | null
}

function mapTransfer(raw: AsaasTransferRaw): AsaasTransfer {
    return {
        id: raw.id,
        value: raw.value,
        netValue: raw.netValue ?? raw.value,
        status: raw.status,
        endToEndIdentifier: raw.endToEndIdentifier ?? null,
        failReason: raw.failReason ?? null,
        scheduleDate: raw.scheduleDate ?? null,
        effectiveDate: raw.effectiveDate ?? null,
    }
}

/**
 * Solicita um saque via PIX. Idempotencyâ via `Asaas-Idempotency-Key` montado
 * com trainer + valor + timestamp grosseiro (minuto) — evita saque duplicado
 * se o trainer clicar duas vezes.
 */
export async function createTransfer(
    subaccountApiKey: string,
    input: CreateAsaasTransferInput,
    idemKey?: string
): Promise<AsaasTransfer> {
    const body = {
        value: round2(input.value),
        pixAddressKey: input.pixAddressKey,
        pixAddressKeyType: input.pixAddressKeyType,
        description: input.description ?? 'Saque Carteira Kinevo',
        operationType: 'PIX',
    }

    const raw = await asaasRequest<AsaasTransferRaw>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: '/transfers',
        body,
        idempotencyKey: idemKey,
    })
    return mapTransfer(raw)
}

export async function getTransfer(
    subaccountApiKey: string,
    transferId: string
): Promise<AsaasTransfer> {
    const raw = await asaasRequest<AsaasTransferRaw>({
        apiKey: subaccountApiKey,
        path: `/transfers/${encodeURIComponent(transferId)}`,
    })
    return mapTransfer(raw)
}

function round2(n: number): number {
    return Math.round(n * 100) / 100
}

export type { PixKeyType }
