// ============================================================================
// POST /api/wallet/link
// ============================================================================
// Vincula uma conta Asaas existente ao Kinevo. Usado por treinadores que já
// têm conta Asaas e não querem (ou não podem) criar uma subconta nova com o
// mesmo CPF/email.
//
// O treinador cola apenas dois campos:
//   - apiKey   → começa com `$aact_`
//   - walletId → UUID exibido em "Wallets" no painel Asaas
//
// O servidor valida a chave chamando /v3/myAccount/info (com fallback pra
// /v3/finance/balance), captura nome/CPF/email se disponíveis, e persiste
// account_mode='linked'.
//
// Expected JSON body:
// {
//   "apiKey": "$aact_prod_xxx...",
//   "walletId": "12345678-aaaa-bbbb-cccc-1234567890ab"
// }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError } from '@/lib/asaas'
import { linkExistingAccount, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

interface LinkBody {
    apiKey?: string
    walletId?: string
}

function validate(body: LinkBody): string | null {
    if (typeof body.apiKey !== 'string' || !body.apiKey.trim()) {
        return 'Cole sua chave de API da Asaas pra continuar.'
    }
    if (typeof body.walletId !== 'string' || !body.walletId.trim()) {
        return 'Cole o ID da carteira (Wallet ID) da Asaas pra continuar.'
    }
    if (!body.apiKey.trim().startsWith('$aact_')) {
        return 'A chave de API da Asaas começa com "$aact_". Confira se copiou ela inteira.'
    }
    // Wallet IDs do Asaas são UUIDs. Aceitamos formato flexível, mas exigimos
    // pelo menos 16 caracteres pra evitar typos óbvios.
    if (body.walletId.trim().length < 16) {
        return 'O ID da carteira (Wallet ID) parece incompleto. Confira no painel da Asaas.'
    }
    return null
}

export async function POST(request: NextRequest) {
    let body: LinkBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 })
    }

    const validationError = validate(body)
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)
        const summary = await linkExistingAccount(trainer.id, {
            apiKey: body.apiKey!,
            walletId: body.walletId!,
        })
        return NextResponse.json(summary)
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/link] Asaas error', err.status, err.body)
            // 401/403 here means the API key the user pasted is invalid.
            if (err.status === 401 || err.status === 403) {
                return NextResponse.json(
                    { error: 'A chave de API que você colou parece inválida ou expirada. Volte no painel da Asaas e gere uma nova chave.' },
                    { status: 400 }
                )
            }
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: err.status === 400 ? 400 : 502 }
            )
        }
        console.error('[wallet/link] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro inesperado ao vincular conta'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
