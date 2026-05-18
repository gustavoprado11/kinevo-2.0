// ============================================================================
// /financial/pix-keys — Chaves PIX para saque
// ============================================================================
// Server component: lista as chaves do trainer (encriptadas/mascaradas) e
// renderiza o client component pra adicionar/remover/definir padrão.
// ============================================================================

import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PixKeysClient } from './pix-keys-client'
import type { PixKeyType } from '@/lib/asaas'

interface PixKeyRow {
    id: string
    alias: string
    pix_key: string
    key_type: PixKeyType
    owner_name: string | null
    bank_name: string | null
    is_default: boolean
    created_at: string
}

export default async function PixKeysPage() {
    const { trainer } = await getTrainerWithSubscription()

    const { data: pixKeysRaw } = await supabaseAdmin
        .from('pix_keys')
        .select('id, alias, pix_key, key_type, owner_name, bank_name, is_default, created_at')
        .eq('trainer_id', trainer.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

    const pixKeys = (pixKeysRaw ?? []) as PixKeyRow[]

    return (
        <PixKeysClient
            trainer={{
                name: trainer.name,
                email: trainer.email,
                avatarUrl: trainer.avatar_url,
                theme: trainer.theme as 'light' | 'dark' | 'system' | null,
            }}
            pixKeys={pixKeys}
        />
    )
}
