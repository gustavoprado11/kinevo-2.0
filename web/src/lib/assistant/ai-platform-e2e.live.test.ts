// Teste LIVE E2E (gated por RUN_LIVE_E2E=1) — NÃO roda na suíte normal.
// Exercita o encanamento da Fase 0 (IA do Treinador) contra o projeto REAL,
// usando a conta de teste "Trainer Carteira Teste" (tier free, já tem 1 aluno):
//   1. READ via ponte in-memory (kinevo_list_students);
//   2. CAP: 2º aluno bloqueado no Free (já tem o self-student);
//   3. WRITE via execute path (kinevo_update_student, reversível);
//   4. CRÉDITO incrementa em ai_usage_periods (RPC increment_ai_usage).
// Limpa os dados de uso de teste no fim.
//
// Uso: RUN_LIVE_E2E=1 npx vitest run src/lib/assistant/ai-platform-e2e.live.test.ts

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

const RUN = process.env.RUN_LIVE_E2E === '1'

// Conta de teste dedicada (free, 1 self-student) — ver SPEC §5/§Validação.
const TEST_TRAINER_ID = '90b1d65f-5873-4d3d-a960-507b01e7dc0d'

function envValue(raw: string, key: string): string | undefined {
    const m = raw.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
}

function loadEnv(): { url: string; key: string } {
    const raw = readFileSync(resolve(import.meta.dirname, '../../../.env.local'), 'utf8')
    // O encanamento (MCP tools + stripe + supabase-admin) lê várias envs em
    // tempo de import; carrega o .env.local inteiro em process.env.
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
        }
    }
    const url = envValue(raw, 'NEXT_PUBLIC_SUPABASE_URL')
    const key = envValue(raw, 'SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
    return { url, key }
}

describe.skipIf(!RUN)('LIVE E2E — IA do Treinador Fase 0', () => {
    it('ponte read+write, cap bloqueia 2º aluno no Free, crédito incrementa', async () => {
        const { url, key } = loadEnv()
        // O encanamento (MCP tools + supabase-admin) lê estas envs em tempo de import.
        process.env.NEXT_PUBLIC_SUPABASE_URL = url
        process.env.SUPABASE_SERVICE_ROLE_KEY = key

        const admin: SupabaseClient<Database> = createClient<Database>(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
        })

        // Imports dinâmicos: só após as envs estarem setadas.
        const { buildMcpTools, executeMcpToolByName } = await import('./mcp-bridge')
        const { getAiTierForTrainer } = await import('@/lib/auth/get-ai-tier')
        const { assertCanCreateStudent, StudentCapError } = await import('@/lib/limits/student-cap')
        const { recordAiUsage, creditsForTurn, currentPeriodStart } = await import('@/lib/ai-usage/metering')

        // 0. 🔴 Fix crítico LIVE: a conta de teste tem assinatura ATIVA com
        //    stripe_price_id NULL → deve resolver para 'essencial' (NUNCA 'free',
        //    o que quebraria o cap de um pagante). Valida a regressão evitada.
        const tier = await getAiTierForTrainer(admin, TEST_TRAINER_ID)
        expect(tier).toBe('essencial')

        // 1. READ via ponte (subsetting 'alunos').
        const bridge = await buildMcpTools(TEST_TRAINER_ID, { intents: ['alunos'] })
        try {
            const listTool = bridge.tools['kinevo_list_students']
            expect(typeof listTool?.execute).toBe('function')
            const readResult = await listTool!.execute!(
                {},
                { toolCallId: 'e2e-read', messages: [] },
            )
            expect(readResult).toBeTruthy()
        } finally {
            await bridge.close()
        }

        // 2. CAP no Free: a conta já tem 1 aluno → criar o 2º como 'free' é bloqueado.
        let capBlocked = false
        try {
            await assertCanCreateStudent(admin, TEST_TRAINER_ID, 'free')
        } catch (e) {
            capBlocked = e instanceof StudentCapError
        }
        expect(capBlocked).toBe(true)

        // 2b. Pago libera (ilimitado) — não lança.
        await expect(
            assertCanCreateStudent(admin, TEST_TRAINER_ID, 'essencial'),
        ).resolves.toBeUndefined()

        // 3. WRITE via execute path (reversível: altera e restaura o objective).
        const { data: self } = await admin
            .from('students')
            .select('id, objective')
            .eq('coach_id', TEST_TRAINER_ID)
            .limit(1)
            .single()
        expect(self?.id).toBeTruthy()
        const originalObjective = self!.objective ?? ''

        const writeRes = await executeMcpToolByName(TEST_TRAINER_ID, 'kinevo_update_student', {
            student_id: self!.id,
            objective: '[e2e-test]',
        })
        expect(writeRes).toBeTruthy()
        // Restaura o valor original.
        await executeMcpToolByName(TEST_TRAINER_ID, 'kinevo_update_student', {
            student_id: self!.id,
            objective: originalObjective,
        })

        // 4. CRÉDITO incrementa em ai_usage_periods (RPC atômico).
        const periodStart = currentPeriodStart('month')
        const readUsed = async (): Promise<number> => {
            const { data } = await admin
                .from('ai_usage_periods')
                .select('credits_used')
                .eq('trainer_id', TEST_TRAINER_ID)
                .eq('period_type', 'month')
                .eq('period_start', periodStart)
                .maybeSingle()
            return data?.credits_used ?? 0
        }

        const before = await readUsed()
        const credits = creditsForTurn([{ tool: 'kinevo_update_student' }])
        const rec = await recordAiUsage(admin, {
            trainerId: TEST_TRAINER_ID,
            periodType: 'month',
            credits,
            costMicros: 1234,
            events: [{ actionClass: 'write', credits, surface: 'workspace' }],
        })
        expect(rec.ok).toBe(true)
        const after = await readUsed()
        expect(after).toBe(before + credits)

        // CLEANUP: zera o uso de teste (conta de teste — sem billing real).
        await admin.from('ai_usage_events').delete().eq('trainer_id', TEST_TRAINER_ID)
        await admin.from('ai_usage_periods').delete().eq('trainer_id', TEST_TRAINER_ID)
        await admin.from('ai_free_trials').delete().eq('trainer_id', TEST_TRAINER_ID)
    }, 60_000)
})
