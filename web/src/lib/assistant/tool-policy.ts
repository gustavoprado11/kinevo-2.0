/**
 * Política de tools do assistente (Fase 0 — IA do Treinador).
 *
 * Fonte de verdade PRIMÁRIA da classificação read/write/confirm: o `client.tools()`
 * do AI SDK DESCARTA as annotations do MCP (readOnlyHint/destructiveHint) — então
 * este arquivo, não as hints, decide o que pausa para HITL. Ver chat-first SPEC §1.
 *
 * Cobre as 56 tools do servidor MCP (`lib/mcp/tools/*`) + a action `generateProgram`
 * (roteamento de prescrição). Define também os pesos de crédito (§3.2 da SPEC) e os
 * subconjuntos de subsetting por intenção (corta 60–70% do input — §7.2).
 */

// ----------------------------------------------------------------------------
// Catálogo das 56 tools MCP
// ----------------------------------------------------------------------------
export const ALL_MCP_TOOLS = [
    'kinevo_ping',
    'kinevo_list_students',
    'kinevo_get_student',
    'kinevo_create_student',
    'kinevo_update_student',
    'kinevo_list_programs',
    'kinevo_get_program',
    'kinevo_create_program',
    'kinevo_create_program_template',
    'kinevo_create_student_draft_program',
    'kinevo_assign_program',
    'kinevo_expire_program',
    'kinevo_list_training_methods',
    'kinevo_list_exercises',
    'kinevo_create_exercise',
    'kinevo_add_workout_session',
    'kinevo_add_exercise_to_session',
    'kinevo_update_workout_session',
    'kinevo_delete_workout_session',
    'kinevo_update_workout_item',
    'kinevo_create_superset',
    'kinevo_delete_workout_item',
    'kinevo_get_student_progress',
    'kinevo_get_form_responses',
    'kinevo_get_dashboard_summary',
    'kinevo_send_message',
    'kinevo_list_subscriptions',
    'kinevo_get_revenue_summary',
    'kinevo_list_plans',
    'kinevo_generate_checkout_link',
    'kinevo_create_plan',
    'kinevo_update_plan',
    'kinevo_create_contract',
    'kinevo_mark_payment_as_paid',
    'kinevo_cancel_contract',
    'kinevo_list_conversations',
    'kinevo_get_conversation',
    'kinevo_list_appointments',
    'kinevo_create_appointment',
    'kinevo_reschedule_appointment',
    'kinevo_cancel_appointment_occurrence',
    'kinevo_mark_appointment_status',
    'kinevo_cancel_appointment_series',
    'kinevo_list_form_templates',
    'kinevo_send_form',
    'kinevo_schedule_form',
    'kinevo_list_form_schedules',
    'kinevo_get_assessments',
    'kinevo_create_assessment_session',
    'kinevo_save_assessment_measurements',
    'kinevo_finalize_assessment',
    'kinevo_list_insights',
    'kinevo_get_workout_checkins',
    'kinevo_list_leads',
    'kinevo_update_lead_status',
    'kinevo_convert_lead',
] as const

export type McpToolName = (typeof ALL_MCP_TOOLS)[number]

/** Action de roteamento de prescrição (não é tool MCP; injetada à parte). */
export const GENERATE_PROGRAM = 'generateProgram'

// ----------------------------------------------------------------------------
// Classificação read / write / confirm
// ----------------------------------------------------------------------------
export const READ_TOOLS: ReadonlySet<string> = new Set<McpToolName>([
    'kinevo_ping',
    'kinevo_list_students',
    'kinevo_get_student',
    'kinevo_list_programs',
    'kinevo_get_program',
    'kinevo_list_training_methods',
    'kinevo_list_exercises',
    'kinevo_get_student_progress',
    'kinevo_get_form_responses',
    'kinevo_get_dashboard_summary',
    'kinevo_list_subscriptions',
    'kinevo_get_revenue_summary',
    'kinevo_list_plans',
    'kinevo_list_conversations',
    'kinevo_get_conversation',
    'kinevo_list_appointments',
    'kinevo_list_form_templates',
    'kinevo_list_form_schedules',
    'kinevo_get_assessments',
    'kinevo_list_insights',
    'kinevo_get_workout_checkins',
    'kinevo_list_leads',
])

/**
 * Tools que SEMPRE exigem confirmação humana (HITL). Conforme SPEC §7.1:
 * os 5 W-GATE (já têm `confirm` no schema) + todos os W-DESTR (destrutivos).
 */
export const CONFIRM_TOOLS: ReadonlySet<string> = new Set<McpToolName>([
    // 5 W-GATE (dinheiro / criação de conta / compartilhamento com aluno)
    'kinevo_create_contract',
    'kinevo_mark_payment_as_paid',
    'kinevo_cancel_contract',
    'kinevo_convert_lead',
    'kinevo_finalize_assessment',
    // W-DESTR (destrutivos — cancel_contract e finalize já listados acima)
    'kinevo_delete_workout_session',
    'kinevo_delete_workout_item',
    'kinevo_cancel_appointment_occurrence',
    'kinevo_cancel_appointment_series',
])

/** Escrita = tudo que não é leitura. (CONFIRM ⊆ WRITE.) */
export const WRITE_TOOLS: ReadonlySet<string> = new Set(
    ALL_MCP_TOOLS.filter((t) => !READ_TOOLS.has(t)),
)

export type ToolClass = 'read' | 'write' | 'confirm'

export function classifyTool(tool: string): ToolClass {
    if (READ_TOOLS.has(tool)) return 'read'
    if (CONFIRM_TOOLS.has(tool)) return 'confirm'
    return 'write'
}

// ----------------------------------------------------------------------------
// Pesos de crédito (§3.2 da SPEC)
// ----------------------------------------------------------------------------
export type ActionClass = 'query' | 'write' | 'prescription' | 'bulk'

/** Tools de envio em massa: peso = 1/aluno (cap 10). */
export const BULK_TOOLS: ReadonlySet<string> = new Set<McpToolName>([
    'kinevo_send_form',
    'kinevo_schedule_form',
])
export const BULK_MAX = 10

export function actionClassForTool(tool: string): ActionClass {
    if (tool === GENERATE_PROGRAM) return 'prescription'
    if (BULK_TOOLS.has(tool)) return 'bulk'
    if (READ_TOOLS.has(tool)) return 'query'
    return 'write'
}

/**
 * Peso de crédito de cada tool. Default: read=1, write simples=1.
 * Writes compostos (montam várias linhas num turno) pesam 2–3.
 */
export const CREDIT_WEIGHTS: Record<string, number> = {
    // Prescrição completa (action determinística) = ação cara.
    [GENERATE_PROGRAM]: 5,
    // Writes compostos.
    kinevo_create_program_template: 3, // programa + sessões + exercícios + supersets
    kinevo_create_student_draft_program: 3, // idem, mas como rascunho-do-aluno
    kinevo_create_superset: 2,
    kinevo_assign_program: 2,
    kinevo_create_contract: 2,
}

const DEFAULT_WEIGHT = 1

/**
 * Peso de uma única chamada de tool. Para BULK, multiplica pelo nº de alunos
 * (cap em BULK_MAX). Reads e writes simples = 1.
 */
export function creditWeightForCall(tool: string, studentCount = 1): number {
    if (BULK_TOOLS.has(tool)) {
        const n = Math.max(1, Math.min(studentCount, BULK_MAX))
        return n
    }
    return CREDIT_WEIGHTS[tool] ?? DEFAULT_WEIGHT
}

export interface TurnToolCall {
    tool: string
    /** nº de alunos para tools BULK (default 1). */
    studentCount?: number
}

/**
 * Créditos de um turno: soma dos pesos das tools chamadas, com piso de 1
 * (todo turno custa ≥1 crédito — __turn_base). Um turno só com leitura = 1.
 */
export function computeTurnCredits(calls: TurnToolCall[]): number {
    const sum = calls.reduce(
        (acc, c) => acc + creditWeightForCall(c.tool, c.studentCount),
        0,
    )
    return Math.max(1, sum)
}

// ----------------------------------------------------------------------------
// Subsetting por intenção (§7.2) — carregar só as tools da intenção do turno.
// ----------------------------------------------------------------------------
/** Tools sempre incluídas (núcleo de orientação), independente da intenção. */
export const CORE_TOOLS: readonly McpToolName[] = [
    'kinevo_ping',
    'kinevo_list_students',
    'kinevo_get_student',
    'kinevo_get_dashboard_summary',
]

export type ToolIntent =
    | 'alunos'
    | 'prescricao'
    | 'financeiro'
    | 'agenda'
    | 'forms'
    | 'avaliacao'
    | 'comunicacao'
    | 'leads'

export const TOOL_SUBSETS: Record<ToolIntent, readonly McpToolName[]> = {
    alunos: [
        'kinevo_list_students',
        'kinevo_get_student',
        'kinevo_create_student',
        'kinevo_update_student',
        'kinevo_get_student_progress',
        'kinevo_list_insights',
        'kinevo_get_workout_checkins',
    ],
    prescricao: [
        'kinevo_list_programs',
        'kinevo_get_program',
        'kinevo_create_program',
        'kinevo_create_program_template',
        'kinevo_create_student_draft_program',
        'kinevo_assign_program',
        'kinevo_expire_program',
        'kinevo_list_training_methods',
        'kinevo_list_exercises',
        'kinevo_create_exercise',
        'kinevo_add_workout_session',
        'kinevo_add_exercise_to_session',
        'kinevo_update_workout_session',
        'kinevo_delete_workout_session',
        'kinevo_update_workout_item',
        'kinevo_create_superset',
        'kinevo_delete_workout_item',
        'kinevo_get_student_progress',
    ],
    financeiro: [
        'kinevo_list_subscriptions',
        'kinevo_get_revenue_summary',
        'kinevo_list_plans',
        'kinevo_generate_checkout_link',
        'kinevo_create_plan',
        'kinevo_update_plan',
        'kinevo_create_contract',
        'kinevo_mark_payment_as_paid',
        'kinevo_cancel_contract',
    ],
    agenda: [
        'kinevo_list_appointments',
        'kinevo_create_appointment',
        'kinevo_reschedule_appointment',
        'kinevo_cancel_appointment_occurrence',
        'kinevo_mark_appointment_status',
        'kinevo_cancel_appointment_series',
    ],
    forms: [
        'kinevo_list_form_templates',
        'kinevo_send_form',
        'kinevo_schedule_form',
        'kinevo_list_form_schedules',
        'kinevo_get_form_responses',
    ],
    avaliacao: [
        'kinevo_get_assessments',
        'kinevo_create_assessment_session',
        'kinevo_save_assessment_measurements',
        'kinevo_finalize_assessment',
    ],
    comunicacao: [
        'kinevo_list_conversations',
        'kinevo_get_conversation',
        'kinevo_send_message',
        'kinevo_list_insights',
    ],
    leads: [
        'kinevo_list_leads',
        'kinevo_update_lead_status',
        'kinevo_convert_lead',
    ],
}

/**
 * Resolve o conjunto de tools para um conjunto de intenções (subsetting).
 * Sempre inclui CORE_TOOLS. Sem intenção → todas as 55 (fallback amplo).
 */
export function resolveToolSubset(intents: ToolIntent[]): McpToolName[] {
    if (intents.length === 0) return [...ALL_MCP_TOOLS]
    const set = new Set<McpToolName>(CORE_TOOLS)
    for (const intent of intents) {
        for (const tool of TOOL_SUBSETS[intent]) set.add(tool)
    }
    // Preserva a ordem canônica de ALL_MCP_TOOLS.
    return ALL_MCP_TOOLS.filter((t) => set.has(t))
}
