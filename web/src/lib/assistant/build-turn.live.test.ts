// Teste LIVE do TURNO DE BUILD (gated por RUN_LIVE_BUILD=1) — NÃO roda na suíte.
//
// Prova o fix de 13/jul (list_exercises em LOTE + stopWhen 16 + thinking do
// Gemini) e o critério F1 do Estilo de Prescrição: um turno real de build, com
// LLM real e um treinador QA DESCARTÁVEL semeado aqui mesmo, precisa:
//   1. buscar exercícios em ≤2 chamadas de kinevo_list_exercises (era 10–11
//      seriais — uma por grupo — estourando o teto de passos sem criar nada);
//   2. terminar com kinevo_create_student_draft_program executada com sucesso;
//   3. deixar o rascunho no banco (programa + sessões + itens).
// O quanto o programa honra o ESTILO injetado é julgado por inspeção: o teste
// grava o programa criado + as tools do turno em BUILD_OUT (se definido).
//
//   RUN_LIVE_BUILD=1 npx vitest run src/lib/assistant/build-turn.live
//
// ⚠️ Cria e REMOVE um treinador + aluno QA (auth users inclusos). Best-effort
// cleanup no afterAll mesmo em falha. Custa 1 chamada de LLM de build.

import { describe, it, expect, afterAll } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN = process.env.RUN_LIVE_BUILD === '1'

function loadEnvLocal(): void {
    const raw = readFileSync(resolve(import.meta.dirname, '../../../.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
}

interface Seeded {
    admin: SupabaseClient
    trainerId: string
    trainerAuthId: string
    studentId: string
    studentAuthId: string
}

let seeded: Seeded | null = null

async function seed(): Promise<Seeded> {
    loadEnvLocal()
    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
    )
    const stamp = Date.now()
    const { data: tAuth, error: tAuthErr } = await admin.auth.admin.createUser({
        email: `qa-build-trainer-${stamp}@kinevo.test`,
        password: `Qa!${stamp}build`,
        email_confirm: true,
    })
    if (tAuthErr || !tAuth.user) throw new Error(`auth trainer: ${tAuthErr?.message}`)
    const { data: trainer, error: tErr } = await admin
        .from('trainers')
        .insert({ auth_user_id: tAuth.user.id, name: 'QA Build Trainer', email: tAuth.user.email })
        .select('id')
        .single()
    if (tErr || !trainer) throw new Error(`trainers: ${tErr?.message}`)

    const { data: sAuth, error: sAuthErr } = await admin.auth.admin.createUser({
        email: `qa-build-student-${stamp}@kinevo.test`,
        password: `Qa!${stamp}stud`,
        email_confirm: true,
    })
    if (sAuthErr || !sAuth.user) throw new Error(`auth student: ${sAuthErr?.message}`)
    const { data: student, error: sErr } = await admin
        .from('students')
        .insert({
            auth_user_id: sAuth.user.id,
            coach_id: trainer.id,
            name: 'Aluna QA Hipertrofia',
            email: sAuth.user.email,
            status: 'active',
        })
        .select('id')
        .single()
    if (sErr || !student) throw new Error(`students: ${sErr?.message}`)

    await admin.from('student_prescription_profiles').insert({
        student_id: student.id,
        training_level: 'intermediate',
        goal: 'hypertrophy',
        session_duration_minutes: 60,
        medical_restrictions: [],
    })

    // Estilo do treinador (critério F1): assinatura reconhecível p/ inspeção.
    await admin
        .from('trainers')
        .update({
            prescription_style: {
                version: 1,
                source: 'interview',
                updated_at: new Date().toISOString(),
                mined: null,
                splits_by_frequency: { '5': 'PPL + Upper/Lower' },
                session_naming: null,
                exercises_per_session: { min: 5, max: 6 },
                reps_compound: '5–8',
                reps_accessory: '12–15',
                rest_compound_seconds: { min: 150, max: 180 },
                rest_accessory_seconds: { min: 45, max: 60 },
                weekly_sets_emphasized: { min: 14, max: 18 },
                weekly_sets_principal: null,
                weekly_sets_small: null,
                methods_used: [],
                methods_avoided: [],
                superset_usage: null,
                favorite_exercises: [],
                avoided_exercises: [],
                equipment_notes: null,
                progression: null,
                warmup: null,
                special_populations: null,
                notes: null,
            },
        })
        .eq('id', trainer.id)

    return {
        admin,
        trainerId: trainer.id,
        trainerAuthId: tAuth.user.id,
        studentId: student.id,
        studentAuthId: sAuth.user.id,
    }
}

async function cleanup(s: Seeded): Promise<void> {
    const del = async (fn: () => PromiseLike<unknown>) => {
        try {
            await fn()
        } catch {
            /* best-effort */
        }
    }
    await del(() => s.admin.from('assigned_programs').delete().eq('student_id', s.studentId))
    await del(() => s.admin.from('student_prescription_profiles').delete().eq('student_id', s.studentId))
    await del(() => s.admin.from('assistant_turn_traces').delete().eq('trainer_id', s.trainerId))
    await del(() => s.admin.from('ai_usage_events').delete().eq('trainer_id', s.trainerId))
    await del(() => s.admin.from('students').delete().eq('id', s.studentId))
    await del(() => s.admin.from('trainers').delete().eq('id', s.trainerId))
    await del(() => s.admin.auth.admin.deleteUser(s.studentAuthId))
    await del(() => s.admin.auth.admin.deleteUser(s.trainerAuthId))
}

describe.skipIf(!RUN)('LIVE — turno de build cria o programa dentro do teto de passos', () => {
    afterAll(async () => {
        if (seeded) await cleanup(seeded)
    }, 60_000)

    it('lista exercícios em lote (≤2 chamadas) e cria o rascunho', async () => {
        seeded = await seed()
        // Import dinâmico DEPOIS do loadEnvLocal (supabase-admin lê env no load).
        const { runAssistantTurn } = await import('./command-engine')

        const progress: string[] = []
        const turn = await runAssistantTurn({
            admin: seeded.admin,
            trainerId: seeded.trainerId,
            trainerName: 'QA Build Trainer',
            input:
                'Monta um programa de hipertrofia 5x por semana para a Aluna QA Hipertrofia, com ênfase em glúteo e costas. Pode montar direto, sem me perguntar nada — use seu julgamento.',
            surface: 'workspace',
            periodType: 'month',
            studentId: seeded.studentId,
            onProgress: (label) => progress.push(label),
        })

        // As tools do turno ficam no trace (o `executed` do retorno filtra leituras).
        const { data: traces } = await seeded.admin
            .from('assistant_turn_traces')
            .select('tools, model, output')
            .eq('trainer_id', seeded.trainerId)
            .order('created_at', { ascending: false })
            .limit(1)
        const tools = ((traces?.[0]?.tools ?? []) as Array<{ toolName: string; ok: boolean; args?: unknown }>)
        const listCalls = tools.filter((t) => t.toolName === 'kinevo_list_exercises')
        const createCalls = tools.filter(
            (t) => t.toolName === 'kinevo_create_student_draft_program' && t.ok,
        )

        // O rascunho de verdade, no banco.
        const { data: programs } = await seeded.admin
            .from('assigned_programs')
            .select('id, name, status, assigned_workouts(name, scheduled_days, assigned_workout_items(exercise_name, sets, reps, rest_seconds, exercise_function))')
            .eq('student_id', seeded.studentId)

        const report = {
            model: traces?.[0]?.model,
            toolsInOrder: tools.map((t) => `${t.toolName}${t.ok ? '' : ' (FALHOU)'}`),
            listExerciseArgs: listCalls.map((t) => t.args ?? null),
            listExerciseCalls: listCalls.length,
            progress,
            turnText: turn.text,
            program: programs?.[0] ?? null,
        }
        const out = process.env.BUILD_OUT
        if (out) writeFileSync(out, JSON.stringify(report, null, 2))

        // A REGRESSÃO que este teste trava é a busca POR GRUPO em série (10–11
        // chamadas com muscle_group, uma por grupo, até estourar os passos).
        // Buscas pontuais por NOME (search: 'Hip Thrust') depois do lote são
        // comportamento legítimo — toleradas, com teto frouxo no total.
        const groupFilterCalls = listCalls.filter((t) => {
            const a = (t.args ?? {}) as { muscle_group?: unknown; muscle_groups?: unknown }
            return a.muscle_group !== undefined || a.muscle_groups !== undefined
        })
        expect(
            groupFilterCalls.length,
            `busca por grupo ${groupFilterCalls.length}x — o LOTE (muscle_groups[]) não pegou`,
        ).toBeLessThanOrEqual(2)
        expect(listCalls.length, `kinevo_list_exercises chamado ${listCalls.length}x no total`).toBeLessThanOrEqual(8)
        expect(createCalls.length, `programa não foi criado. tools: ${report.toolsInOrder.join(' → ')} | texto: ${turn.text}`).toBeGreaterThanOrEqual(1)
        expect(programs?.length ?? 0, 'rascunho não está no banco').toBeGreaterThanOrEqual(1)
        expect(programs?.[0]?.status).toBe('draft')
    }, 300_000)
})
