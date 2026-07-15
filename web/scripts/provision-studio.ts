#!/usr/bin/env -S npx tsx
/* eslint-disable no-console */
// ============================================================================
// Estúdios v1 — provisionamento manual de estúdio (piloto, sem checkout)
// ============================================================================
// Cria a organization (status 'active'), vincula o owner e — opcionalmente —
// backfilla students.organization_id dos membros ativos. O backfill é SEMPRE
// por-org via este script; nunca por migration global (há org de teste residual
// em prod cujos membros têm alunos reais que não podem ser contaminados).
//
// Uso (na pasta web/):
//   npx tsx --env-file=.env.local scripts/provision-studio.ts \
//     --name "Estúdio X" --owner-email dono@estudio.com [--seats 5] \
//     [--status active|trialing] [--owner-is-coach true|false]
//
//   # depois de adicionar coaches pela aba Equipe:
//   npx tsx --env-file=.env.local scripts/provision-studio.ts \
//     --org <organization_id> --backfill
// ============================================================================

import { createClient } from '@supabase/supabase-js'

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`)
    if (i === -1) return undefined
    const v = process.argv[i + 1]
    return v && !v.startsWith('--') ? v : 'true'
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Rode com --env-file=.env.local (precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
}
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

async function backfill(orgId: string) {
    const { data: members, error: mErr } = await admin
        .from('organization_members')
        .select('trainer_id')
        .eq('organization_id', orgId)
        .eq('status', 'active')
    if (mErr) throw mErr
    const trainerIds = (members ?? []).map((m) => m.trainer_id)
    if (trainerIds.length === 0) {
        console.log('ℹ️ Org sem membros ativos — nada a backfillar.')
        return
    }
    const { data: updated, error: uErr } = await admin
        .from('students')
        .update({ organization_id: orgId })
        .in('coach_id', trainerIds)
        .is('organization_id', null)
        .select('id')
    if (uErr) throw uErr
    console.log(`✅ Backfill: ${updated?.length ?? 0} aluno(s) vinculados à org ${orgId} (${trainerIds.length} treinador(es)).`)
}

async function main() {
    // Modo backfill-only
    const orgArg = arg('org')
    if (orgArg && arg('backfill')) {
        await backfill(orgArg)
        return
    }

    const name = arg('name')
    const ownerEmail = arg('owner-email')
    if (!name || !ownerEmail) {
        console.error('❌ Uso: --name "Estúdio X" --owner-email dono@x.com [--seats N] [--status active] [--backfill]')
        process.exit(1)
    }
    const seats = arg('seats') ? Number(arg('seats')) : null
    const status = arg('status') ?? 'active'
    const ownerIsCoach = arg('owner-is-coach') !== 'false'

    const { data: trainer, error: tErr } = await admin
        .from('trainers')
        .select('id, name')
        .eq('email', ownerEmail)
        .single()
    if (tErr || !trainer) {
        console.error(`❌ Treinador não encontrado para ${ownerEmail} — crie a conta pelo signup primeiro.`)
        process.exit(1)
    }

    const { data: existing } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')
        .maybeSingle()
    if (existing) {
        console.error(`❌ ${ownerEmail} já pertence à org ${existing.organization_id} (1 org/treinador na v1).`)
        process.exit(1)
    }

    const { data: org, error: oErr } = await admin
        .from('organizations')
        .insert({ name, subscription_status: status, seat_limit: seats })
        .select('id')
        .single()
    if (oErr || !org) {
        console.error('❌ Erro ao criar org:', oErr)
        process.exit(1)
    }

    const { error: mErr } = await admin.from('organization_members').insert({
        organization_id: org.id,
        trainer_id: trainer.id,
        role: 'owner',
        is_coach: ownerIsCoach,
        status: 'active',
        joined_at: new Date().toISOString(),
    })
    if (mErr) {
        console.error('❌ Erro ao vincular owner (org órfã removida):', mErr)
        await admin.from('organizations').delete().eq('id', org.id)
        process.exit(1)
    }

    console.log(`✅ Estúdio "${name}" criado: org=${org.id} · owner=${trainer.name} (${ownerEmail}) · status=${status} · seats=${seats ?? '∞'} · owner treina=${ownerIsCoach}`)

    if (arg('backfill')) await backfill(org.id)

    console.log('➡️ Próximo passo: adicionar coaches pela aba Equipe (Configurações → Organização) e rodar --org ' + org.id + ' --backfill.')
}

main().catch((e) => {
    console.error('❌ Falha inesperada:', e)
    process.exit(1)
})
