// ============================================================================
// Kinevo Prescription Engine — Prompt Builder
// ============================================================================
// Constructs the system + user prompts for OpenAI to generate a training program.
// All methodology rules come from shared constants — nothing is hardcoded here.

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionPerformanceContext,
    PrescriptionOutputSnapshot,
} from '@kinevo/shared/types/prescription'

import {
    VOLUME_RANGES,
    FREQUENCY_STRUCTURE,
    PRESCRIPTION_CONSTRAINTS,
    PERIODIZATION_BLOCK,
} from './constants'

import {
    REP_RANGES_BY_GOAL,
    REST_SECONDS,
} from './constants'

// ============================================================================
// Public API
// ============================================================================

export interface PromptPair {
    system: string
    user: string
}

/**
 * Builds the system + user prompts for the prescription AI.
 * System prompt defines methodology rules (5 sections per PRD §5.3).
 * User prompt injects the specific student context.
 */
export function buildPromptPair(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    performanceContext: PrescriptionPerformanceContext | null,
): PromptPair {
    return {
        system: buildSystemPrompt(),
        user: buildUserPrompt(profile, exercises, performanceContext),
    }
}

// ============================================================================
// System Prompt — 5 sections per PRD §5.3
// ============================================================================

function buildSystemPrompt(): string {
    const sections = [
        buildSection1_Role(),
        buildSection2_Methodology(),
        buildSection3_Constraints(),
        buildSection4_OutputFormat(),
        buildSection5_ResponseRules(),
    ]
    return sections.join('\n\n')
}

/**
 * §5.3.1 — Role and identity
 */
function buildSection1_Role(): string {
    return `# PAPEL
Você é o motor de prescrição Kinevo — um sistema especializado em gerar programas de treino personalizados.
Você NÃO é um chatbot. Retorne APENAS o JSON solicitado, sem texto, markdown ou explicações.
Sua prescrição será revisada por um treinador credenciado antes de chegar ao aluno.`
}

/**
 * §5.3.2 — Methodology rules (from shared constants)
 */
function buildSection2_Methodology(): string {
    const volumeLines = Object.entries(VOLUME_RANGES)
        .map(([level, range]) => `- ${level}: ${range.min}–${range.max} séries/grupo/semana`)
        .join('\n')

    const structureLines = Object.entries(FREQUENCY_STRUCTURE)
        .map(([freq, structure]) => `- ${freq} dias/semana → ${structure}`)
        .join('\n')

    const repLines = Object.entries(REP_RANGES_BY_GOAL)
        .map(([goal, ranges]) => `- ${goal}: compostos ${ranges.compound}, isolamento ${ranges.isolation}`)
        .join('\n')

    const restLines = Object.entries(REST_SECONDS.compound)
        .map(([goal, seconds]) => `- ${goal}: compostos ${seconds}s, isolamento ${REST_SECONDS.isolation[goal as keyof typeof REST_SECONDS.isolation]}s`)
        .join('\n')

    return `# METODOLOGIA KINEVO

## Volume semanal por nível (séries por grupo muscular)
${volumeLines}
- Sempre iniciar no limite INFERIOR. Progredir apenas após validação de aderência.

## Estrutura por frequência
${structureLines}

## Repetições por objetivo
${repLines}

## Descanso entre séries
${restLines}

## Periodização (bloco de ${PERIODIZATION_BLOCK.weeks} semanas)
- Semana 1: ${PERIODIZATION_BLOCK.week_1.focus}, volume no ${PERIODIZATION_BLOCK.week_1.volume_position}
- Semana 2: ${PERIODIZATION_BLOCK.week_2.focus}, progressão se aderência > ${PERIODIZATION_BLOCK.week_2.volume_progression_if_adherence_above}%
- Semana 3: ${PERIODIZATION_BLOCK.week_3.focus}, incremento de carga ${PERIODIZATION_BLOCK.week_3.load_increment_kg.lower}–${PERIODIZATION_BLOCK.week_3.load_increment_kg.upper}kg
- Semana 4: ${PERIODIZATION_BLOCK.week_4.focus}, redução de ${PERIODIZATION_BLOCK.week_4.volume_reduction_pct}% do volume`
}

/**
 * §5.3.3 — Hard constraints the AI must never violate
 */
function buildSection3_Constraints(): string {
    return `# RESTRIÇÕES ABSOLUTAS (violação = programa rejeitado)
- Mínimo ${PRESCRIPTION_CONSTRAINTS.min_compounds_per_day} exercício(s) composto(s) por treino.
- Volume NUNCA acima do máximo do nível na semana 1.
- Máximo ${PRESCRIPTION_CONSTRAINTS.max_isolation_small_groups_beginner} exercícios de isolamento para grupos pequenos (${PRESCRIPTION_CONSTRAINTS.small_muscle_groups.join(', ')}) em iniciantes.
- Descanso mínimo de ${PRESCRIPTION_CONSTRAINTS.min_rest_seconds_compound}s para exercícios compostos.
- JAMAIS incluir exercícios listados nas restrições médicas do aluno.
- JAMAIS incluir exercícios que o aluno marcou como "não gosto".
- Priorizar exercícios marcados como favoritos pelo aluno.`
}

/**
 * §5.3.4 — Expected JSON output format
 */
function buildSection4_OutputFormat(): string {
    return `# FORMATO DE SAÍDA
Retorne exatamente este JSON (sem campos extras, sem texto fora do JSON):
{
  "program": {
    "name": "string — nome curto do programa",
    "description": "string — descrição de 1-2 frases",
    "duration_weeks": number
  },
  "workouts": [
    {
      "name": "string — ex: Treino A — Push",
      "order_index": number,
      "scheduled_days": [number] (0=Dom, 6=Sáb),
      "items": [
        {
          "exercise_id": "UUID do exercício",
          "exercise_name": "string — nome do exercício",
          "exercise_muscle_group": "string — grupo muscular principal",
          "exercise_equipment": "string | null",
          "sets": number,
          "reps": "string — ex: 8-12",
          "rest_seconds": number,
          "notes": "string | null",
          "substitute_exercise_ids": ["UUID"],
          "order_index": number
        }
      ]
    }
  ],
  "reasoning": {
    "structure_rationale": "string — justificativa da estrutura",
    "volume_rationale": "string — justificativa do volume",
    "workout_notes": ["string — nota por treino"],
    "attention_flags": ["string — alertas para o treinador"],
    "confidence_score": number (0.0 a 1.0)
  }
}`
}

/**
 * §5.3.5 — Response rules and safety
 */
function buildSection5_ResponseRules(): string {
    return `# REGRAS DE RESPOSTA
- Use APENAS exercícios da lista fornecida no campo "available_exercises". Não invente exercícios.
- Cada exercise_id deve existir na lista fornecida.
- Respeite os scheduled_days informados no perfil.
- Em caso de dúvida entre volume alto e baixo, sempre escolha o MENOR.
- confidence_score < 0.7 indica que o programa precisa de revisão cuidadosa pelo treinador.
- Se não houver exercícios suficientes para um grupo muscular, omita-o e sinalize em attention_flags.`
}

// ============================================================================
// User Prompt — Student-specific context
// ============================================================================

function buildUserPrompt(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    performanceContext: PrescriptionPerformanceContext | null,
): string {
    const exercisesSummary = exercises.map(e => ({
        id: e.id,
        name: e.name,
        muscle_groups: e.muscle_group_names,
        equipment: e.equipment,
        is_compound: e.is_compound,
    }))

    const payload: Record<string, unknown> = {
        student_profile: {
            training_level: profile.training_level,
            goal: profile.goal,
            available_days: profile.available_days,
            session_duration_minutes: profile.session_duration_minutes,
            available_equipment: profile.available_equipment,
            favorite_exercise_ids: profile.favorite_exercise_ids,
            disliked_exercise_ids: profile.disliked_exercise_ids,
            medical_restrictions: profile.medical_restrictions,
            adherence_rate: profile.adherence_rate,
        },
        available_exercises: exercisesSummary,
    }

    if (performanceContext) {
        payload.performance_context = {
            weeks_of_history: performanceContext.weeks_of_history,
            recent_adherence_rate: performanceContext.recent_adherence_rate,
            recent_avg_rpe: performanceContext.recent_avg_rpe,
            stalled_exercise_ids: performanceContext.stalled_exercise_ids,
            previous_program: performanceContext.previous_program,
        }
    }

    return JSON.stringify(payload)
}

// ============================================================================
// AI Response Parsing
// ============================================================================

/**
 * Attempts to parse and validate the raw AI response into a PrescriptionOutputSnapshot.
 * Returns null if the response is malformed.
 */
export function parseAiResponse(rawJson: string): PrescriptionOutputSnapshot | null {
    let parsed: any
    try {
        parsed = JSON.parse(rawJson)
    } catch {
        return null
    }

    // Validate top-level structure
    if (!parsed?.program || !Array.isArray(parsed?.workouts) || !parsed?.reasoning) {
        return null
    }

    // Validate program
    if (typeof parsed.program.name !== 'string' || typeof parsed.program.duration_weeks !== 'number') {
        return null
    }

    // Validate each workout has items
    for (const w of parsed.workouts) {
        if (!Array.isArray(w.items) || typeof w.name !== 'string') {
            return null
        }
        for (const item of w.items) {
            if (!item.exercise_id || typeof item.sets !== 'number' || typeof item.reps !== 'string') {
                return null
            }
        }
    }

    // Normalize: ensure all required fields have defaults
    const output: PrescriptionOutputSnapshot = {
        program: {
            name: parsed.program.name,
            description: parsed.program.description || '',
            duration_weeks: parsed.program.duration_weeks,
        },
        workouts: parsed.workouts.map((w: any, wi: number) => ({
            name: w.name,
            order_index: w.order_index ?? wi,
            scheduled_days: Array.isArray(w.scheduled_days) ? w.scheduled_days : [],
            items: (w.items || []).map((item: any, ii: number) => ({
                exercise_id: item.exercise_id,
                exercise_name: item.exercise_name || '',
                exercise_muscle_group: item.exercise_muscle_group || '',
                exercise_equipment: item.exercise_equipment ?? null,
                sets: item.sets,
                reps: item.reps,
                rest_seconds: item.rest_seconds ?? 60,
                notes: item.notes ?? null,
                substitute_exercise_ids: Array.isArray(item.substitute_exercise_ids) ? item.substitute_exercise_ids : [],
                order_index: item.order_index ?? ii,
            })),
        })),
        reasoning: {
            structure_rationale: parsed.reasoning.structure_rationale || '',
            volume_rationale: parsed.reasoning.volume_rationale || '',
            workout_notes: Array.isArray(parsed.reasoning.workout_notes) ? parsed.reasoning.workout_notes : [],
            attention_flags: Array.isArray(parsed.reasoning.attention_flags) ? parsed.reasoning.attention_flags : [],
            confidence_score: typeof parsed.reasoning.confidence_score === 'number'
                ? Math.max(0, Math.min(1, parsed.reasoning.confidence_score))
                : 0.5,
        },
    }

    return output
}
