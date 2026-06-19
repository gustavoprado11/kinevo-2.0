// Teste LIVE de roteamento (gated por RUN_DRAFT_E2E=1) — NÃO roda na suíte normal.
// Valida o ELO que o teste de RPC não cobre: dado um aluno em foco, o LLM
// (gpt-4.1-mini real, via runAssistantTurn com o código local) escolhe a tool
// kinevo_create_student_draft_program (rascunho-do-aluno) — NÃO o template da
// Biblioteca nem o gerador removido. Usa a conta de teste (sem billing real) e
// LIMPA o rascunho + o uso de IA gerados no fim (sempre, via finally).
//
// Uso: RUN_DRAFT_E2E=1 npx vitest run src/lib/assistant/draft-routing.live.test.ts

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

const RUN = process.env.RUN_DRAFT_E2E === '1'

// Conta de teste dedicada (mesma do ai-platform-e2e) + seu self-student.
const TEST_TRAINER_ID = '90b1d65f-5873-4d3d-a960-507b01e7dc0d'

function loadEnv(): { url: string; key: string } {
    const raw = readFileSync(resolve(import.meta.dirname, '../../../.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
        }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY ausente em .env.local')
    return { url, key }
}

const DRAFT_TOOL = 'kinevo_create_student_draft_program'

describe.skipIf(!RUN)('LIVE — roteamento do LLM p/ rascunho-do-aluno', () => {
    it('com aluno em foco, o assistente chama kinevo_create_student_draft_program (não template)', async () => {
        const { url, key } = loadEnv()
        const admin: SupabaseClient<Database> = createClient<Database>(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
        })

        const { data: self } = await admin
            .from('students')
            .select('id, name')
            .eq('coach_id', TEST_TRAINER_ID)
            .limit(1)
            .single()
        expect(self?.id).toBeTruthy()

        const cleanup = async () => {
            await admin
                .from('assigned_programs')
                .delete()
                .eq('student_id', self!.id)
                .eq('status', 'draft')
                .eq('ai_generated', true)
            await admin.from('ai_usage_events').delete().eq('trainer_id', TEST_TRAINER_ID)
            await admin.from('ai_usage_periods').delete().eq('trainer_id', TEST_TRAINER_ID)
        }

        try {
            const { runAssistantTurn } = await import('./command-engine')

            // Conversa multi-turno realista: o assistente pode ler contexto e
            // PERGUNTAR (HITL) antes de montar. Respondemos de forma permissiva
            // ("você decide") e seguimos até ele AGIR (criar o rascunho).
            const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
            let input =
                `Monta um programa de hipertrofia para ${self!.name}: 3x por semana, divisão ABC ` +
                `(treino A seg, B qua, C sex), foco equilibrado em corpo inteiro SEM ênfase em grupo específico, ` +
                `academia completa, você escolhe os exercícios. NÃO me pergunte nada — crie o rascunho-do-aluno agora.`
            const allExecuted: string[] = []
            let built = false

            for (let turn = 1; turn <= 3 && !built; turn++) {
                const result = await runAssistantTurn({
                    admin,
                    trainerId: TEST_TRAINER_ID,
                    trainerName: 'Trainer Teste',
                    input,
                    surface: 'workspace',
                    periodType: 'month',
                    studentId: self!.id,
                    history,
                })
                const tools = result.executed.map((e) => e.toolName)
                allExecuted.push(...tools)
                // eslint-disable-next-line no-console
                console.log(`[draft-routing] turno ${turn}:`, tools, '| pergunta?', !!result.question)

                if (tools.includes(DRAFT_TOOL)) {
                    built = true
                    break
                }
                history.push({ role: 'user', content: input })
                history.push({ role: 'assistant', content: result.text || result.question?.question || '...' })
                input = 'Pode decidir você mesmo os dias (seg/qua/sex) e os exercícios. Cria o rascunho agora.'
            }

            // eslint-disable-next-line no-console
            console.log('[draft-routing] tools no total:', allExecuted)

            // O elo sob teste: escolheu a tool de rascunho-do-aluno…
            expect(allExecuted).toContain(DRAFT_TOOL)
            // …e NÃO o template da Biblioteca nem o gerador removido.
            expect(allExecuted).not.toContain('kinevo_create_program_template')
            expect(allExecuted).not.toContain('generateProgram')

            // E um rascunho REAL aterrissou como draft do aluno certo.
            const { data: rows } = await admin
                .from('assigned_programs')
                .select('id, status, student_id, ai_generated')
                .eq('student_id', self!.id)
                .eq('status', 'draft')
                .eq('ai_generated', true)
            expect((rows ?? []).length).toBeGreaterThan(0)
            expect((rows ?? []).every((r) => r.status === 'draft' && r.ai_generated === true)).toBe(true)
        } finally {
            await cleanup()
        }
    }, 240_000)
})
