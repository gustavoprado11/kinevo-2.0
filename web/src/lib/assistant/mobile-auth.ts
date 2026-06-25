/**
 * Autenticação Bearer dos endpoints do Assistente para mobile.
 *
 * O app mobile não carrega cookies — autentica via `Authorization: Bearer
 * <supabase_access_token>`. Estes endpoints vivem sob `/api/trainer/*`, que o
 * middleware já exclui da renovação de sessão por cookie (ver src/middleware.ts).
 * CONTRATO DE SEGURANÇA: todo route.ts aqui DEVE validar o token e rejeitar 401
 * se ausente/ inválido — é o que esta função faz.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClientFromToken } from '@/lib/supabase/server-from-token'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface BearerTrainer {
    id: string
    name: string | null
}

/**
 * Resolve o treinador a partir do Bearer token. Retorna o trainer ({id,name})
 * ou uma NextResponse de erro (401/404) pronta para devolver.
 */
export async function resolveTrainerBearer(
    req: NextRequest,
): Promise<BearerTrainer | NextResponse> {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const supabase = createServerClientFromToken(token)
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()
    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }
    return { id: trainer.id, name: trainer.name }
}
