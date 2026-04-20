// ============================================================================
// Kinevo Prescription Engine — 3-layer prompt (smart-v2)
// ============================================================================
// Produces { system, user } for the smart-v2 generation model. Layers ordered
// per spec 06 §5.4 so OpenAI's automatic prompt cache kicks in: Layer 1 (fully
// static) + Layer 2 (trainer pool, stable per trainer_id) compose the system
// prompt — the shared prefix that benefits from caching.
//
// ANY dynamic interpolation in the system prompt invalidates caching for the
// entire call. Keep Layer 1 byte-stable across calls, and Layer 2 byte-stable
// per trainer.

import { createHash } from 'crypto'

import type {
    PrescriptionExerciseRef,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

import { FEW_SHOT_EXAMPLES } from './prompt-examples'
import { PROMPT_VERSION } from './schemas'
import type { EnrichedStudentContextV2 } from './context-enricher-v2'

// ============================================================================
// Public
// ============================================================================

export interface SmartV2PromptInputs {
    trainerId: string
    exercises: PrescriptionExerciseRef[]
    profile: StudentPrescriptionProfile
    context: EnrichedStudentContextV2
}

export interface SmartV2Prompt {
    system: string
    user: string
    prompt_version: string
    pool_version: string
}

export function buildSmartV2Prompt(inputs: SmartV2PromptInputs): SmartV2Prompt {
    const poolVersion = computePoolVersion(inputs.trainerId, inputs.exercises)

    // System = Layer 1 (static) + Layer 2 (trainer-scoped exercise pool).
    // Both must be deterministic to preserve prompt caching.
    const system = [
        renderLayer1(),
        renderLayer2(inputs.exercises, poolVersion),
    ].join('\n\n')

    // User = Layer 3 (dynamic student context) + Layer 4 (final instruction).
    const user = [
        renderLayer3(inputs.profile, inputs.context),
        renderLayer4(),
    ].join('\n\n')

    return { system, user, prompt_version: PROMPT_VERSION, pool_version: poolVersion }
}

// ============================================================================
// Layer 1 — Static system prompt
// ============================================================================

function renderLayer1(): string {
    // MUST be 100% deterministic. No dates, no IDs, no interpolations.
    return [
        '# KINEVO — PRESCRITOR DE TREINOS (v2.5)',
        '',
        'Você é o motor de prescrição do Kinevo, um assistente para treinadores profissionais de educação física no Brasil. Prescreva programas de musculação personalizados, coerentes com evidência e seguros.',
        '',
        '## METODOLOGIA',
        '- Hipertrofia é o objetivo principal do produto; saúde geral, performance e emagrecimento têm variantes de reps/descanso.',
        '- Prefira exercícios compostos como âncoras do treino; use isolados para complementar.',
        '- Volume semanal por grupo escalona com nível: iniciante 8-12, intermediário 12-18, avançado 16-22.',
        '- Sessões curtas (<45 min) reduzem ligeiramente o volume; sessões longas (>75 min) podem usar o limite superior.',
        '',
        '## REGRAS DE DOMÍNIO (não violar)',
        '',
        '### Séries por exercício individual',
        '- COMPOSTO (agachamento, supino, terra, remada, desenvolvimento com barra, etc.): máximo absoluto 4 séries, sem exceção.',
        '- ACESSÓRIO/ISOLADO: iniciante máximo 3, intermediário máximo 4, avançado máximo 5.',
        '',
        '### Limite de 4 séries por grupo',
        '- No máximo UM exercício com 4 séries por grupo muscular em um mesmo treino.',
        '- Quando dois exercícios do mesmo grupo aparecem no mesmo treino: o primeiro tem mais séries, o segundo menos. Nunca 4+4 no mesmo grupo.',
        '',
        '### Grupos tolerantes a 4 séries (para o principal)',
        '- Peito, Costas, Ombros, Quadríceps, Posterior de Coxa, Glúteo, Panturrilha.',
        '',
        '### Grupos capados em 3 séries (para o principal)',
        '- Bíceps, Tríceps, Antebraço, Abdominais/Abdômen.',
        '',
        '### Ordem dentro do treino',
        '- Compostos antes de acessórios.',
        '- Grandes grupos antes de pequenos.',
        '- Finalizar com isolado do grupo prioritário do dia.',
        '',
        '### Reps e descanso por objetivo',
        '- Hipertrofia: 8-12 reps, descanso 60-90s (acessórios 60, compostos pesados 90).',
        '- Força (performance): 3-6 reps, descanso 120-180s.',
        '- Resistência / emagrecimento: 12-20 reps, descanso 30-45s.',
        '- Saúde geral: 8-15 reps, descanso 60s.',
        '',
        '## SPLITS PADRÃO POR FREQUÊNCIA',
        '- 2x/semana: Full body AB.',
        '- 3x iniciante: AB repetido (A-B-A).',
        '- 3x intermediário: ABC.',
        '- 3x avançado: Push/Pull/Legs.',
        '- 4x: Upper/Lower A/B ou PPL+1.',
        '- 5x: PPL + UL ou bro-split.',
        '- 6x avançado: PPLPPL.',
        '',
        '## §4.5 — DISTRIBUIÇÃO DE DIAS (obrigatório)',
        'Cada workout no JSON tem um array `scheduled_days` com inteiros 0-6 (0=dom, 6=sáb) indicando em quais dias da semana ele deve ser executado. A UNIÃO dos `scheduled_days` de TODOS os workouts **deve ser exatamente igual** ao conjunto `available_days` do aluno (fornecido na Camada 3). Regras:',
        '- Não deixe nenhum dia de `available_days` sem workout.',
        '- Não agende workout em dia fora de `available_days`.',
        '- Repetição é permitida e comum: em PPL+1 para 5 dias, Push aparece em 2 dias, Pull em 2 dias, Legs em 1.',
        '',
        '### Exemplos válidos de distribuição',
        '- Aluno com `available_days=[1,2,3,4,5]` (5 dias): PPL+1 → Push `[1,4]`, Pull `[2,5]`, Legs `[3]`.',
        '- Aluno com `available_days=[1,2,4,5]` (4 dias com gap quarta): Upper/Lower A/B → Upper A `[1]`, Lower A `[2]`, Upper B `[4]`, Lower B `[5]`.',
        '- Aluno com `available_days=[1,2,3,4]` (4 dias contíguos): Upper/Lower A/B → Upper A `[1]`, Lower A `[2]`, Upper B `[3]`, Lower B `[4]`. Dias contíguos são válidos — não insira gap artificial.',
        '- Aluno com `available_days=[1,3,5]` (3 dias alternados): ABC → A `[1]`, B `[3]`, C `[5]`.',
        '',
        '## ALUNOS NOVOS SEM HISTÓRICO',
        'Quando o contexto indicar "aluno novo sem histórico": volume no limite inferior da faixa, exercícios básicos e comuns, foco em aprendizado do movimento. Evite variações exóticas. Evite acessórios em 4+ séries.',
        '',
        '## FORMATO DE SAÍDA',
        'Retorne estritamente o JSON do schema fornecido. Cada exercício referencia um exercise_id do pool entregue na Camada 2. Campos obrigatórios por item de exercício: exercise_id, sets, reps, rest_seconds, exercise_function. Use exercise_function ∈ {warmup, activation, main, accessory, conditioning}. substitute_exercise_ids pode ter 0-2 UUIDs do mesmo pool.',
        '',
        FEW_SHOT_EXAMPLES,
    ].join('\n')
}

// ============================================================================
// Layer 2 — Trainer-scoped exercise pool (stable per trainer_id)
// ============================================================================

function renderLayer2(exercises: PrescriptionExerciseRef[], poolVersion: string): string {
    // Sort by id for determinism across process restarts and concurrent calls.
    const sorted = [...exercises].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    const lines: string[] = []
    lines.push('## POOL DE EXERCÍCIOS DISPONÍVEIS')
    lines.push(`pool_version: ${poolVersion}`)
    lines.push(`total: ${sorted.length}`)
    lines.push('')
    for (const ex of sorted) {
        const groups = (ex.muscle_group_names ?? []).join(',')
        const eq = ex.equipment ?? 'none'
        const comp = ex.is_compound ? 'C' : 'I'
        const pattern = ex.movement_pattern ?? '-'
        // Compact single-line format — keeps the pool section dense and stable.
        lines.push(`- ${ex.id} | ${ex.name} | ${groups} | ${eq} | ${comp} | ${pattern}`)
    }
    return lines.join('\n')
}

function computePoolVersion(trainerId: string, exercises: PrescriptionExerciseRef[]): string {
    // Hash of the sorted id list. Changes when trainer adds/removes exercises.
    // trainer_id is included as a salt so two trainers with identical pools
    // (e.g. defaults only) still get distinct caches if we ever want to split
    // them downstream.
    const sortedIds = exercises.map(e => e.id).sort().join(',')
    return createHash('sha1').update(`${trainerId}|${sortedIds}`).digest('hex').slice(0, 10)
}

// ============================================================================
// Layer 3 — Dynamic student context
// ============================================================================

function renderLayer3(
    profile: StudentPrescriptionProfile,
    context: EnrichedStudentContextV2,
): string {
    const lines: string[] = []
    lines.push('## CONTEXTO DO ALUNO')
    lines.push('')
    lines.push(`- Nome: ${context.student_name}`)
    lines.push(`- Nível: ${profile.training_level}`)
    lines.push(`- Objetivo: ${profile.goal}`)
    lines.push(`- Dias disponíveis: ${profile.available_days.join(', ')} (${profile.available_days.length}x/semana)`)
    lines.push(`- Duração da sessão: ${profile.session_duration_minutes} min`)
    lines.push(`- Equipamento: ${profile.available_equipment.join(', ') || 'academia completa'}`)

    if (context.is_new_student) {
        lines.push('')
        lines.push('> ⚠ Aluno novo sem histórico. Prescreva conservador: volume no limite inferior, exercícios básicos, foco em aprendizado do movimento.')
    }

    lines.push('')
    lines.push('### Anamnese')
    lines.push(context.anamnese_summary || '(sem anamnese registrada)')

    if (profile.medical_restrictions && profile.medical_restrictions.length > 0) {
        lines.push('')
        lines.push('### Restrições / lesões')
        for (const r of profile.medical_restrictions) {
            lines.push(`- ${r.description || (r as any).type || 'restrição registrada'}`)
        }
    }

    const perf = context.performance_summary
    if (perf.stagnated_exercises.length > 0 || perf.progressing_well.length > 0) {
        lines.push('')
        lines.push('### Performance recente')
        if (perf.stagnated_exercises.length > 0) {
            lines.push('Estagnados (3+ semanas sem progressão):')
            for (const s of perf.stagnated_exercises) {
                lines.push(`- ${s.name} (${s.group}, ${s.weeks_stalled} semanas)`)
            }
        }
        if (perf.progressing_well.length > 0) {
            lines.push('Progredindo bem:')
            for (const p of perf.progressing_well) {
                lines.push(`- ${p.name}`)
            }
        }
    }

    lines.push('')
    lines.push(`### Aderência (últimas 4 semanas): ${context.adherence.bucket} (${context.adherence.rate_last_4_weeks}%)`)

    if (context.trainer_observations.length > 0) {
        lines.push('')
        lines.push('### Observações do treinador')
        for (const o of context.trainer_observations) {
            lines.push(`- ${o.note}`)
        }
    }

    if (context.equipment_preference) {
        lines.push('')
        lines.push(`### Preferência declarada: ${context.equipment_preference}`)
    }

    if (profile.favorite_exercise_ids?.length || profile.disliked_exercise_ids?.length) {
        lines.push('')
        lines.push('### Preferências por exercício')
        if (profile.favorite_exercise_ids?.length) {
            lines.push(`- Favoritos (priorize quando aplicável): ${profile.favorite_exercise_ids.join(', ')}`)
        }
        if (profile.disliked_exercise_ids?.length) {
            lines.push(`- Evitar: ${profile.disliked_exercise_ids.join(', ')}`)
        }
    }

    return lines.join('\n')
}

// ============================================================================
// Layer 4 — Final instruction (short, dynamic-free)
// ============================================================================

function renderLayer4(): string {
    return 'Gere o programa para este aluno seguindo estritamente o schema. Respeite todas as regras de domínio. Escreva o JSON final agora.'
}
