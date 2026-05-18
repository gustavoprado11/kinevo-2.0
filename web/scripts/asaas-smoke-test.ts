#!/usr/bin/env -S npx tsx
/* eslint-disable no-console */
// ============================================================================
// Asaas — Smoke test end-to-end (sandbox)
// ============================================================================
// Rode em sandbox antes de subir pra produção. Cobre o ciclo completo:
//   1. Cria subconta de treinador fake
//   2. Cria customer (aluno) dentro dela
//   3. Cria cobrança PIX de R$ 1,00
//   4. Simula pagamento (endpoint de teste do Asaas)
//   5. Cria chave PIX e simula saque
//   6. Imprime ✅ / ❌ por etapa
//
// Use:   ASAAS_ENV=sandbox ASAAS_MAIN_API_KEY=$aact_... npx tsx scripts/asaas-smoke-test.ts
//
// O script lê env do .env.local automaticamente se você usar `npx tsx --env-file=.env.local`.
// ============================================================================

import {
    asaasRequest,
    createSubaccount,
    createCustomer,
    createPayment,
    createTransfer,
    validatePixKey,
    getBalance,
    AsaasApiError,
} from '../src/lib/asaas'

interface Step {
    name: string
    run: () => Promise<void>
}

const ctx: Record<string, string> = {}

/**
 * Gera um CPF válido aleatório (passa no algoritmo de validação módulo 11).
 * Necessário em sandbox porque CPFs hardcoded podem já ter sido usados por
 * outros devs (o sandbox do Asaas é compartilhado).
 */
function randomValidCpf(): string {
    const digits: number[] = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
    const calcDigit = (slice: number[], startWeight: number): number => {
        const sum = slice.reduce((acc, d, i) => acc + d * (startWeight - i), 0)
        const rem = sum % 11
        return rem < 2 ? 0 : 11 - rem
    }
    digits.push(calcDigit(digits, 10))
    digits.push(calcDigit(digits, 11))
    return digits.join('')
}

async function step(name: string, fn: () => Promise<void>): Promise<boolean> {
    process.stdout.write(`\n→ ${name}... `)
    try {
        await fn()
        console.log('✅')
        return true
    } catch (err) {
        console.log('❌')
        if (err instanceof AsaasApiError) {
            console.error(`  Asaas error ${err.status}:`, JSON.stringify(err.body, null, 2))
        } else if (err instanceof Error) {
            console.error(`  ${err.message}`)
        } else {
            console.error('  Unknown error:', err)
        }
        return false
    }
}

async function main() {
    console.log('===========================================')
    console.log(' Asaas smoke test — Kinevo Wallet')
    console.log('===========================================')
    console.log(`Env: ${process.env.ASAAS_ENV ?? 'sandbox (default)'}`)
    if (!process.env.ASAAS_MAIN_API_KEY) {
        console.error('\n❌ ASAAS_MAIN_API_KEY ausente. Defina em .env.local ou exporte.')
        process.exit(1)
    }

    const ok1 = await step('1. Criar subconta de treinador (KYC sandbox auto-aprova)', async () => {
        const suffix = Date.now().toString().slice(-6)
        const trainerCpf = randomValidCpf()
        ctx.trainerCpf = trainerCpf
        const account = await createSubaccount({
            name: `Treinador Smoke ${suffix}`,
            email: `smoke+${suffix}@kinevo.test`,
            cpfCnpj: trainerCpf,         // CPF aleatório válido (sandbox compartilhado)
            birthDate: '1990-01-15',
            mobilePhone: '11987654321',
            address: 'Rua Teste',
            addressNumber: '100',
            province: 'Centro',
            postalCode: '01001000',
            incomeValue: 5000,
        })
        ctx.subaccountApiKey = account.apiKey!
        ctx.subaccountWalletId = account.walletId
        ctx.subaccountId = account.id
        console.log(`\n  account.id=${account.id}  walletId=${account.walletId}  status=${account.accountStatus}`)
    })
    if (!ok1) return process.exit(1)

    const ok2 = await step('2. Criar customer (aluno) dentro da subconta', async () => {
        const studentCpf = randomValidCpf()
        ctx.studentCpf = studentCpf
        const customer = await createCustomer(ctx.subaccountApiKey, {
            name: 'Aluno Smoke',
            email: 'aluno.smoke@kinevo.test', // dummy fixture (.test TLD reserved)
            cpfCnpj: studentCpf,        // CPF aleatório válido (sandbox compartilhado)
            mobilePhone: '11988776655',
            externalReference: `student-smoke-${Date.now()}`,
        })
        ctx.customerId = customer.id
        console.log(`\n  customer.id=${customer.id}`)
    })
    if (!ok2) return process.exit(1)

    const ok3 = await step('3. Criar cobrança PIX de R$ 5,00 (mínimo do Asaas com UNDEFINED)', async () => {
        const payment = await createPayment(ctx.subaccountApiKey, {
            customer: ctx.customerId,
            billingType: 'UNDEFINED',
            value: 5.00,
            dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
            description: 'Smoke test Carteira Kinevo',
            externalReference: `smoke-${Date.now()}`,
        })
        ctx.paymentId = payment.id
        ctx.invoiceUrl = payment.invoiceUrl
        console.log(`\n  payment.id=${payment.id}\n  invoiceUrl=${payment.invoiceUrl}`)
    })
    if (!ok3) return process.exit(1)

    const ok4 = await step('4. Simular pagamento (recebido) via endpoint de teste', async () => {
        // Asaas sandbox: simulação direta via PUT /payments/{id}/receiveInCash
        await asaasRequest({
            apiKey: ctx.subaccountApiKey,
            method: 'POST',
            path: `/payments/${ctx.paymentId}/receiveInCash`,
            body: {
                paymentDate: new Date().toISOString().slice(0, 10),
                value: 5.00,
                notifyCustomer: false,
            },
        })
    })
    if (!ok4) return process.exit(1)

    await step('5. Consultar saldo da subconta', async () => {
        const balance = await getBalance(ctx.subaccountApiKey)
        console.log(`\n  balance=R$ ${balance.balance.toFixed(2)}`)
    })

    await step('6. Validar uma chave PIX (email fake — espera-se ❌ "não encontrada")', async () => {
        // Não vai retornar valid:true em sandbox a menos que o email esteja cadastrado.
        // Esperamos que o método responda (mesmo com valid:false) sem lançar.
        const validation = await validatePixKey(ctx.subaccountApiKey, 'naoexiste@email.com', 'EMAIL')
        console.log(`\n  valid=${validation.valid}`)
    })

    // PIX out só funciona em sandbox depois do saldo ter sido liberado, o que
    // pode levar alguns minutos. Esse passo é informativo — pode falhar com
    // "saldo insuficiente" e mesmo assim o resto está OK.
    await step('7. Solicitar saque (pode falhar se saldo não liberado ainda — informativo)', async () => {
        try {
            const transfer = await createTransfer(ctx.subaccountApiKey, {
                value: 2.50,
                pixAddressKey: 'smoke+saque@kinevo.test',
                pixAddressKeyType: 'EMAIL',
                description: 'Smoke test',
            })
            console.log(`\n  transfer.id=${transfer.id} status=${transfer.status}`)
        } catch (err) {
            if (err instanceof AsaasApiError && err.status === 400) {
                console.log(`\n  (esperado em sandbox antes do saldo liberar): ${err.message}`)
                return
            }
            throw err
        }
    })

    console.log('\n===========================================')
    console.log(' ✅ Smoke test concluído')
    console.log('===========================================')
    console.log('\nDados criados (úteis pra debug):')
    console.log(JSON.stringify(ctx, null, 2))
}

main().catch(err => {
    console.error('\n💥 Erro inesperado:', err)
    process.exit(1)
})
