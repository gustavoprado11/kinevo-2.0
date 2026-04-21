// TEMPORARY — remove after walk-through passes.
// Registered as follow-up in docs/specs/logs/fase-2.5-execucao.md §6.
//
// Sanity-checks the smart-v2 LLM path end-to-end against the real OpenAI API,
// without touching Supabase. Builds synthetic profile + enriched context,
// renders the 3-layer prompt, calls the model with structured_output=true,
// then dumps the raw response body and (on success) the rules-validator
// verdict.
//
// Usage:
//   KINEVO_LLM_DEBUG_PAYLOAD=1 npx tsx web/scripts/debug-smart-v2.ts [--model=gpt-4.1-mini|gpt-4o-mini]
//
// Reads OPENAI_API_KEY from the environment (and .env.local via Next.js
// conventions if you invoke through npm scripts). Fails loudly if missing.

import { readFileSync } from 'fs'
import { resolve } from 'path'

import { buildSmartV2Prompt } from '../src/lib/prescription/prompt-builder-v2'
import { callLLM, type LLMModel } from '../src/lib/prescription/llm-client'
import { validateCompactGeneration } from '../src/lib/prescription/schemas'
import { enrichCompactOutput } from '../src/lib/prescription/output-enricher'
import { validatePrescriptionAgainstRules } from '../src/lib/prescription/rules-validator'
import { buildConstraints } from '../src/lib/prescription/constraints-engine'

import type {
    PrescriptionExerciseRef,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'
import type { EnrichedStudentContextV2 } from '../src/lib/prescription/context-enricher-v2'

// ── Load .env.local manually (this script bypasses Next.js) ────────────────

function loadDotEnvLocal(): void {
    const candidates = [
        resolve(process.cwd(), '.env.local'),
        resolve(process.cwd(), 'web/.env.local'),
    ]
    for (const path of candidates) {
        try {
            const raw = readFileSync(path, 'utf8')
            for (const line of raw.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed || trimmed.startsWith('#')) continue
                const eq = trimmed.indexOf('=')
                if (eq < 0) continue
                const key = trimmed.slice(0, eq).trim()
                let value = trimmed.slice(eq + 1).trim()
                if (
                    (value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))
                ) {
                    value = value.slice(1, -1)
                }
                if (!(key in process.env)) process.env[key] = value
            }
            console.log(`[debug-smart-v2] loaded env from ${path}`)
            return
        } catch { /* try next */ }
    }
}

loadDotEnvLocal()

if (!process.env.OPENAI_API_KEY) {
    throw new Error(
        'OPENAI_API_KEY not found in environment. Set it in .env.local or export it before running.',
    )
}

// ── CLI args ───────────────────────────────────────────────────────────────

function parseModelArg(): LLMModel {
    const arg = process.argv.find(a => a.startsWith('--model='))
    if (!arg) return 'gpt-4.1-mini'
    const value = arg.slice('--model='.length)
    if (value === 'gpt-4.1-mini' || value === 'gpt-4o-mini') return value
    throw new Error(`unsupported --model=${value}; use gpt-4.1-mini or gpt-4o-mini`)
}

const model = parseModelArg()
console.log(`[debug-smart-v2] model=${model}`)

// ── Fixtures ───────────────────────────────────────────────────────────────

function ex(id: string, name: string, groups: string[], compound: boolean, pattern?: string): PrescriptionExerciseRef {
    return {
        id, name,
        muscle_group_names: groups,
        equipment: 'barbell',
        is_compound: compound,
        difficulty_level: 'intermediate',
        is_primary_movement: compound,
        session_position: 'middle',
        movement_pattern: pattern ?? null,
        movement_pattern_family: null,
        fatigue_class: 'moderate',
        prescription_notes: null,
    }
}

const exercises: PrescriptionExerciseRef[] = [
    ex('ex-001', 'Supino Reto',             ['Peito'],              true,  'horizontal_push'),
    ex('ex-002', 'Supino Inclinado Barra',  ['Peito'],              true,  'incline_push'),
    ex('ex-003', 'Agachamento Livre',       ['Quadríceps'],         true,  'squat'),
    ex('ex-004', 'Leg Press',               ['Quadríceps'],         true,  'squat'),
    ex('ex-005', 'Stiff',                   ['Posterior de Coxa'],  true,  'hinge'),
    ex('ex-006', 'Remada Curvada',          ['Costas'],             true,  'horizontal_pull'),
    ex('ex-007', 'Puxada Frente',           ['Costas'],             true,  'vertical_pull'),
    ex('ex-008', 'Desenvolvimento Militar', ['Ombros'],             true,  'vertical_push'),
    ex('ex-009', 'Elevação Lateral',        ['Ombros'],             false, 'lateral_raise'),
    ex('ex-010', 'Rosca Direta',            ['Bíceps'],             false, 'curl'),
    ex('ex-011', 'Tríceps Corda',           ['Tríceps'],            false, 'pushdown'),
    ex('ex-012', 'Panturrilha em Pé',       ['Panturrilha'],        false, 'calf_raise'),
]

const profile: StudentPrescriptionProfile = {
    id: 'debug-profile', student_id: 'debug-student', trainer_id: 'debug-trainer',
    training_level: 'intermediate',
    goal: 'hypertrophy',
    available_days: [1, 3, 5],
    session_duration_minutes: 60,
    available_equipment: ['academia_completa'],
    favorite_exercise_ids: [],
    disliked_exercise_ids: [],
    medical_restrictions: [],
    ai_mode: 'auto',
    cycle_observation: null,
    adherence_rate: null,
    avg_session_duration_minutes: null,
    last_calculated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

const context: EnrichedStudentContextV2 = {
    student_name: 'Debug Student',
    previous_programs: [],
    load_progression: [],
    session_patterns: {
        preferred_days: [],
        avg_session_duration_minutes: null,
        dropout_rate_by_workout: {},
        total_sessions_4w: 0,
        completed_sessions_4w: 0,
    },
    previous_exercise_ids: [],
    anamnese_summary: 'Aluno intermediário, hipertrofia, 3 dias/semana, 60 min. Equipamento: academia_completa.',
    performance_summary: {
        stagnated_exercises: [],
        progressing_well: [],
        last_session_dates: [],
    },
    adherence: { rate_last_4_weeks: 0, bucket: 'baixa' },
    trainer_observations: [],
    active_injuries: [],
    equipment_preference: 'academia_completa',
    is_new_student: true,
}

// ── Build prompt + call ────────────────────────────────────────────────────

async function main(): Promise<void> {
    const prompt = buildSmartV2Prompt({
        trainerId: 'debug-trainer',
        exercises,
        profile,
        context,
    })

    console.log('[debug-smart-v2] prompt sizes:',
        `system=${prompt.system.length} chars, user=${prompt.user.length} chars, pool_version=${prompt.pool_version}`,
    )

    const started = Date.now()
    const result = await callLLM({
        model,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        max_tokens: 6000,
        temperature: 0.5,
        timeout_ms: 60_000,
        structured_output: true,
    })
    const ms = Date.now() - started

    console.log(`[debug-smart-v2] call finished in ${ms}ms status=${result.status} model=${result.model} http_status=${result.http_status ?? '-'}`)

    if (result.status !== 'success' || !result.data) {
        console.error('[debug-smart-v2] FAILED — see [LLMClient] body=... above for the OpenAI error detail.')
        process.exitCode = 1
        return
    }

    // Parse + validate
    let parsed
    try {
        parsed = JSON.parse(result.data)
    } catch (err) {
        console.error('[debug-smart-v2] response is not valid JSON:', err)
        process.exitCode = 1
        return
    }

    const compact = validateCompactGeneration(parsed)
    if (!compact) {
        console.error('[debug-smart-v2] validateCompactGeneration rejected the response')
        console.error('Raw content (first 1000 chars):', result.data.slice(0, 1000))
        process.exitCode = 1
        return
    }

    const exerciseMap = new Map(exercises.map(e => [e.id, e]))
    const constraints = buildConstraints(profile, {
        student_name: context.student_name,
        previous_programs: context.previous_programs,
        load_progression: context.load_progression,
        session_patterns: context.session_patterns,
        previous_exercise_ids: context.previous_exercise_ids,
    }, [])
    const snapshot = enrichCompactOutput(compact, exerciseMap, constraints, profile)
    const validated = validatePrescriptionAgainstRules(snapshot, exerciseMap, profile)

    console.log('[debug-smart-v2] SUCCESS ✔')
    console.log('  program.name      =', compact.program.name)
    console.log('  workouts          =', compact.workouts.length)
    console.log('  tokens_input      =', result.usage?.input_tokens, '(cached:', result.usage?.cached_input_tokens, ')')
    console.log('  tokens_output     =', result.usage?.output_tokens)
    console.log('  cost_usd          = $', result.usage?.cost_usd.toFixed(6))
    console.log('  rule_violations   =', validated.violations.length)
    if (validated.violations.length > 0) {
        for (const v of validated.violations) {
            console.log(`    - [${v.severity}] ${v.rule_id} (workout ${v.workout_index}, item ${v.item_index})`)
        }
    }
}

main().catch(err => {
    console.error('[debug-smart-v2] unexpected error:', err)
    process.exitCode = 1
})
