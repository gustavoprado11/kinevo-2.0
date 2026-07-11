import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import { markAsPaidCore } from '@/actions/financial/contracts-core'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Endpoint Bearer usado pelo app MOBILE. Delega ao markAsPaidCore — o MESMO
// caminho da Server Action web e do MCP — que traz a idempotência determinística
// (chave manual_<contrato>_<período> + unique da migration 220, evitando linha
// duplicada E avanço duplo de período no retry) e a guarda de asaas_auto_recurring
// (registrar pago local não pausa o débito no cartão → cobrança dupla no aluno).
// Antes este route tinha uma reimplementação própria SEM as duas proteções.
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    let body: { contractId?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { contractId } = body
    if (!contractId) {
        return NextResponse.json({ error: 'contractId é obrigatório' }, { status: 400 })
    }
    if (!UUID_RE.test(contractId)) {
        return NextResponse.json({ error: 'Formato de ID inválido' }, { status: 400 })
    }

    // Get trainer
    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    // Rate limit: 10/min, 50/day per trainer
    const rl = await consumeRateLimit(`financial:mark-paid:${trainer.id}`, { perMinute: 10, perDay: 50 })
    if (!rl.allowed) {
        return NextResponse.json({ error: rl.error }, { status: 429 })
    }

    try {
        const result = await markAsPaidCore(supabaseAdmin, trainer.id, { contractId })
        if (result.error) {
            const status = result.error === 'Contrato não encontrado' ? 404
                : result.error === 'Sem permissão' ? 403
                : 400
            return NextResponse.json({ error: result.error }, { status })
        }
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[mark-paid] Error:', err)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
