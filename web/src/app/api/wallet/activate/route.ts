// ============================================================================
// POST /api/wallet/activate
// ============================================================================
// Creates the trainer's Asaas subaccount + persists encrypted state.
// Idempotent: returns the existing summary if wallet is already pending/
// awaiting/approved.
//
// Expected JSON body:
// {
//   "name": "João da Silva",
//   "email": "joao@email.com",
//   "cpfCnpj": "12345678900",
//   "birthDate": "1990-05-15",
//   "mobilePhone": "11999999999",
//   "address": "Rua Tal",
//   "addressNumber": "123",
//   "province": "Centro",
//   "postalCode": "01000000",
//   "incomeValue": 5000,
//   "companyType": "INDIVIDUAL"
// }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError } from '@/lib/asaas'
import { activateWallet, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

interface ActivateBody {
    name?: string
    email?: string
    cpfCnpj?: string
    birthDate?: string
    mobilePhone?: string
    address?: string
    addressNumber?: string
    province?: string
    postalCode?: string
    incomeValue?: number
    companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'
}

function validate(body: ActivateBody): string | null {
    const required: Array<keyof ActivateBody> = [
        'name', 'email', 'cpfCnpj', 'birthDate', 'mobilePhone',
        'address', 'addressNumber', 'province', 'postalCode',
    ]
    for (const k of required) {
        const v = body[k]
        if (typeof v !== 'string' || !v.trim()) {
            return `Campo "${k}" é obrigatório`
        }
    }
    const cpfCnpj = (body.cpfCnpj ?? '').replace(/\D/g, '')
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        return 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate ?? '')) {
        return 'birthDate deve estar no formato AAAA-MM-DD'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? '')) {
        return 'Email inválido'
    }
    return null
}

export async function POST(request: NextRequest) {
    let body: ActivateBody
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
        const summary = await activateWallet(trainer.id, {
            name: body.name!,
            email: body.email!,
            cpfCnpj: body.cpfCnpj!,
            birthDate: body.birthDate!,
            mobilePhone: body.mobilePhone!,
            address: body.address!,
            addressNumber: body.addressNumber!,
            province: body.province!,
            postalCode: body.postalCode!,
            incomeValue: body.incomeValue,
            companyType: body.companyType,
        })
        return NextResponse.json(summary)
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/activate] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: err.status === 400 ? 400 : 502 }
            )
        }
        console.error('[wallet/activate] Error:', err)
        // Propagate the actual error message so the UI can show something useful.
        // Sensitive internals never reach here — auth/Asaas errors are caught above.
        const message = err instanceof Error ? err.message : 'Erro inesperado ao ativar carteira'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
