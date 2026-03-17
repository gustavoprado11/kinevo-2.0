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
    PrescriptionAgentAnswer,
    PrescriptionAgentQuestion,
    TrainerPatterns,
} from '@kinevo/shared/types/prescription'

import type { EnrichedStudentContext } from './context-enricher'
import type { PrescriptionConstraints } from './constraints-engine'
import type { QuestionnaireData } from './questionnaire-mapper'
import { buildConditionInstructions } from './condition-mappings'

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
    studentNarrative?: string | null,
): PromptPair {
    return {
        system: buildSystemPrompt(),
        user: buildUserPrompt(profile, exercises, performanceContext, studentNarrative),
    }
}

/**
 * Transforms questionnaire data into a narrative text for AI prompts.
 * Only includes sections that have at least one filled field.
 * Returns null if no qualitative field has a value.
 */
export function buildStudentNarrative(questionnaireData: QuestionnaireData | null | undefined): string | null {
    if (!questionnaireData) return null

    const sections: string[] = []

    // Experiência anterior
    if (questionnaireData.previous_experience) {
        sections.push(`EXPERIÊNCIA ANTERIOR:\n${questionnaireData.previous_experience}`)
    }

    // Lesões e limitações
    const injuryLines: string[] = []
    if (questionnaireData.injury_description) {
        injuryLines.push(`- Descrição: ${questionnaireData.injury_description}`)
    }
    if (questionnaireData.painful_activities.length > 0) {
        injuryLines.push(`- Atividades dolorosas: ${questionnaireData.painful_activities.join(', ')}`)
    }
    if (questionnaireData.medical_followup) {
        injuryLines.push(`- Acompanhamento médico: ${questionnaireData.medical_followup}`)
    }
    if (injuryLines.length > 0) {
        sections.push(`LESÕES E LIMITAÇÕES:\n${injuryLines.join('\n')}`)
    }

    // Preferências de treino
    const prefLines: string[] = []
    if (questionnaireData.training_style_preferences.length > 0) {
        prefLines.push(`- Estilo preferido: ${questionnaireData.training_style_preferences.join(', ')}`)
    }
    if (questionnaireData.motivation) {
        prefLines.push(`- Motivação principal: ${questionnaireData.motivation}`)
    }
    if (questionnaireData.emphasized_groups.length > 0) {
        prefLines.push(`- Grupos musculares enfatizados: ${questionnaireData.emphasized_groups.join(', ')}`)
    }
    if (prefLines.length > 0) {
        sections.push(`PREFERÊNCIAS DE TREINO:\n${prefLines.join('\n')}`)
    }

    // Contexto de vida
    if (questionnaireData.activity_level) {
        sections.push(`CONTEXTO DE VIDA:\n- Nível de atividade fora da academia: ${questionnaireData.activity_level}`)
    }

    // Observações adicionais
    if (questionnaireData.additional_info) {
        sections.push(`OBSERVAÇÕES ADICIONAIS:\n${questionnaireData.additional_info}`)
    }

    if (sections.length === 0) return null

    return `=== CONTEXTO DO ALUNO (questionário respondido) ===\n\n${sections.join('\n\n')}`
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
Sua prescrição será revisada por um treinador credenciado antes de chegar ao aluno.

REGRA CRÍTICA SOBRE REASONING:
O treinador LEVA O REASONING A SÉRIO. Ele lê para decidir se confia no programa.
- PROIBIDO texto genérico. "Programa adequado ao nível do aluno" = LIXO. Apague e reescreva.
- OBRIGATÓRIO nomear exercícios, citar dados dos formulários, mencionar restrições respeitadas.
- OBRIGATÓRIO ser CURTO e DIRETO. Cada campo do reasoning tem limite de 2-3 frases.
- Se não tem informação relevante para um campo, escreva "N/A" — não invente texto vago.
- exercise_choices: Nomeie os compostos âncora e explique por que foram escolhidos. Se excluiu exercícios por restrição, cite quais e o motivo.
- form_data_used: Cite respostas específicas dos formulários. Se nenhum, escreva "Nenhum".
- adaptations: Cite dados de performance concretos (estagnação X semanas, aderência Y%). Se primeiro programa, escreva "Primeiro programa".`
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
- Semana 4: ${PERIODIZATION_BLOCK.week_4.focus}, redução de ${PERIODIZATION_BLOCK.week_4.volume_reduction_pct}% do volume

## Contabilização de volume multiarticular
- Compostos de Quadríceps (agachamento, afundo, leg press): contam PESO IGUAL para Quadríceps E Glúteo
  Exemplo: 4 séries de Agachamento = 4 séries de Quad + 4 séries de Glúteo
- Compostos de Posterior de Coxa (terra, stiff): contam PESO IGUAL para Posterior de Coxa E Glúteo
  Exemplo: 3 séries de Stiff = 3 séries de Post. Coxa + 3 séries de Glúteo
- Hip Thrust / Elevação de Quadril: SOMENTE Glúteo — não conta para Quadríceps nem Posterior de Coxa
- Agachamentos NÃO contam para Posterior de Coxa — são dominantes de joelho
- Upper body: compostos de Peito contam 0.5x para Ombros e Tríceps; compostos de Costas contam 0.5x para Bíceps
- Use esta lógica ao calcular volume semanal por grupo antes de gerar e no volume_rationale

## Aquecimento e Aeróbio (item_type: warmup / cardio)
Além dos exercícios de força, você pode prescrever blocos de aquecimento e aeróbio quando apropriado.
Estes são ADICIONAIS aos exercícios de força — não substituem compostos e acessórios.
NÃO contam para o budget de volume.

### Aquecimento (item_type: "warmup")
Prescreva quando:
- Aluno iniciante ou intermediário
- Condições clínicas (articulares, cardíacas) que exigem preparação
- Sessão inclui exercícios pesados (agachamento, supino, terra)
NÃO prescreva quando:
- Aluno avançado que já tem protocolo próprio
- Sessão de baixa intensidade
Tipos: "free" (geral), "light_cardio" (5-10 min esteira/bike), "mobility" (mobilidade articular), "activation" (bandas/isométricos)
Duração: 5-15 minutos

### Aeróbio (item_type: "cardio")
Prescreva quando:
- Objetivo inclui emagrecimento ou condicionamento cardiovascular
- Aluno tem frequência ≥ 4x/semana e há tempo para cardio
- Aluno expressa interesse em cardio
Modos:
- "continuous": cardio contínuo em intensidade estável (zona 2, LISS). Para base aeróbia ou emagrecimento.
- "interval": HIIT ou intervalado. Para condicionamento, VO2max, ou alunos com pouco tempo.
Intensidade: use linguagem clara — "Zona 2 (FC 120-140bpm)", "RPE 6-7", "ritmo conversacional"

### Posicionamento
- Aquecimento: SEMPRE order_index 0 (primeiro item do treino)
- Aeróbio: SEMPRE maior order_index (último item do treino)`
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
- Priorizar exercícios marcados como favoritos pelo aluno.
- Se o campo student_questionnaire_context ou contexto_aluno estiver presente, ANALISE-O CUIDADOSAMENTE buscando:
  • Exercícios que o aluno NÃO PODE fazer (dor, lesão, desconforto, proibição médica)
  • Exercícios que causam desconforto ou medo
  • Restrições de equipamento ou local de treino
  Trate exercícios mencionados como impossíveis/dolorosos com a MESMA PRIORIDADE que medical_restrictions (P1 — inviolável). JAMAIS os inclua no programa.

# FUNÇÃO DO EXERCÍCIO (exercise_function)
Cada item deve ter um exercise_function baseado em sua característica:
- "main": exercícios compostos pesados, movimentos primários do treino
- "accessory": isolamentos e exercícios complementares
- "warmup": SOMENTE se for um exercício de mobilidade ou ativação muscular leve (NÃO atribua apenas pela posição)
- "activation": exercícios leves de ativação do grupo muscular alvo (bandas, isométricos)
- "conditioning": SOMENTE para exercícios cardiovasculares ou circuitos (esteira, bike, etc.)
Se não houver certeza, use "main" para compostos e "accessory" para isolamentos.

# ITEM TYPE (item_type)
Além de exercícios de força, o programa pode incluir itens especiais:
- "exercise" (padrão): exercício do catálogo com exercise_id, sets, reps, rest_seconds
- "warmup": bloco de aquecimento (sem exercise_id, usa item_config com warmup_type/description/duration_minutes)
- "cardio": bloco de aeróbio (sem exercise_id, usa item_config com mode/equipment/duration_minutes/intervals/intensity)
NÃO inclua AMBOS exercise_function="warmup" E item_type="warmup" no mesmo treino — use um ou outro.
Prefira item_type="warmup" para protocolos gerais e exercise_function="warmup" apenas para exercícios específicos do catálogo.`
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
        ... veja os tipos de item abaixo ...
      ]
    }
  ],
  "reasoning": {
    "structure_rationale": "string CURTA (max 2 frases). Diga: qual split foi escolhido e POR QUE para ESTE aluno. Exemplo bom: 'Upper/Lower 4x porque a aluna tem 4 dias e prefere treinos curtos (50min). Treinos A focam em compostos pesados, B em acessórios e volume.' Exemplo RUIM: 'Programa estruturado em Upper/Lower para maximizar a hipertrofia.'",
    "volume_rationale": "string CURTA (max 2 frases). Diga: quantos sets/semana por grupo E se ajustou algo por aderência, RPE ou restrição. Exemplo bom: 'Peito 12 sets/sem (3x4), Costas 14 sets/sem (4+3+4+3). Reduzi volume de posterior porque aluna reportou desconforto no joelho.' Exemplo RUIM: 'Volume adequado ao nível intermediário seguindo as diretrizes.'",
    "exercise_choices": "string (max 3 frases). NOMEIE os exercícios principais e diga POR QUE foram escolhidos. Se excluiu algo por restrição, diga. Exemplo bom: 'Supino reto como push horizontal principal. Substituí mesa flexora por cadeira flexora — aluna reportou desconforto. Hip thrust como acessório de glúteo por ênfase pedida pelo treinador.' Exemplo RUIM: 'Exercícios selecionados considerando o perfil e preferências da aluna.'",
    "form_data_used": "string (max 2 frases). O QUE dos formulários influenciou o programa. Se nenhum formulário, escreva 'Nenhum'. Exemplo bom: 'Aluna informou: não pode mesa flexora (joelho), prefere treinar com halteres, academia tem Smith mas não tem barra livre.' Exemplo RUIM: 'Formulários do aluno foram considerados na prescrição.'",
    "adaptations": "string (max 2 frases). Ajustes por performance passada, aderência ou observações. Se primeiro programa, escreva 'Primeiro programa'. Exemplo bom: 'Aderência em 55% — reduzi de 5x para 4x/semana. Supino reto estagnado há 4 semanas — troquei para supino inclinado com halteres.' Exemplo RUIM: 'Ajustes feitos com base no histórico do aluno.'",
    "workout_notes": ["string — nota por treino"],
    "attention_flags": ["string — alertas ESPECÍFICOS para o treinador revisar. Ex: 'Aluna tem aderência de 55% — considere reduzir para 3x/semana', 'Supino reto pode ser desconfortável pelo histórico de ombro — acompanhe nas primeiras sessões'"],
    "confidence_score": number (0.0 a 1.0)
  }
}

## Tipos de Item
Cada item no array "items" pode ser um dos seguintes tipos:

### Exercício de força (padrão):
{
  "exercise_id": "UUID do exercício",
  "exercise_name": "Supino Reto com Barra",
  "exercise_muscle_group": "Peito",
  "exercise_equipment": "Barra",
  "sets": 4,
  "reps": "8-10",
  "rest_seconds": 90,
  "notes": "string | null",
  "substitute_exercise_ids": ["UUID"],
  "order_index": 1,
  "exercise_function": "main"
}

### Aquecimento (item_type obrigatório):
{
  "item_type": "warmup",
  "order_index": 0,
  "item_config": {
    "warmup_type": "mobility",
    "description": "5 min esteira leve (FC até 110bpm). Mobilidade articular: círculos de ombro 10x cada lado, world's greatest stretch 5x cada lado, agachamento com rotação torácica 8x.",
    "duration_minutes": 10
  }
}

### Aeróbio contínuo (item_type obrigatório):
{
  "item_type": "cardio",
  "order_index": 8,
  "item_config": {
    "mode": "continuous",
    "equipment": "treadmill",
    "objective": "time",
    "duration_minutes": 25,
    "intensity": "Zona 2 — ritmo conversacional, FC 120-140bpm"
  }
}

### Aeróbio intervalado (item_type obrigatório):
{
  "item_type": "cardio",
  "order_index": 8,
  "item_config": {
    "mode": "interval",
    "equipment": "bike",
    "intervals": {
      "work_seconds": 30,
      "rest_seconds": 20,
      "rounds": 8
    },
    "intensity": "Esforço: RPE 8-9. Descanso: RPE 3 (pedalada leve)"
  }
}

Valores válidos:
- warmup_type: "free", "light_cardio", "mobility", "activation"
- equipment: "treadmill", "bike", "elliptical", "rower", "stairmaster", "jump_rope", "outdoor_run", "outdoor_bike", "swimming", "other"
- mode: "continuous", "interval"
- objective: "time", "distance"
- exercise_function: "warmup", "activation", "main", "accessory", "conditioning"`
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
- Se não houver exercícios suficientes para um grupo muscular, omita-o e sinalize em attention_flags.

# REGRAS DE CONCISÃO (OBRIGATÓRIAS — violação reduz confidence_score)

O treinador precisa escanear o racional em 5 segundos. Seja telegráfico.

- structure_rationale: MÁXIMO 2 frases curtas. Formato telegráfico. Citar o split, frequência por grupo e âncoras. Sem justificativas.
  BOM: "PPL+ 5x. Ênfase Costas (2x via Pull+Upper). Lower 2x: Legs A squat-anchor, Legs B hinge-anchor."
  RUIM: "PPL+ de 5 dias permite frequência 2x por semana em costas e membros inferiores, atendendo a ênfase declarada..."

- volume_rationale: Listar APENAS grupos fora do range ou com observação. Formato: "Grupo: Xs (budget X-X) status."
  Grupos dentro do range → NÃO listar. O treinador só quer exceções.
  BOM: "Panturrilha: 6s (mín 7) — aceito para priorizar primários. Trapézio: indireto via remadas."
  RUIM: "Costas recebe 17 séries diretas descontando sobreposição com bíceps..."

- workout_notes: MÁXIMO 10 palavras por treino. Citar exercícios âncora. Sem explicar lógica.
  BOM: "Legs A: Agachamento + Stiff + Búlgaro. Glúteo via compostos."
  RUIM: "Treino C (Legs A): squat-dominante com Stiff para cobrir hinge e posterior antes de isolamentos de glúteo"

- attention_flags: MÁXIMO 3 flags, 1 frase por flag. Formato: fato + ação. Sem condicionais.
  BOM: "15 exercícios renovados — avaliar adaptação semana 2."
  RUIM: "15 exercícios estagnados foram substituídos — revisar com Gustavo na semana 2 se os novos exercícios estão gerando percepção de esforço adequada"

- notes de exercício: máximo 1 frase curta (15 palavras). Foco no PORQUÊ, não na técnica. NUNCA repetir o nome do exercício. NUNCA descrever execução.
  BOM: "Substitui Leg Press estagnado — maior demanda estabilizadora."
  RUIM: "Exercício composto dominante de joelho que substitui o Leg Press..."

# REGRAS ADICIONAIS
- Respeitar RIGOROSAMENTE o split definido nas CONSTRAINTS — não inventar treinos extras ou redistribuir grupos musculares.
- Se adherence_adjustment for 'minimal', attention_flags DEVE conter um flag sobre risco de aderência.`
}

// ============================================================================
// User Prompt — Student-specific context
// ============================================================================

function buildUserPrompt(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    performanceContext: PrescriptionPerformanceContext | null,
    studentNarrative?: string | null,
): string {
    const useCompact = process.env.ENABLE_COMPACT_EXERCISE_POOL !== 'false'
    const exercisesSummary = exercises.map(e => {
        if (useCompact) {
            const mp = e.movement_pattern || 'isolation'
            return {
                id: e.id,
                n: e.name,
                mg: e.muscle_group_names,
                mp: MP_READABLE[mp] || mp,
            }
        }
        return {
            id: e.id,
            name: e.name,
            muscle_groups: e.muscle_group_names,
            equipment: e.equipment,
            is_compound: e.is_compound,
            difficulty_level: e.difficulty_level,
            session_position: e.session_position,
            is_primary_movement: e.is_primary_movement,
            movement_pattern: e.movement_pattern,
            ...(e.prescription_notes ? { prescription_notes: e.prescription_notes } : {}),
        }
    })

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
            instrucao_performance: 'Se stalled_exercise_ids > 3, priorize trocar exercícios estagnados. Se recent_adherence_rate < 70, prefira exercícios mais simples. Se recent_avg_rpe > 8.5, considere reduzir volume.',
        }
    }

    if (studentNarrative) {
        payload.student_questionnaire_context = {
            instrucao: 'LEITURA OBRIGATÓRIA. Respostas do aluno. Se o aluno mencionou que NÃO PODE fazer um exercício ou sente dor/desconforto, JAMAIS inclua esse exercício no programa. Trate como restrição de segurança absoluta.',
            respostas: studentNarrative,
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
            const itemType = item.item_type || 'exercise'
            if (itemType === 'warmup' || itemType === 'cardio') {
                // Warmup/cardio: item_config required
                if (!item.item_config || typeof item.item_config !== 'object') {
                    return null
                }
            } else {
                // Exercise: exercise_id, sets, reps required
                if (!item.exercise_id || typeof item.sets !== 'number' || typeof item.reps !== 'string') {
                    return null
                }
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
            items: (w.items || []).map((item: any, ii: number) => {
                const itemType = item.item_type || 'exercise'

                if (itemType === 'warmup') {
                    return {
                        item_type: 'warmup' as const,
                        order_index: item.order_index ?? ii,
                        item_config: {
                            warmup_type: item.item_config?.warmup_type || 'free',
                            description: item.item_config?.description || undefined,
                            duration_minutes: item.item_config?.duration_minutes || undefined,
                        },
                        exercise_id: null,
                        exercise_name: null,
                        exercise_muscle_group: null,
                        exercise_equipment: null,
                        sets: null,
                        reps: null,
                        rest_seconds: null,
                        notes: item.notes ?? null,
                        substitute_exercise_ids: [],
                        exercise_function: null,
                    }
                }

                if (itemType === 'cardio') {
                    return {
                        item_type: 'cardio' as const,
                        order_index: item.order_index ?? ii,
                        item_config: {
                            mode: item.item_config?.mode || 'continuous',
                            equipment: item.item_config?.equipment || undefined,
                            objective: item.item_config?.objective || undefined,
                            duration_minutes: item.item_config?.duration_minutes || undefined,
                            distance_km: item.item_config?.distance_km || undefined,
                            intensity: item.item_config?.intensity || undefined,
                            intervals: item.item_config?.intervals || undefined,
                            notes: item.item_config?.notes || undefined,
                        },
                        exercise_id: null,
                        exercise_name: null,
                        exercise_muscle_group: null,
                        exercise_equipment: null,
                        sets: null,
                        reps: null,
                        rest_seconds: null,
                        notes: item.notes ?? null,
                        substitute_exercise_ids: [],
                        exercise_function: null,
                    }
                }

                // Default: exercise item
                return {
                    item_type: 'exercise' as const,
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
                    exercise_function: ['warmup', 'activation', 'main', 'accessory', 'conditioning'].includes(item.exercise_function)
                        ? item.exercise_function
                        : null,
                }
            }),
        })),
        reasoning: {
            structure_rationale: parsed.reasoning.structure_rationale || '',
            volume_rationale: parsed.reasoning.volume_rationale || '',
            workout_notes: Array.isArray(parsed.reasoning.workout_notes) ? parsed.reasoning.workout_notes : [],
            attention_flags: Array.isArray(parsed.reasoning.attention_flags) ? parsed.reasoning.attention_flags : [],
            confidence_score: typeof parsed.reasoning.confidence_score === 'number'
                ? Math.max(0, Math.min(1, parsed.reasoning.confidence_score))
                : 0.5,
            exercise_choices: typeof parsed.reasoning.exercise_choices === 'string' ? parsed.reasoning.exercise_choices : '',
            form_data_used: typeof parsed.reasoning.form_data_used === 'string' ? parsed.reasoning.form_data_used : '',
            adaptations: typeof parsed.reasoning.adaptations === 'string' ? parsed.reasoning.adaptations : '',
        },
    }

    return output
}

// ============================================================================
// Agent Prompt Builders (Claude multi-turn agent)
// ============================================================================

/**
 * Builds the system prompt for the Claude agent (used in both analysis and generation phases).
 * Reuses methodology, constraints, output format, and response rules from the existing prompt.
 * Adds agent-specific instructions for analysis and web search.
 */
export function buildAgentSystemPrompt(
    constraints?: PrescriptionConstraints,
    trainerPatterns?: TrainerPatterns | null,
): string {
    if (constraints) {
        // Phase 2 (generation): structured constraints + decision framework + patterns
        const sections = [
            buildAgentRole(),
            buildSection2_Methodology(),
            buildDecisionFramework(),
            buildConstraintsSection(constraints),
            buildTrainerPatternsSection(trainerPatterns),
            buildSection4_OutputFormat(),
            buildSection5_ResponseRules(),
            buildAgentWebSearchInstructions(),
        ].filter(Boolean)
        return sections.join('\n\n')
    }

    // Phase 1 (analysis): generic constraints + analysis instructions + decision framework
    const sections = [
        buildAgentRole(),
        buildSection2_Methodology(),
        buildDecisionFramework(),
        buildSection3_Constraints(),
        buildSection4_OutputFormat(),
        buildSection5_ResponseRules(),
        buildAgentAnalysisInstructions(),
        buildAgentWebSearchInstructions(),
    ]
    return sections.join('\n\n')
}

function buildAgentRole(): string {
    return `## PAPEL

Você é o Agente Prescritor do Kinevo — prescreve treinos baseados em evidências científicas, operando como copiloto do treinador.

PRINCÍPIOS FUNDAMENTAIS:
1. Segurança primeiro: NUNCA prescrever exercício contraindicado pela condição clínica do aluno, independente de qualquer outro critério.
2. Evidência sobre opinião: decisões de volume, frequência e seleção de exercícios seguem as CONSTRAINTS e o DECISION FRAMEWORK fornecidos.
3. Individualização: use o nome do aluno, considere histórico, aderência e preferências. Treino genérico = treino ruim.
4. Copiloto, não autopiloto: se houver ambiguidade sobre restrições físicas, condições clínicas ou preferências que mudariam a prescrição, PERGUNTE ao treinador antes de gerar.

Você opera em duas fases:
- FASE 1 (ANÁLISE): Analisa contexto, identifica lacunas, faz 0-3 perguntas ao treinador.
- FASE 2 (GERAÇÃO): Gera programa completo seguindo CONSTRAINTS e DECISION FRAMEWORK.

Na FASE 2, você recebe CONSTRAINTS pré-calculadas com split, volume e dosagem já definidos. Seu trabalho é:
- Selecionar os MELHORES exercícios do pool para preencher cada slot do split
- Respeitar o budget de volume
- Justificar cada escolha nas notes
- Gerar substitutos válidos`
}

function buildAgentAnalysisInstructions(): string {
    return `# FASE DE ANÁLISE (quando receber contexto do aluno)

Sua tarefa é analisar o contexto do aluno e identificar lacunas que impactam a prescrição.

## PERGUNTAS PRÉ-SELECIONADAS
Se o campo "perguntas_pre_selecionadas" estiver presente no contexto, o sistema já identificou perguntas críticas. Você deve:
1. INCLUIR todas as perguntas pré-selecionadas na sua resposta (são garantidas)
2. Pode ajustar a redação para ser mais específica ao contexto do aluno
3. Pode adicionar 1 pergunta EXTRA se identificar lacuna crítica não coberta
4. Total MÁXIMO: 3 perguntas (pré-selecionadas + extras)
5. Manter os IDs originais das perguntas pré-selecionadas

## SE NÃO HÁ PERGUNTAS PRÉ-SELECIONADAS
Significa que o sistema não detectou flags críticas. Você pode:
1. Retornar 0 perguntas (tudo ok, pode gerar direto)
2. Fazer até 2 perguntas se identificar lacunas não cobertas pelas flags automáticas

## LACUNAS CRÍTICAS (justificam pergunta extra)
- Restrições físicas ambíguas mencionadas na observação do treinador
- Divergência clara entre objetivo declarado e histórico
- Informação contraditória no perfil

## NÃO PERGUNTAR SOBRE
- Preferências estéticas ("quer ficar mais definido?")
- Rotina diária ou horário de treino
- Suplementação ou nutrição
- Exercícios complementares (isso é decisão do prescritor)

## FORMATO DE RESPOSTA
Responda APENAS com JSON válido. Seja conciso — máximo 10 palavras por item.
{
  "student_summary": "Dados puros, máx 15 palavras. Sem interpretação. Ex: 'Avançado, hipertrofia, 5x, 90% aderência. 8 exercícios estagnados.'",
  "identified_gaps": ["gap1", "gap2"],
  "questions": [
    {
      "id": "string",
      "question": "máx 20 palavras, use o nome do aluno",
      "context": "máx 10 palavras",
      "type": "single_choice | multi_choice | text",
      "options": ["opção 1", "opção 2"],
      "allows_text": true | false,
      "placeholder": "texto do campo livre (opcional)"
    }
  ]
}

REGRAS PARA FORMULAR PERGUNTAS:
- Máximo 3 perguntas por análise
- Manter o ID original se a pergunta foi pré-selecionada
- Prefira sempre single_choice ou multi_choice — são mais rápidas de responder
- Use type: "text" apenas para perguntas abertas sem opções óbvias
- Para single_choice, forneça 3-5 opções que cubram os casos mais comuns
- Inclua allows_text: true quando o treinador pode ter resposta fora das opções
- Use o nome do aluno na pergunta para contextualizar
- Se o contexto for suficiente e não há pré-selecionadas, retorne "questions": []
- SEMPRE retorne JSON válido, sem texto fora do JSON`
}

function buildAgentWebSearchInstructions(): string {
    // Web search is currently disabled to avoid timeouts.
    // When re-enabled, this section will instruct the agent on usage.
    return `# CONHECIMENTO
Use seu conhecimento interno de fisiologia do exercício e prescrição baseada em evidências.
Não tente buscar informações externas — baseie suas decisões no contexto fornecido e na metodologia Kinevo.`
}

// ============================================================================
// Decision Framework + Constraints Section (Agent v2)
// ============================================================================

/**
 * Fixed decision framework — 9 rules the agent must follow.
 * Same for all students. Benefits from prompt caching.
 */
function buildDecisionFramework(): string {
    return `## DECISION FRAMEWORK — Regras de decisão obrigatórias

Siga estas 9 regras em TODAS as decisões de prescrição, na ordem apresentada.

### DF-1. HIERARQUIA DE PRIORIDADES
Ao tomar qualquer decisão, respeite esta ordem estrita:
  P1 (inviolável): Segurança articular / condição clínica / restrições de exercício mencionadas pelo aluno nos formulários
  P2: Objetivo primário do ciclo
  P3: Aderência (programa viável > programa ótimo)
  P4: Preferências do aluno (favoritos, aversões)
  P5: Variação de estímulo

Se houver conflito entre níveis, o nível SUPERIOR sempre prevalece.
Exemplos:
- Exercício favorito (P4) mas contraindicado (P1) → ELIMINAR o exercício.
- Exercício ótimo para hipertrofia (P2) mas programa já longo e aderência baixa (P3) → REMOVER em favor de sessão mais curta.
- Exercício repetido do programa anterior (P5 sugere trocar) mas é o único seguro para a condição do aluno (P1) → MANTER.

### DF-2. VOLUME DENTRO DO BUDGET
O budget de séries/semana por grupo muscular está definido nas CONSTRAINTS.
- Distribua séries uniformemente entre os treinos que trabalham aquele grupo.
- NUNCA ultrapasse o MÁXIMO do budget na semana 1.
- Na dúvida entre volume alto e baixo → usar o MÍNIMO do budget.
- Se restam séries para alocar, priorize grupos com maior déficit no histórico do aluno.
- Considere contribuições multiarticulares: Supino = 100% Peito + 50% Ombros + 50% Tríceps.

### DF-3. COMPOSTOS PRIMEIRO
Cada treino DEVE seguir esta ordem:
  1. Ativação (function: activation) — APENAS se houver condição clínica ou fraqueza específica que justifique. Máximo 2 exercícios de ativação.
  2. Compostos (function: main) — 1-2 exercícios multiarticulares. São a âncora do treino. Devem ser feitos com o sistema nervoso fresco.
  3. Acessórios (function: accessory) — Isolamentos e trabalho complementar. Podem ser feitos com fadiga acumulada.
  4. Core/Condicionamento (function: conditioning) — Se houver espaço no tempo disponível.

NUNCA coloque um isolamento antes de um composto do mesmo grupo muscular.

### DF-3B. PRIORIDADE DE COMPOSTOS EM LOWER BODY
Em treinos de membros inferiores (Legs A, Legs B, Lower), os compostos de Quadríceps e Posterior de Coxa são OBRIGATÓRIOS antes de qualquer isolamento de Glúteo.

Regra de alocação para Legs days:
1. PRIMEIRO: 2-3 compostos que cobrem Quadríceps e/ou Posterior de Coxa (squat, hinge, lunge)
   - Esses compostos JÁ ativam Glúteo (contribuição multiarticular). Contar isso no volume de Glúteo.
2. DEPOIS: Se sobrar espaço no tempo E os grupos primários (Quad, Posterior) já atingiram o mínimo do budget, adicionar isolamentos de Glúteo.
3. NUNCA: Sacrificar volume de Quadríceps ou Posterior de Coxa para adicionar isolamentos de Glúteo.

Exemplo CORRETO para Legs A (avançado, 6 exercícios):
  1. Agachamento Livre (main) — 4 séries Quad + Glúteo
  2. Leg Press 45 (main) — 4 séries Quad + Glúteo
  3. Agachamento Búlgaro (main) — 3 séries Quad + Glúteo
  4. Cadeira Extensora (accessory) — 3 séries Quad
  5. Elevação de Quadril com Barra (accessory) — 3 séries Glúteo
  6. Panturrilha em pé (accessory) — 3 séries Panturrilha

Exemplo ERRADO:
  1. Agachamento Livre — 4 séries
  2. Búlgaro — 3 séries
  3. Hip Thrust — 3 séries (isolamento de Glúteo ANTES de cobrir budget de Quad)
  4. Abdução Máquina — 3 séries (SEGUNDO isolamento de Glúteo, Quad com 7 séries!)
  5-6. Panturrilha

### DF-3C. FREQUÊNCIA 2X/SEMANA PARA GRUPOS PRIMÁRIOS DE LOWER BODY
Quando houver 2 treinos de membros inferiores na semana (Legs A e Legs B, ou Lower A e Lower B):
- Quadríceps, Posterior de Coxa e Glúteo devem aparecer nos DOIS treinos.
- Distribuir o volume do budget entre os 2 treinos (ex: budget 16 séries → ~8 séries por treino).
- A DIFERENÇA entre os 2 treinos é o exercício âncora e o padrão de movimento dominante:
  * Legs A: âncora = squat ou lunge (dominante de joelho). Ex: Agachamento Livre + Búlgaro.
  * Legs B: âncora = hinge (dominante de quadril). Ex: Stiff + Levantamento Terra.
- Ambos os treinos incluem trabalho de Glúteo via compostos (contribuição multiarticular).
- Isolamentos de Glúteo (Hip Thrust, Abdução) só se houver espaço após compostos cobrirem Quad e Posterior.

PROIBIDO: Treinar Quadríceps em apenas 1 dos 2 Legs days. Treinar Posterior em apenas 1 dos 2 Legs days.

### DF-4. COBERTURA DE PADRÕES DE MOVIMENTO
Evite 2 ou mais exercícios do MESMO padrão de movimento no mesmo treino.
Padrões de referência:
  - Membros inferiores: squat (agachamento), hinge (dobradiça), lunge (passada)
  - Membros superiores push: push_horizontal (supino), push_vertical (desenvolvimento)
  - Membros superiores pull: pull_horizontal (remada), pull_vertical (puxada)
  - Isolamento: isolation (rosca, extensão, abdução, etc.)

Exceções permitidas:
- 2 variações do mesmo padrão se forem o foco declarado do treino (ex: Treino de Peito com supino reto + supino inclinado).
- Isolamentos não contam como duplicata de padrão.

### DF-5. DOSAGEM POR OBJETIVO
Use os rep_ranges e rest_seconds que vêm nas CONSTRAINTS.
Regras adicionais:
- Compostos usam a faixa de COMPOSTOS. Isolamentos usam a faixa de ISOLAMENTOS.
- Formato de reps deve ser um range: "8-12", nunca um número fixo.
- Número de séries por exercício:
  * main (composto): 3-4 séries
  * accessory (isolamento): 2-3 séries
  * activation: 2 séries
- Progressão implícita: as séries prescritas são para a SEMANA 1 (adaptação).

### DF-6. AJUSTE POR ADERÊNCIA
O campo adherence_adjustment nas CONSTRAINTS indica o nível de ajuste:

'normal' (aderência > 80%):
  - Prescrição padrão, sem restrições adicionais.

'reduced' (aderência 50-80%):
  - Reduzir 1 exercício por sessão em relação ao calculado.
  - Preferir exercícios compostos (mais retorno por série).
  - Em notes do primeiro exercício, incluir dica motivacional breve.

'minimal' (aderência < 50%):
  - Máximo 4-5 exercícios por sessão (respeitar exercises_per_session das CONSTRAINTS).
  - Priorizar exercícios simples e com equipamentos sempre disponíveis.
  - OBRIGATÓRIO: incluir flag em attention_flags explicando o risco de aderência.
  - Foco em reconstruir o hábito, não em otimizar o estímulo.

### DF-7. EXERCÍCIOS POR SESSÃO
O número está em exercises_per_session nas CONSTRAINTS. Este é o MÁXIMO, não uma meta a atingir.
Distribuição recomendada:
  - 4 exercícios: 2 main + 2 accessory
  - 5 exercícios: 2 main + 3 accessory
  - 6 exercícios: 2 main + 3 accessory + 1 activation ou conditioning
  - 7 exercícios: 2 main + 4 accessory + 1 activation ou conditioning
  - 8 exercícios: 2 main + 4 accessory + 1 activation + 1 conditioning

REGRAS DE TEMPO:
- session_duration_minutes é um TETO — o treino pode terminar antes.
- NÃO adicionar exercícios apenas para preencher tempo. Volume com propósito > volume por volume.
- Se o budget de volume para os grupos do treino é coberto com 5 exercícios, NÃO adicionar um 6º exercício só porque sobra tempo.
- Só ultrapassar o mínimo de exercícios se HOUVER déficit de volume em algum grupo primário do treino.

EXCEÇÃO: Se session_duration_minutes < 45 e exercises_per_session resulta em estimativa acima do tempo, remover 1 accessory do final.

### DF-8. NOTAS COM PROPÓSITO
Cada notes responde: "Por que ESTE exercício para ESTE aluno?" Máximo 15 palavras. 1 frase. Sem ponto final.

BOM: "Composto principal — ancora volume de quadríceps com carga controlável"
BOM: "Substitui Leg Press estagnado — maior demanda estabilizadora"
RUIM: "Faça 3 séries de 10 repetições" (já está em sets/reps)
RUIM: "Extensão de tríceps" (repete exercise_name)
RUIM: "Bom exercício para o músculo" (genérico)

### DF-9. SUBSTITUTOS INTELIGENTES
Cada exercício DEVE ter 1-2 substitute_exercise_ids. Os substitutos devem:
  a) Pertencer ao MESMO grupo muscular principal
  b) Ser do MESMO tipo funcional (composto → composto, isolamento → isolamento)
  c) NÃO estar na lista de prohibited_exercise_ids das CONSTRAINTS
  d) NÃO estar na lista de disliked_exercise_ids das CONSTRAINTS
  e) Estar disponíveis com o equipamento do aluno

NUNCA substitua um composto por um isolamento ou vice-versa.
Se não houver substituto válido disponível, usar substitute_exercise_ids: [].

### DF-10. EQUILÍBRIO ESTRUTURAL OBRIGATÓRIO
Ênfase em um grupo muscular NUNCA significa sacrificar outros grupos primários.
Regras de proporção entre antagonistas (séries/semana):
  - Peito : Costas → máximo 1 : 1.5 (Costas pode ter até 50% mais que Peito, nunca o inverso extremo)
  - Quadríceps : Posterior de Coxa → mínimo 1 : 0.7 (Posterior nunca abaixo de 70% do volume de Quadríceps)
  - Ombros : manter pelo menos o MÍNIMO do budget, independente de ênfase em outros grupos push

Se a ênfase em um grupo criar desequilíbrio:
  1. Primeiro, tente ADICIONAR volume ao grupo deficitário (se houver espaço no tempo)
  2. Se não houver espaço, REDUZA levemente a ênfase para manter o equilíbrio
  3. NUNCA zere um grupo primário — todo grupo primário deve receber pelo menos o MÍNIMO do budget

### DF-11. GRUPOS SECUNDÁRIOS SÓ APÓS PRIMÁRIOS COBERTOS
Exercícios dedicados para Abdominais, Oblíquos, Adutores, Panturrilha, e outros grupos secundários SÓ devem ser incluídos se:
  a) O treinador definiu ênfase específica nesse grupo, OU
  b) TODOS os grupos primários do treino já atingiram o MÍNIMO do budget com exercícios alocados

Se adicionar um grupo secundário significa que um grupo primário fica abaixo do mínimo do budget → NÃO incluir o secundário.

Prioridade de alocação em cada treino:
  1. Compostos dos grupos primários (Quadríceps, Posterior de Coxa, Peito, Costas, Ombros, Glúteo)
  2. Isolamentos dos grupos primários (se budget não coberto pelos compostos)
  3. Grupos secundários enfatizados pelo treinador
  4. Panturrilha (se é Legs day e sobra espaço)
  5. Abdominais/Oblíquos (só se sobra espaço E contribuição indireta de compostos é insuficiente)
  6. Adutores (raramente — só com ênfase ou espaço)

### DF-12. WARMUP E CARDIO (item_type)
Inclua um bloco de aquecimento (item_type: "warmup") quando:
  - Aluno é "beginner" ou "intermediate"
  - Aluno tem condições clínicas que afetam articulações ou sistema cardiovascular
  - Sessão inclui compostos pesados (agachamento, supino, terra)
Inclua um bloco de cardio (item_type: "cardio") quando:
  - Objetivo primário ou secundário inclui emagrecimento ou condicionamento cardiovascular
  - Aluno treina ≥ 4x/semana E a duração da sessão permite tempo para cardio (~15-25 min extras)

Regras de posicionamento:
  - Warmup SEMPRE em order_index 0 (primeiro item)
  - Cardio SEMPRE no maior order_index (último item)
  - NÃO misture exercise_function="warmup" com item_type="warmup" no mesmo treino
  - Prefira item_type="warmup" para protocolos gerais (mais flexível para o aluno)
  - Use exercise_function="warmup" APENAS para exercícios específicos do catálogo (ex: face pull com banda como ativação)

Cardio NÃO conta para o budget de volume muscular — é suplementar.
Warmup NÃO conta para exercises_per_session — é preparação.`
}

/**
 * Dynamic constraints section — changes per student.
 * Formatted as readable text, not JSON.
 */
function buildConstraintsSection(constraints: PrescriptionConstraints): string {
    const splitLines = constraints.split_detail
        .map(s => `  ${s.workout_name}: ${s.workout_focus} — ${s.muscle_groups.join(', ')}`)
        .join('\n')

    const volumeEntries = Object.entries(constraints.volume_budget)
    const volumeLines: string[] = []
    for (let i = 0; i < volumeEntries.length; i += 3) {
        const chunk = volumeEntries.slice(i, i + 3)
            .map(([group, range]) => `${group}: ${range.min}-${range.max}`)
            .join(' | ')
        volumeLines.push(`  ${chunk}`)
    }

    const clinicalText = constraints.clinical_conditions.length > 0
        ? constraints.clinical_conditions.join(', ')
        : 'Nenhuma registrada'

    const prohibitedText = constraints.prohibited_exercise_ids.length > 0
        ? `${constraints.prohibited_exercise_ids.length} exercícios proibidos (IDs filtrados do pool)`
        : 'Nenhum'

    const prohibitedGroupsText = constraints.prohibited_muscle_groups.length > 0
        ? constraints.prohibited_muscle_groups.join(', ')
        : 'Nenhum'

    const favText = constraints.favorite_exercise_ids.length > 0
        ? `${constraints.favorite_exercise_ids.length} exercícios marcados como favoritos (priorizados no pool)`
        : 'Nenhum registrado'

    const dislikeText = constraints.disliked_exercise_ids.length > 0
        ? `${constraints.disliked_exercise_ids.length} exercícios que o aluno não gosta (excluídos do pool)`
        : 'Nenhum registrado'

    const adherenceText = constraints.adherence_adjustment === 'normal'
        ? 'normal — prescrição padrão'
        : constraints.adherence_adjustment === 'reduced'
            ? 'reduced — reduzir complexidade, preferir compostos'
            : 'minimal — ADERÊNCIA CRÍTICA. Sessões curtas, exercícios simples, foco no hábito'

    return `## CONSTRAINTS PARA ESTE ALUNO (geradas pelo sistema — respeitar rigorosamente)

### Split definido: ${constraints.split_type} (${constraints.split_detail.length} treinos/semana)
${splitLines}

### Budget de volume (séries diretas/semana por grupo):
${volumeLines.join('\n')}
  REGRA: distribuir entre os treinos. NUNCA ultrapassar o máximo na semana 1.
  Considerar contribuições multiarticulares ao computar total.

### Configuração da sessão:
  Exercícios por sessão: ${constraints.exercises_per_session}
  Duração alvo: ${constraints.session_duration_minutes} minutos

### Dosagem:
  Compostos: ${constraints.rep_ranges.compound} reps, ${constraints.rest_seconds.compound}s descanso
  Isolamentos: ${constraints.rep_ranges.isolation} reps, ${constraints.rest_seconds.isolation}s descanso

### Segurança:
  Condições clínicas: ${clinicalText}
  Exercícios proibidos: ${prohibitedText}
  Grupos musculares restritos: ${prohibitedGroupsText}

### Preferências:
  Favoritos: ${favText}
  Não gosta: ${dislikeText}

### Ajuste por aderência: ${adherenceText}
  Aderência atual: ${constraints.adherence_percentage}%
${buildEmphasisSection(constraints.emphasized_groups)}${buildDeprioritizedSection(constraints.deprioritized_groups)}${buildConditionInstructions(constraints.medical_restrictions)}`
}

/**
 * Builds prompt section with trainer patterns learned from accumulated diffs.
 * Returns empty string if no patterns available (filtered out by .filter(Boolean)).
 */
function buildTrainerPatternsSection(trainerPatterns?: TrainerPatterns | null): string {
    if (!trainerPatterns || trainerPatterns.patterns.length === 0) return ''

    const patternLines = trainerPatterns.patterns
        .map((p, i) => `  ${i + 1}. ${p.description}`)
        .join('\n')

    return `## PADRÕES DO TREINADOR (aprendidos de ${trainerPatterns.analyzed_prescriptions} prescrições)

As edições recorrentes do treinador indicam:
${patternLines}

INSTRUÇÃO: Incorpore esses padrões na prescrição, MAS nunca viole RESTRIÇÕES ABSOLUTAS ou limites de volume.
Se um padrão conflitar com segurança ou budget máximo, a RESTRIÇÃO prevalece.`
}

function buildEmphasisSection(emphasizedGroups: string[]): string {
    if (!emphasizedGroups || emphasizedGroups.length === 0) {
        return `
### Ênfase muscular: Distribuição equilibrada
  Distribuir volume uniformemente dentro dos ranges definidos.`
    }
    return `
### Ênfase muscular definida pelo treinador:
  Grupos prioritários: ${emphasizedGroups.join(', ')}
  INSTRUÇÃO: Ênfase = priorizar, NUNCA sacrificar outros grupos.
  - Para os grupos prioritários: use o TOPO do range de volume (min elevado nas CONSTRAINTS).
  - Para os demais grupos primários: RESPEITE O MÍNIMO do budget — ele já está protegido nas CONSTRAINTS.
  - Se não houver espaço para dar volume máximo aos prioritários sem sacrificar os demais, reduza levemente a ênfase.
  - PROIBIDO: zerar ou reduzir drasticamente um grupo primário para compensar ênfase em outro.`
}

function buildDeprioritizedSection(deprioritizedGroups: string[]): string {
    if (!deprioritizedGroups || deprioritizedGroups.length === 0) {
        return ''
    }

    const hasAbs = deprioritizedGroups.includes('Abdominais')
    const hasAdductors = deprioritizedGroups.includes('Adutores')
    const coreNote = (hasAbs || hasAdductors)
        ? `\n  ${[hasAbs ? 'Abdominais' : '', hasAdductors ? 'Adutores' : ''].filter(Boolean).join(', ')}: incluir APENAS se sobrar espaço após cobrir todos os grupos primários.
  Core é trabalhado indiretamente em compostos como Agachamento, Stiff e Desenvolvimento.
  Grupos minimizados NÃO devem receber exercícios dedicados se isso reduzir o volume de qualquer grupo primário.`
        : ''

    return `

### Grupos de baixa prioridade (frequência limitada):
  ${deprioritizedGroups.join(', ')}: incluir APENAS se sobrar espaço após cobrir todos os grupos primários.
  Grupos removidos do budget NÃO devem receber exercícios dedicados — são cobertos indiretamente por compostos.${coreNote}`
}

// ============================================================================
// User Prompt — Phase 1 (Analysis)
// ============================================================================

/**
 * Builds the user message for Phase 1 (analysis) with enriched student context.
 */
export function buildAgentContextMessage(
    profile: StudentPrescriptionProfile,
    _exercises: PrescriptionExerciseRef[],
    enrichedContext: EnrichedStudentContext,
    serverQuestions?: PrescriptionAgentQuestion[],
    studentNarrative?: string | null,
): string {
    // Analysis phase: NO exercise list — agent doesn't need exercises to formulate questions
    const payload = {
        fase: 'ANÁLISE',
        instrucao: 'Analise o contexto abaixo e retorne o JSON de análise. Se houver lacunas críticas, inclua perguntas. Se o contexto for suficiente, retorne perguntas como array vazio.',
        aluno: {
            nome: enrichedContext.student_name,
            nivel: profile.training_level,
            objetivo: profile.goal,
            dias_disponiveis: profile.available_days,
            duracao_sessao_min: profile.session_duration_minutes,
            equipamentos: profile.available_equipment,
            restricoes_medicas: profile.medical_restrictions,
            taxa_aderencia: profile.adherence_rate,
        },
        historico: {
            programas_anteriores: enrichedContext.previous_programs.map(p => ({
                nome: p.name,
                duracao_semanas: p.duration_weeks,
                status: p.status,
                taxa_conclusao: p.completion_rate,
            })),
            exercicios_estagnados: enrichedContext.load_progression
                .filter(l => l.trend === 'stalled' || l.weeks_at_current >= 3)
                .map(l => l.exercise_name),
            padroes_sessao: {
                sessoes_4sem: enrichedContext.session_patterns.total_sessions_4w,
                concluidas_4sem: enrichedContext.session_patterns.completed_sessions_4w,
                duracao_media_min: enrichedContext.session_patterns.avg_session_duration_minutes,
            },
        },
    } as Record<string, unknown>

    // Include cycle observation with high priority if present
    if (profile.cycle_observation) {
        payload.observacao_treinador = {
            texto: profile.cycle_observation,
            prioridade: 'alta — priorize essa informação nas suas decisões',
        }
    }

    // Include server-side pre-selected questions for hybrid system
    if (serverQuestions && serverQuestions.length > 0) {
        payload.perguntas_pre_selecionadas = {
            instrucao: 'O sistema pré-selecionou estas perguntas baseado no perfil. Você pode: usar como estão, ajustar a redação, ou adicionar 1 pergunta extra se identificar lacuna crítica não coberta. Total máximo: 3 perguntas.',
            perguntas: serverQuestions.map(q => ({
                id: q.id,
                question: q.question,
                type: q.type,
                options: q.options,
            })),
        }
    }

    // Performance data from load progression
    const stalledExercises = enrichedContext.load_progression
        .filter(l => l.trend === 'stalled' || l.weeks_at_current >= 3)
    const regressingExercises = enrichedContext.load_progression
        .filter(l => l.trend === 'regressing')

    if (stalledExercises.length > 0 || regressingExercises.length > 0) {
        payload.performance_aluno = {
            instrucao: 'Dados de performance do aluno. Exercícios estagnados devem ser substituídos por variações. Exercícios em regressão precisam de atenção — considere reduzir carga ou trocar.',
            exercicios_estagnados: stalledExercises.map(l => ({
                nome: l.exercise_name,
                semanas_estagnado: l.weeks_at_current,
            })),
            exercicios_regredindo: regressingExercises.map(l => l.exercise_name),
        }
    }

    if (studentNarrative) {
        payload.contexto_questionario_aluno = {
            instrucao: `ATENÇÃO — LEITURA OBRIGATÓRIA. O aluno respondeu formulários. Analise TODAS as respostas com cuidado:

1. RESTRIÇÕES DE EXERCÍCIO (P1 — Segurança): Se o aluno mencionou que NÃO PODE fazer um exercício, sente dor, desconforto, ou tem restrição médica para algum movimento, trate como RESTRIÇÃO ABSOLUTA. JAMAIS inclua esse exercício no programa. Exemplos: "não posso fazer mesa flexora", "dói o joelho no leg press", "médico proibiu agachamento".

2. PREFERÊNCIAS E CONTEXTO: Local de treino, equipamentos disponíveis, dias preferidos, objetivos pessoais, experiência prévia. Use para personalizar o programa.

3. PERGUNTAS: NÃO pergunte ao treinador algo que o aluno já respondeu nos formulários. Se o aluno já informou seus dias disponíveis, objetivo, ou restrições, use essas informações diretamente.`,
            respostas: studentNarrative,
        }
    }

    return JSON.stringify(payload)
}

/** Maps DB movement_pattern abbreviations to readable names for the AI prompt */
const MP_READABLE: Record<string, string> = {
    push_h: 'push_horizontal',
    push_v: 'push_vertical',
    pull_h: 'pull_horizontal',
    pull_v: 'pull_vertical',
}

/**
 * Builds the generation instruction for Phase 2 (after Q&A).
 * Receives pre-selected/scored exercises from selectSmartExercises().
 * Includes full metadata in readable format for better AI decision-making.
 */
export function buildAgentGenerationMessage(
    answers: PrescriptionAgentAnswer[],
    exercises: PrescriptionExerciseRef[],
    studentNarrative?: string | null,
): string {
    // Compact exercise list — Tier 1 optimization strips fields the LLM doesn't use
    const useCompact = process.env.ENABLE_COMPACT_EXERCISE_POOL !== 'false'
    const compactExercises = exercises.map(e => {
        const mp = e.movement_pattern || 'isolation'
        if (useCompact) {
            const entry: Record<string, unknown> = {
                id: e.id,
                n: e.name,
                mg: e.muscle_group_names,
                mp: MP_READABLE[mp] || mp,
            }
            // Attach pre-computed substitutes if present
            if ('substitute_ids' in e && (e as any).substitute_ids?.length > 0) {
                entry.subs = (e as any).substitute_ids
            }
            return entry
        }
        // Original verbose format (feature flag off)
        const entry: Record<string, unknown> = {
            id: e.id,
            n: e.name,
            mg: e.muscle_group_names,
            c: e.is_compound ? 1 : 0,
            mp: MP_READABLE[mp] || mp,
            diff: e.difficulty_level,
            pos: e.session_position,
            prim: e.is_primary_movement ? 1 : 0,
        }
        if ('adequacy_score' in e) {
            entry.s = (e as any).adequacy_score
        }
        if (e.prescription_notes) {
            entry.note = e.prescription_notes
        }
        return entry
    })

    // Diagnostic log
    const countByGroup: Record<string, number> = {}
    for (const e of exercises) {
        const group = e.muscle_group_names[0] || 'unknown'
        countByGroup[group] = (countByGroup[group] || 0) + 1
    }
    console.log(`[AgentePrescitor] Generation: ${compactExercises.length} exercises sent. Per group:`, JSON.stringify(countByGroup))

    const payload: Record<string, unknown> = {
        fase: 'GERAÇÃO',
        instrucao: 'Com base em toda a análise anterior e nas respostas do treinador, gere o programa de treinos completo. Retorne APENAS o JSON no formato de saída especificado (program, workouts, reasoning). Use web_search para embasar decisões críticas se necessário.',
        legenda_exercicios: useCompact
            ? 'id=UUID, n=nome, mg=grupos_musculares, mp=movement_pattern, subs=substitute_exercise_ids(top 2)'
            : 'id=UUID, n=nome, mg=grupos_musculares, c=composto(1/0), mp=movement_pattern, diff=difficulty(beginner/intermediate/advanced), pos=session_position(first/middle/last), prim=primary_movement(1/0), s=adequacy_score(0-100), note=prescription_notes',
        exercicios_disponiveis: compactExercises,
    }

    if (answers.length > 0) {
        payload.respostas_do_treinador = answers.map(a => ({
            pergunta_id: a.question_id,
            resposta: a.answer,
        }))
    } else {
        payload.nota = 'Nenhuma pergunta foi necessária — o contexto é suficiente. Gere o programa diretamente.'
    }

    if (studentNarrative) {
        payload.contexto_aluno = {
            instrucao: 'LEITURA OBRIGATÓRIA. Respostas do aluno abaixo. Se o aluno mencionou que NÃO PODE ou NÃO QUER fazer um exercício, JAMAIS o inclua no programa. Trate como restrição P1 (Segurança).',
            respostas: studentNarrative,
        }
    }

    const serialized = JSON.stringify(payload)
    const estimatedTokens = Math.round(serialized.length / 4)
    const baselineTokens = 8000 // Pre-Tier 1 average for exercise list
    const reductionPct = Math.round((1 - estimatedTokens / baselineTokens) * 100)
    console.log(`[AgentePrescitor] Generation message: ${serialized.length} chars, ~${estimatedTokens} tokens`)
    console.log(`[LLM_OPT] exercises_sent=${exercises.length}`)
    console.log(`[LLM_OPT] estimated_tokens=${estimatedTokens}`)
    console.log(`[LLM_OPT] reduction=${Math.max(0, reductionPct)}%`)
    return serialized
}
