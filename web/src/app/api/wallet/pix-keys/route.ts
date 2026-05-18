// ============================================================================
// GET, POST /api/wallet/pix-keys
// ============================================================================
// GET: lists the trainer's saved PIX keys.
// POST: adds a PIX key (after validating with Asaas + format check).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, isPixKeyFormatValid, normalizePixKey, validatePixKey } from '@/lib/asaas'
import type { PixKeyType } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

interface AddPixKeyBody {
    alias?: string
    pixKey?: string
    keyType?: PixKeyType
    isDefault?: boolean
}

function pixFormatHint(keyType: PixKeyType): string {
    switch (keyType) {
        case 'CPF':
            return 'CPF inválido. Use 11 dígitos (com ou sem pontuação).'
        case 'CNPJ':
            return 'CNPJ inválido. Use 14 dígitos (com ou sem pontuação).'
        case 'EMAIL':
            return 'Email inválido. Confira se digitou corretamente.'
        case 'PHONE':
            return 'Telefone inválido. Use DDD + número (ex: 11999998888).'
        case 'EVP':
            return 'Chave aleatória inválida. Deve estar no formato UUID (ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).'
        default:
            return 'Formato da chave PIX inválido.'
    }
}

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const { data, error } = await supabaseAdmin
            .from('pix_keys')
            .select('id, alias, pix_key, key_type, owner_name, bank_name, is_default, validated_at, created_at')
            .eq('trainer_id', trainer.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ data: data ?? [] })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/pix-keys GET] Error:', err)
        return NextResponse.json({ error: 'Erro ao listar chaves PIX' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    let body: AddPixKeyBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    if (!body.alias?.trim()) return NextResponse.json({ error: 'alias é obrigatório' }, { status: 400 })
    if (!body.pixKey?.trim()) return NextResponse.json({ error: 'pixKey é obrigatório' }, { status: 400 })
    if (!body.keyType) return NextResponse.json({ error: 'keyType é obrigatório' }, { status: 400 })
    if (!isPixKeyFormatValid(body.pixKey, body.keyType)) {
        return NextResponse.json({
            error: pixFormatHint(body.keyType),
        }, { status: 400 })
    }

    // Normaliza ANTES de validar/persistir: CPF/CNPJ vira só dígitos, PHONE vira
    // E.164 (+55…), EMAIL/EVP viram lowercase. Garante consistência entre o que
    // a Asaas valida e o que persistimos no banco.
    const normalizedKey = normalizePixKey(body.pixKey, body.keyType)

    try {
        const trainer = await requireTrainer(request)
        const apiKey = await getDecryptedApiKey(trainer.id)

        const validation = await validatePixKey(apiKey, normalizedKey, body.keyType)
        if (!validation.valid) {
            return NextResponse.json({
                error: 'Chave PIX não encontrada no Banco Central. Confira se a chave está cadastrada no seu banco.',
            }, { status: 422 })
        }

        // If this key is being marked default, clear other defaults first
        if (body.isDefault) {
            await supabaseAdmin
                .from('pix_keys')
                .update({ is_default: false })
                .eq('trainer_id', trainer.id)
        }

        const { data, error } = await supabaseAdmin
            .from('pix_keys')
            .insert({
                trainer_id: trainer.id,
                alias: body.alias.trim(),
                pix_key: normalizedKey,
                key_type: body.keyType,
                owner_name: validation.ownerName ?? null,
                bank_name: validation.bankName ?? null,
                is_default: body.isDefault ?? false,
                validated_at: new Date().toISOString(),
            })
            .select('id, alias, pix_key, key_type, owner_name, bank_name, is_default, validated_at')
            .single()
        if (error) throw error

        return NextResponse.json(data, { status: 201 })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            return NextResponse.json({ error: err.message }, { status: 502 })
        }
        console.error('[wallet/pix-keys POST] Error:', err)
        return NextResponse.json({ error: 'Erro ao adicionar chave PIX' }, { status: 500 })
    }
}
