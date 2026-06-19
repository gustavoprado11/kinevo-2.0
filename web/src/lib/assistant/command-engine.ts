/**
 * Motor de turno do Assistente (IA do Treinador) — núcleo compartilhado.
 *
 * Extraído do handler ⌘K (api/assistant/command) para ser reutilizado pela aba
 * dedicada conversacional (/assistente, surface 'workspace'). Mesma mecânica:
 *   - subsetting por intenção (corta 60–70% do input);
 *   - tools MCP via ponte in-memory + generateProgram determinístico;
 *   - HITL: CONFIRM_TOOLS chegam SEM execute (mcp-bridge) → o turno para e
 *     devolve um ToolConfirmationRequest para confirmação humana;
 *   - metering do turno (créditos das ações auto-executadas + custo real do LLM).
 *
 * Diferença entre superfícies:
 *   - ⌘K (command_bar): turno único sobre a TELA atual, sem histórico.
 *   - Aba (workspace): conversa multi-turno e persistida — passa `history`.
 */

import { generateText, tool, jsonSchema, type ToolSet } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildMcpTools } from '@/lib/assistant/mcp-bridge'
import {
    CONFIRM_TOOLS,
    READ_TOOLS,
    actionClassForTool,
    creditWeightForCall,
    computeTurnCredits,
    type ToolIntent,
    type TurnToolCall,
} from '@/lib/assistant/tool-policy'
import {
    recordAiUsage,
    turnCostMicros,
    type AiSurface,
    type AiUsageEventInput,
} from '@/lib/ai-usage/metering'
import { getAiUsageSummary, type AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { checkQuota } from '@/lib/ai-usage/quota'
import { getAiTierForTrainer, type AiTier } from '@/lib/auth/get-ai-tier'
import type { ToolConfirmationRequest, QuestionRequest, ProposalRequest } from '@/lib/assistant/hitl-types'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { buildInstructions, PROMPT_VERSION } from '@/lib/assistant/system-prompt'
import { recordTurnTrace, toolResultOk } from '@/lib/assistant/turn-trace'
import { validateConfirmArgs } from '@/lib/assistant/arg-validation'
import type { LLMModel } from '@/lib/prescription/llm-client'

export const ASSISTANT_MODEL: LLMModel = 'gpt-4.1-mini'

// Detecta conversa de CRIAÇÃO de programa (input + histórico recente). Num turno de
// build, o LLM emite UMA chamada grande (kinevo_create_program_template com o programa
// inteiro), então damos mais tokens de saída e um teto de passos um pouco maior — sem
// trocar de modelo: o mini é bom numa única saída estruturada (como no smart-v2).
const PROGRAM_BUILD_RE = /\b(cri|mont|gera|elabor|prescrev|monta|faz|fa[çc]a|nov[oa])\w*\b[\s\S]{0,40}\b(programa|treino|prescri|ficha|periodiz|split|divis[ãa]o)\b/i
function isBuildTurn(input: string, history: AssistantTurnHistory[]): boolean {
    if (PROGRAM_BUILD_RE.test(input)) return true
    const recent = history.slice(-5).map((m) => m.content).join('  ')
    return PROGRAM_BUILD_RE.test(recent)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Tiers que liberam o Assistente com IA (⌘K e aba dedicada). */
export const PRO_TIERS: ReadonlySet<AiTier> = new Set<AiTier>(['pro_ia', 'premium_ia'])

export type AssistantGate =
    | { allowed: true; tier: AiTier; period: 'week' | 'month' }
    | { allowed: false; status: 403; error: 'tier_locked'; message: string }
    | { allowed: false; status: 402; error: 'quota_exceeded'; message: string; resetAt: string | null }

/**
 * Gate de acesso ao Assistente (defense-in-depth — a UI já esconde):
 *   - tier Pro+ obrigatório;
 *   - cota do ciclo não esgotada (esgotou → 402 amigável; degrada pra GUI).
 * Compartilhado pelo ⌘K (command_bar) e pela aba dedicada (workspace).
 */
export async function gateAssistant(
    admin: SupabaseClient,
    trainerId: string,
): Promise<AssistantGate> {
    const tier = await getAiTierForTrainer(admin, trainerId)
    if (!PRO_TIERS.has(tier)) {
        return {
            allowed: false,
            status: 403,
            error: 'tier_locked',
            message:
                'O Assistente com IA está disponível nos planos Pro e Premium. Faça upgrade para operar o Kinevo com IA.',
        }
    }
    const quota = await checkQuota(admin, trainerId, tier)
    if (!quota.allowed) {
        return {
            allowed: false,
            status: 402,
            error: 'quota_exceeded',
            message:
                'Sua cota de IA deste ciclo acabou. Você pode continuar pela interface normal; os créditos renovam em breve.',
            resetAt: quota.resetAt ?? null,
        }
    }
    return { allowed: true, tier, period: quota.period ?? 'month' }
}

// ----------------------------------------------------------------------------
// Intent resolution (subsetting) — pela rota atual + palavras-chave da intenção.
// ----------------------------------------------------------------------------
const ROUTE_INTENTS: ReadonlyArray<readonly [string, ToolIntent[]]> = [
    ['/financial', ['financeiro']],
    ['/students', ['alunos', 'prescricao', 'avaliacao', 'comunicacao']],
    ['/schedule', ['agenda']],
    ['/forms', ['forms', 'avaliacao']],
    ['/avaliacoes', ['avaliacao', 'forms']],
    ['/marketing', ['leads']],
    ['/leads', ['leads']],
    ['/messages', ['comunicacao']],
    ['/programs', ['prescricao']],
    ['/exercises', ['prescricao']],
    ['/dashboard', ['alunos', 'financeiro', 'agenda']],
    // Aba dedicada: leque mais amplo (conversa pode ir a qualquer domínio).
    ['/assistente', ['alunos', 'prescricao', 'financeiro', 'agenda', 'comunicacao']],
]

const KEYWORD_INTENTS: ReadonlyArray<readonly [RegExp, ToolIntent]> = [
    [/pag|cobran|fatur|assinatur|plano|receita|mrr|inadimpl|contrat/i, 'financeiro'],
    [/treino|programa|prescri|exerc|s[ée]rie|carga|superset/i, 'prescricao'],
    [/agenda|sess[ãa]o|hor[áa]rio|reagend|marcar|consulta/i, 'agenda'],
    [/formul[áa]rio|check-?in|question[áa]rio/i, 'forms'],
    [/avalia|medi[çc][ãa]o|dobra|circunfer/i, 'avaliacao'],
    [/mensag|conversa|whats|recado/i, 'comunicacao'],
    [/lead|prospect|convers[ãa]o de lead/i, 'leads'],
    [/aluno|progresso|ader[êe]ncia|insight/i, 'alunos'],
]

export function resolveIntents(input: string, route: string | undefined): ToolIntent[] {
    const set = new Set<ToolIntent>()
    if (route) {
        for (const [prefix, intents] of ROUTE_INTENTS) {
            if (route.startsWith(prefix)) intents.forEach((i) => set.add(i))
        }
    }
    for (const [re, intent] of KEYWORD_INTENTS) {
        if (re.test(input)) set.add(intent)
    }
    // Fallback amplo, mas ainda com subsetting (não manda as 55).
    if (set.size === 0) {
        set.add('alunos')
        set.add('financeiro')
        set.add('agenda')
    }
    return [...set]
}

// ----------------------------------------------------------------------------
// Cópia PT-BR do card de confirmação (sem montar texto no client).
// ----------------------------------------------------------------------------
const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
    'kinevo_cancel_contract',
    'kinevo_delete_workout_session',
    'kinevo_delete_workout_item',
    'kinevo_delete_program',
    'kinevo_cancel_appointment_occurrence',
    'kinevo_cancel_appointment_series',
])

const CONFIRM_TITLES: Record<string, string> = {
    kinevo_create_contract: 'Registrar contrato / assinatura',
    kinevo_mark_payment_as_paid: 'Registrar pagamento como pago',
    kinevo_cancel_contract: 'Cancelar contrato',
    kinevo_convert_lead: 'Converter lead em aluno',
    kinevo_finalize_assessment: 'Finalizar avaliação',
    kinevo_delete_workout_session: 'Excluir sessão de treino',
    kinevo_delete_workout_item: 'Excluir exercício do treino',
    kinevo_delete_program: 'Excluir rascunho de programa',
    kinevo_cancel_appointment_occurrence: 'Cancelar esta sessão da agenda',
    kinevo_cancel_appointment_series: 'Cancelar a série de sessões',
}

function summarizeArgs(args: Record<string, unknown>): string {
    const parts: string[] = []
    for (const [k, v] of Object.entries(args)) {
        if (v === null || v === undefined || v === '') continue
        if (typeof v === 'object') continue
        parts.push(`${k}: ${String(v)}`)
        if (parts.length >= 4) break
    }
    return parts.length > 0 ? parts.join(' · ') : 'Confirme os detalhes antes de executar.'
}

function buildConfirmation(
    toolName: string,
    args: Record<string, unknown>,
): ToolConfirmationRequest {
    return {
        toolName,
        title: CONFIRM_TITLES[toolName] ?? toolName,
        summary: summarizeArgs(args),
        args,
        destructive: DESTRUCTIVE_TOOLS.has(toolName),
    }
}

// "Ask the user": pergunta estruturada ao treinador com opções clicáveis.
const perguntarSchema = jsonSchema<{ pergunta: string; opcoes: string[]; multipla?: boolean }>({
    type: 'object',
    properties: {
        pergunta: { type: 'string', description: 'A pergunta ao treinador, curta e direta.' },
        opcoes: { type: 'array', items: { type: 'string' }, description: '2 a 5 opções curtas de resposta.' },
        multipla: { type: 'boolean', description: 'true se o treinador pode escolher várias opções.' },
    },
    required: ['pergunta', 'opcoes'],
})

// "Propor": apresenta um plano pronto para o treinador aprovar/ajustar (itens editáveis).
const proporSchema = jsonSchema<{ itens: { rotulo: string; valor: string }[]; rotulo_acao?: string }>({
    type: 'object',
    properties: {
        itens: {
            type: 'array',
            description: 'Itens da proposta como pares rótulo+valor, ex.: {rotulo:"Frequência", valor:"5x por semana"}.',
            items: {
                type: 'object',
                properties: {
                    rotulo: { type: 'string', description: 'Nome curto do campo (ex.: Divisão, Frequência, Foco, Duração).' },
                    valor: { type: 'string', description: 'Valor proposto, editável pelo treinador.' },
                },
                required: ['rotulo', 'valor'],
            },
        },
        rotulo_acao: { type: 'string', description: 'Rótulo do botão de aprovar (ex.: "Aprovar e criar"). Opcional.' },
    },
    required: ['itens'],
})

function studentCountFromArgs(args: unknown): number {
    if (args && typeof args === 'object' && 'student_ids' in args) {
        const ids = (args as { student_ids?: unknown }).student_ids
        if (Array.isArray(ids)) return ids.length
    }
    return 1
}

/** Serialização estável dos args (chaves ordenadas) p/ deduplicar chamadas. */
function stableArgs(args: unknown): string {
    if (!args || typeof args !== 'object') return JSON.stringify(args ?? null)
    const o = args as Record<string, unknown>
    const sorted = Object.keys(o)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = o[k]
            return acc
        }, {})
    return JSON.stringify(sorted)
}

/**
 * Guard anti-loop (determinístico). O modelo às vezes entra em loop chamando a
 * MESMA tool de LEITURA repetidamente (visto em prod: kinevo_list_students 12x
 * → estoura maxSteps sem concluir a tarefa, "travado"). O prompt sozinho não
 * segura isso. Aqui deduplicamos por (tool + args) DENTRO do turno: a 1ª chamada
 * idêntica roda normal; uma repetição IDÊNTICA não re-executa — devolve um
 * corretivo que manda o modelo AGIR com o que já tem. Leituras com args
 * DIFERENTES (ex.: list_exercises por grupos distintos) seguem livres. Só afeta
 * READ_TOOLS; writes/confirm passam intactos.
 */
function withReadGuard(tools: ToolSet): ToolSet {
    const seen = new Set<string>()
    const guarded: ToolSet = {}
    for (const [name, t] of Object.entries(tools)) {
        const orig = t.execute
        if (!READ_TOOLS.has(name) || typeof orig !== 'function') {
            guarded[name] = t
            continue
        }
        guarded[name] = {
            ...t,
            execute: (async (args, options) => {
                const key = `${name}:${stableArgs(args)}`
                if (seen.has(key)) {
                    return {
                        repeated: true,
                        message:
                            `Você JÁ consultou ${name} com esses mesmos parâmetros neste turno e tem o resultado. ` +
                            `NÃO repita a leitura — use os dados que já tem e AJA agora (crie/edite/responda ao treinador). ` +
                            `Se precisa de outra informação, chame uma tool DIFERENTE ou pergunte ao treinador.`,
                    }
                }
                seen.add(key)
                return orig(args, options)
            }) as typeof t.execute,
        }
    }
    return guarded
}

// ----------------------------------------------------------------------------
// Turno do assistente.
// ----------------------------------------------------------------------------
export interface AssistantTurnHistory {
    role: 'user' | 'assistant'
    content: string
}

export interface ExecutedToolSummary {
    toolName: string
    result: unknown
}

export interface AssistantTurnInput {
    admin: SupabaseClient
    trainerId: string
    trainerName: string | null
    input: string
    /** Superfície p/ metering (ai_usage_events.surface). */
    surface: AiSurface
    /** Período de cota do tier (vem do gate). */
    periodType: 'week' | 'month'
    /** Histórico anterior (aba conversacional); vazio no ⌘K. */
    history?: AssistantTurnHistory[]
    /** Rota atual (⌘K) — afeta o subsetting de tools. */
    route?: string
    /** Aluno em foco (UUID) — enriquece o contexto e direciona as tools. */
    studentId?: string
    /** Progresso ao vivo: chamado a cada passo (tool executada) p/ streaming na UI. */
    onProgress?: (label: string) => void
}

// Rótulo presente-contínuo p/ o progresso ao vivo (streaming). Fallback genérico.
const PROGRESS_LABELS: Record<string, string> = {
    generateProgram: 'Gerando o programa…',
    perguntar_treinador: 'Preparando a pergunta…',
    propor_ao_treinador: 'Montando a proposta…',
    kinevo_get_student: 'Buscando dados do aluno…',
    kinevo_get_student_progress: 'Analisando o progresso do aluno…',
    kinevo_list_students: 'Consultando seus alunos…',
    kinevo_get_dashboard_summary: 'Lendo o resumo do painel…',
    kinevo_get_revenue_summary: 'Calculando o financeiro…',
    kinevo_list_programs: 'Consultando os programas…',
    kinevo_get_program: 'Abrindo o programa…',
    kinevo_list_exercises: 'Buscando exercícios…',
    kinevo_list_training_methods: 'Consultando os métodos de treino…',
    kinevo_send_message: 'Preparando a mensagem…',
    kinevo_create_program: 'Criando o programa…',
    kinevo_create_program_template: 'Montando o programa…',
    kinevo_create_student_draft_program: 'Montando o rascunho no perfil do aluno…',
    kinevo_add_workout_session: 'Adicionando um treino…',
    kinevo_add_exercise_to_session: 'Adicionando exercícios…',
    kinevo_create_superset: 'Criando o superset…',
    kinevo_assign_program: 'Atribuindo o programa ao aluno…',
    kinevo_delete_program: 'Excluindo o rascunho…',
}
function progressLabel(toolName: string): string {
    return PROGRESS_LABELS[toolName] ?? 'Trabalhando nisso…'
}

export interface AssistantTurnResult {
    text: string
    confirmation: ToolConfirmationRequest | null
    /** Pergunta estruturada ao treinador (opções clicáveis), se o turno pediu uma. */
    question: QuestionRequest | null
    /** Proposta editável (Aprovar/Ajustar), se o turno propôs um plano. */
    proposal: ProposalRequest | null
    executed: ExecutedToolSummary[]
    credits: number
    /** Medidor atualizado. `null` se o metering/resumo (best-effort) falhou — o
     *  texto do turno já foi gerado e NÃO deve ser derrubado por erro de DB. */
    summary: AiUsageSummary | null
}

const MAX_HISTORY = 20

/**
 * Executa um turno: entende a intenção, auto-executa leituras/ações simples e
 * pausa nas CONFIRM_TOOLS (HITL). Faz o metering e devolve o medidor atualizado.
 * Pressupõe que o caller já validou auth + tier (Pro+) + cota.
 */
export async function runAssistantTurn(opts: AssistantTurnInput): Promise<AssistantTurnResult> {
    const { admin, trainerId, trainerName, input, surface, periodType } = opts
    let bridgeClose: (() => Promise<void>) | null = null
    try {
        // 1. Subsetting por intenção (corta o input). Num turno de CONSTRUÇÃO de
        //    programa (detectado pelo input OU pelo histórico), garantimos as
        //    intenções de prescrição/alunos. Sem isso, um turno de RESPOSTA a uma
        //    pergunta do build ("5x por semana", "ênfase em costas e glúteo") não
        //    tem palavra-chave de prescrição → o subset cai no fallback (financeiro/
        //    agenda) e o modelo fica SEM as tools de prescrição (create_student_draft
        //    _program, list_exercises) → flaila/loopa nas tools erradas e trava.
        const buildTurn = isBuildTurn(input, opts.history ?? [])
        const intents = resolveIntents(input, opts.route)
        if (buildTurn) {
            if (!intents.includes('prescricao')) intents.push('prescricao')
            if (!intents.includes('alunos')) intents.push('alunos')
        }
        const bridge = await buildMcpTools(trainerId, { intents })
        bridgeClose = bridge.close

        async function resolveStudentId(value: string): Promise<string | null> {
            if (!value || typeof value !== 'string') return null
            if (UUID_RE.test(value)) {
                const { data } = await admin
                    .from('students')
                    .select('id')
                    .eq('id', value)
                    .eq('coach_id', trainerId)
                    .maybeSingle()
                return data?.id ?? null
            }
            const escaped = value.replace(/[%_\\]/g, '\\$&')
            const { data } = await admin
                .from('students')
                .select('id')
                .eq('coach_id', trainerId)
                .ilike('name', `%${escaped}%`)
                .limit(1)
                .maybeSingle()
            return data?.id ?? null
        }

        // Guard anti-loop nas leituras (dedup por tool+args no turno).
        const guardedBridgeTools = withReadGuard(bridge.tools)
        // Aluno em foco: o modelo já TEM o aluno (UUID + perfil no contexto) e não
        // precisa "listar alunos". Em prod ele entrava em loop justamente aqui
        // (kinevo_list_students 12x → estourava maxSteps sem concluir). Removemos a
        // tool nesse caso — determinístico, mata o loop na raiz.
        if (opts.studentId) delete guardedBridgeTools['kinevo_list_students']

        const tools: ToolSet = {
            ...guardedBridgeTools,
            // "Ask the user": client tool (SEM execute) — o app renderiza as opções
            // como botões clicáveis e a escolha vira o próximo turno.
            perguntar_treinador: tool({
                description:
                    'Faz uma pergunta de esclarecimento ao treinador com OPÇÕES clicáveis. Use quando faltar informação para agir (ex.: para qual aluno, qual objetivo, frequência semanal). Prefira esta tool a perguntar em texto livre. Não descreva os botões; apenas chame a tool.',
                parameters: perguntarSchema,
            }),
            // "Propor": client tool (SEM execute) — apresenta um plano para aprovar/ajustar.
            propor_ao_treinador: tool({
                description:
                    'Apresenta ao treinador uma PROPOSTA pronta para ele APROVAR, AJUSTAR (editando os valores) ou CANCELAR — ex.: a estrutura de um programa ANTES de criar. Use quando você já montou o plano e precisa do "ok". NÃO use a tool de escolha (perguntar_treinador) para isto: aqui os itens são linhas rótulo+valor editáveis. Escreva a pergunta de aprovação na sua resposta em texto.',
                parameters: proporSchema,
            }),
            // NOTA: o gerador determinístico (generateProgram/motor de prescrição) foi
            // REMOVIDO do assistente. Ele ignorava a ênfase pedida (volume_budget cego ao
            // pedido → ombro recebia menos que peito). Agora o assistente PRESCREVE como o
            // MCP externo: autora o programa com as próprias tools do Kinevo (create_program
            // + add_workout_session + add_exercise_to_session + create_superset / set_scheme),
            // decidindo o volume por grupo e honrando o que o treinador pediu. O motor segue
            // disponível só no botão "Gerar com IA" do builder.
        }

        // 2. Prompt + histórico. Instruções estáveis (system-prompt v2) primeiro;
        //    bloco HITL/MCP em seguida; contexto dinâmico por último (studentId
        //    enriquece com o perfil do aluno).
        const dynamicContext = await buildChatContext(trainerId, trainerName ?? '', opts.studentId)
        const routeHint = opts.route ? `\nTela atual do treinador: ${opts.route}.` : ''
        const studentHint = opts.studentId
            ? `\nAluno em foco (UUID): ${opts.studentId}. Os dados dele JÁ ESTÃO no contexto acima — NÃO chame kinevo_list_students nem kinevo_get_student para "encontrar" o aluno (você já o tem); use este UUID direto nas ações. Só faça uma leitura do aluno se precisar de um dado específico que realmente não esteja no contexto, e NUNCA repita a mesma leitura.`
            : ''
        const system =
            buildInstructions(surface) +
            MCP_HITL_INSTRUCTIONS +
            '\n\n' +
            dynamicContext +
            routeHint +
            studentHint

        const history = (opts.history ?? []).slice(-MAX_HISTORY)
        const messages = [...history, { role: 'user' as const, content: input }]

        // Turnos de CONSTRUÇÃO de programa: mais tokens de saída (a chamada
        // create_program_template carrega o programa inteiro e truncaria em 1500) e um
        // teto de passos maior (ler contexto + listar exercícios + criar). `buildTurn`
        // já foi calculado no passo 1 (afeta o subset de tools).

        // 3. Entende a intenção e age. CONFIRM_TOOLS chegam sem execute → para.
        const result = await generateText({
            model: openai(ASSISTANT_MODEL),
            system,
            messages,
            maxTokens: buildTurn ? 8000 : 1500,
            temperature: 0.3,
            // maxSteps é um TETO. O build é UMA chamada grande precedida de leituras
            // (get_student, list_exercises): ~10 passos cobrem com folga e barram loop.
            maxSteps: buildTurn ? 12 : 5,
            tools,
            // Progresso ao vivo: emite um rótulo por tool executada (streaming na UI).
            onStepFinish: ({ toolCalls }) => {
                if (!opts.onProgress) return
                for (const tc of (toolCalls ?? []) as Array<{ toolName: string }>) {
                    opts.onProgress(progressLabel(tc.toolName))
                }
            },
        })

        // 4. Coleta o executado (crédito) e a confirmação pendente (HITL).
        interface RawToolCall {
            toolCallId: string
            toolName: string
            args?: Record<string, unknown>
        }
        interface RawToolResult extends RawToolCall {
            result?: unknown
        }
        const steps = result.steps as unknown as Array<{ toolResults: RawToolResult[] }>
        const toolCalls = result.toolCalls as unknown as RawToolCall[]

        const executed: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }> = []
        const executedIds = new Set<string>()
        for (const step of steps) {
            for (const tr of step.toolResults) {
                executedIds.add(tr.toolCallId)
                executed.push({ toolName: tr.toolName, args: tr.args ?? {}, result: tr.result })
            }
        }

        let confirmation: ToolConfirmationRequest | null = null
        let blockedReason: string | null = null
        for (const tc of toolCalls) {
            if (!executedIds.has(tc.toolCallId) && CONFIRM_TOOLS.has(tc.toolName)) {
                const card = buildConfirmation(tc.toolName, tc.args ?? {})
                // G5: valida os args ANTES de mostrar o card. Inválido → não mostra
                // card, vira clarificação. Válido com alvo → resumo legível no card.
                const validation = await validateConfirmArgs(admin, trainerId, tc.toolName, tc.args ?? {})
                if (!validation.ok) {
                    blockedReason = validation.reason
                } else {
                    if (validation.target) card.summary = validation.target.label
                    confirmation = card
                }
                break
            }
        }

        // "Ask the user": se o modelo chamou perguntar_treinador (client tool, sem
        // execute), monta a pergunta estruturada p/ a UI mostrar opções clicáveis.
        let question: QuestionRequest | null = null
        for (const tc of toolCalls) {
            if (!executedIds.has(tc.toolCallId) && tc.toolName === 'perguntar_treinador') {
                const a = (tc.args ?? {}) as { pergunta?: unknown; opcoes?: unknown; multipla?: unknown }
                const options = Array.isArray(a.opcoes)
                    ? a.opcoes.map((o) => String(o).trim()).filter(Boolean).slice(0, 6)
                    : []
                if (typeof a.pergunta === 'string' && a.pergunta.trim() && options.length > 0) {
                    question = { question: a.pergunta.trim(), options, multiple: a.multipla === true, allowOther: true }
                }
                break
            }
        }

        // "Propor": se o modelo chamou propor_ao_treinador, monta a proposta editável.
        let proposal: ProposalRequest | null = null
        for (const tc of toolCalls) {
            if (!executedIds.has(tc.toolCallId) && tc.toolName === 'propor_ao_treinador') {
                const a = (tc.args ?? {}) as { itens?: unknown; rotulo_acao?: unknown }
                const items = Array.isArray(a.itens)
                    ? a.itens
                          .map((it) => {
                              const o = (it ?? {}) as { rotulo?: unknown; valor?: unknown }
                              return { label: String(o.rotulo ?? '').trim(), value: String(o.valor ?? '').trim() }
                          })
                          .filter((it) => it.label || it.value)
                          .slice(0, 10)
                    : []
                if (items.length > 0) {
                    const label = typeof a.rotulo_acao === 'string' && a.rotulo_acao.trim() ? a.rotulo_acao.trim() : 'Aprovar'
                    proposal = { items, approveLabel: label }
                }
                break
            }
        }

        // Se a validação barrou a ação, devolve uma clarificação em vez do card.
        let finalText = blockedReason
            ? `${result.text ? result.text + '\n\n' : ''}⚠️ ${blockedReason}`
            : (result.text || (question?.question ?? '') || (proposal ? 'Aprova a proposta abaixo?' : ''))

        // Defesa em profundidade: um turno que terminou SEM texto, pergunta, proposta
        // e confirmação (ex.: estourou maxSteps sem concluir) jamais pode aparecer em
        // branco pro treinador ("travado"). Devolve um fallback amigável e acionável.
        if (!finalText && !confirmation && !question && !proposal) {
            finalText = 'Não consegui concluir essa ação agora. Pode reformular ou me dar um pouco mais de detalhe (ex.: frequência, ênfase, equipamento)?'
        }

        // 5. Metering do turno (CONFIRM_TOOLS NÃO entram — cobradas no execute-tool).
        const turnCalls: TurnToolCall[] = executed.map((e) => ({
            tool: e.toolName,
            studentCount: studentCountFromArgs(e.args),
        }))
        const credits = computeTurnCredits(turnCalls)
        const costMicros = turnCostMicros(ASSISTANT_MODEL, {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
        })

        const events: AiUsageEventInput[] = turnCalls.map((c, idx) => ({
            actionClass: actionClassForTool(c.tool),
            credits: creditWeightForCall(c.tool, c.studentCount),
            surface,
            ...(idx === 0
                ? {
                      model: ASSISTANT_MODEL,
                      inputTokens: result.usage.promptTokens,
                      outputTokens: result.usage.completionTokens,
                      costMicros,
                  }
                : {}),
        }))
        if (events.length === 0) {
            events.push({
                actionClass: 'query',
                credits: 1,
                surface,
                model: ASSISTANT_MODEL,
                inputTokens: result.usage.promptTokens,
                outputTokens: result.usage.completionTokens,
                costMicros,
            })
        }

        // 5b/6. Metering + resumo + trace são BEST-EFFORT: o LLM já rodou (e o
        //       turno será cobrado pelo execute-tool nas ações sensíveis). Uma
        //       falha de DB aqui NÃO pode derrubar a resposta já gerada (A2).
        let summary: AiUsageSummary | null = null
        try {
            await recordAiUsage(admin, {
                trainerId,
                periodType,
                credits,
                costMicros,
                events,
            })

            summary = await getAiUsageSummary(admin, trainerId)

            // Trace do turno (observabilidade + dataset de evals).
            await recordTurnTrace(admin, {
                trainerId,
                studentId: opts.studentId,
                kind: 'turn',
                surface,
                route: opts.route,
                promptVersion: PROMPT_VERSION,
                model: ASSISTANT_MODEL,
                input,
                output: finalText,
                tools: executed.map((e) => ({
                    toolName: e.toolName,
                    args: e.args,
                    ok: toolResultOk(e.result),
                })),
                confirmation: confirmation
                    ? { toolName: confirmation.toolName, destructive: confirmation.destructive }
                    : null,
                intents,
                credits,
                inputTokens: result.usage.promptTokens,
                outputTokens: result.usage.completionTokens,
                costMicros,
            })
        } catch (e) {
            console.error('[runAssistantTurn] metering/summary/trace best-effort falhou', e)
        }

        return {
            text: finalText,
            confirmation,
            question,
            proposal,
            executed: executed.map((e) => ({ toolName: e.toolName, result: e.result })),
            credits,
            summary,
        }
    } finally {
        if (bridgeClose) await bridgeClose().catch(() => {})
    }
}

/**
 * Bloco específico do caminho MCP (⌘K + workspace): política HITL e dicas de tools
 * que só existem aqui (catálogo MCP). A persona/regras comuns vêm de buildInstructions.
 */
const MCP_HITL_INSTRUCTIONS = `

# Ações no Kinevo (HITL)
- EFICIÊNCIA (importante): NUNCA chame a MESMA tool de leitura mais de uma vez no mesmo turno. Se já tem o
  dado — ou ele já veio no contexto — AJA. Repetir leituras (ex.: kinevo_list_students/kinevo_get_student
  várias vezes) desperdiça os passos do turno e faz a tarefa travar antes de concluir.
- Leituras e escritas reversíveis (atualizar aluno, criar rascunho de programa, agendar formulário):
  execute direto e relate objetivamente o que foi feito.
- Ações SENSÍVEIS (registrar/cancelar pagamento, cancelar contrato, converter lead, finalizar avaliação,
  excluir treino/exercício, cancelar sessão ou série da agenda) PRECISAM de confirmação humana:
  apenas CHAME a tool com os argumentos corretos — o app mostra o card de confirmação.
  NÃO peça confirmação por texto, NÃO descreva o card.
- Quando faltar uma informação para agir (ex.: para qual aluno, qual objetivo, frequência semanal,
  quais grupos priorizar), NÃO pergunte em texto livre: CHAME a tool perguntar_treinador com a
  pergunta e 2 a 5 opções curtas (use multipla=true quando fizer sentido marcar várias). O app
  mostra as opções como botões clicáveis. Faça UMA pergunta por vez e só quando for realmente
  necessário para prosseguir.
- Quando você JÁ montou um plano e precisa do "ok" do treinador, use propor_ao_treinador com os
  itens em pares rótulo+valor. NÃO use perguntar_treinador para isso — uma proposta não é uma escolha
  entre opções. O app mostra os itens com VALORES EDITÁVEIS e os botões Aprovar/Cancelar; ao aprovar,
  o treinador devolve os valores finais (possivelmente ajustados) e só então você executa a ação.
  IMPORTANTE: só inclua na proposta itens cujo valor você REALMENTE vai honrar ao executar — nunca
  itens decorativos que serão ignorados.
- CRIAR / MONTAR um programa de treino: NÃO existe um gerador automático (ignore qualquer menção a uma
  tool "generateProgram" — ela não existe aqui). VOCÊ monta o programa do zero, usando as ferramentas
  do Kinevo, como um treinador experiente faria. Fluxo:
  1) Entenda o aluno pelo CONTEXTO que já veio (perfil, objetivo, restrições). Se um aluno já está em
     foco, NÃO chame kinevo_list_students (não precisa "achar" o aluno) e NÃO repita kinevo_get_student.
     Só chame kinevo_get_student_progress se precisar de histórico/estagnação que não está no contexto —
     e RESPEITE as RESTRIÇÕES MÉDICAS (nunca prescreva exercício contraindicado por lesão/restrição).
  2) Se faltar informação essencial (frequência semanal, objetivo, ênfase em grupos, equipamento), use
     perguntar_treinador. UMA pergunta por vez e só o necessário para prosseguir.
  3) Busque exercícios REAIS com kinevo_list_exercises (priorize os grupos que vai usar). Use SOMENTE
     exercise_id vindos do catálogo — nunca invente IDs. Veja kinevo_list_training_methods se for usar
     métodos avançados (drop-set, cluster, pirâmide…).
  4) HONRE o pedido acima de tudo: o programa é DESENHADO em torno do que foi pedido, não um treino
     genérico. Você decide livremente divisão, exercícios, séries, reps, descanso, métodos e supersets.
     ÊNFASE = VOLUME claramente MAIOR. Use estes ALVOS de séries por SEMANA por grupo:
       • grupo ENFATIZADO: 14–20 séries (3–4 exercícios distintos ao longo da semana);
       • grupo principal não enfatizado: 9–12 séries (2 exercícios);
       • grupo de manutenção/pequeno: 6–9 séries (1–2 exercícios).
     Se o treinador enfatizou DOIS grupos (ex.: ombro E posterior de coxa), AMBOS entram na faixa
     enfatizada e AMBOS devem LIDERAR — nunca deixe um dos enfatizados no mesmo nível dos de manutenção.
     Antes de finalizar, some as séries/semana de CADA grupo enfatizado e confirme que superam os demais
     com folga; se não, adicione exercícios/séries ao(s) grupo(s) enfatizado(s). Não há orçamento fixo.
  5) Crie o programa INTEIRO em UMA ÚNICA chamada transacional (todas as sessões, exercícios, supersets e
     set_scheme de uma vez). NÃO use kinevo_create_program nem adicione sessões/exercícios um a um (isso
     falha e não é transacional). Escolha o destino pelo contexto:
       • COM aluno em foco (o pedido é "monta um treino pro Fulano") → kinevo_create_student_draft_program
         (passando o student_id do aluno): o programa nasce como RASCUNHO no PERFIL DO ALUNO, invisível pra
         ele, pronto pra revisão. Este é o caminho PADRÃO sempre que há um aluno.
       • SEM aluno específico (pedido de "template reutilizável" pra Biblioteca) → kinevo_create_program_template.
     Faça um programa COMPLETO: para 4x/semana use 4 SESSÕES DISTINTAS (não 2 repetidas); 3x → 3 sessões;
     5x → 5; etc. Cada sessão com 5 a 7 exercícios — NUNCA enxuto. Distribua os grupos enfatizados ao
     longo das sessões até atingir os alvos de volume. Defina scheduled_days de cada sessão (0=dom … 6=sáb).
  6) NÃO ative nem atribua automaticamente (kinevo_assign_program coloca o treino ATIVO na hora, sem revisão;
     o rascunho NÃO é ativo). Ao terminar, diga ao treinador em 1–2 frases que você montou o programa — como
     RASCUNHO no perfil do aluno (caminho com aluno) ou na Biblioteca de Programas (template) — com um resumo
     curto (divisão + ênfase aplicada), e que ele revisa e ATIVA/atribui quando aprovar (ou pede pra você
     ativar). NÃO despeje o JSON nem os IDs.
- DESCARTAR / EXCLUIR / APAGAR um RASCUNHO de programa: use kinevo_delete_program (HITL — pede confirmação).
  Funciona só em rascunhos. Isso é sobre TREINO, não cobrança: NUNCA use kinevo_cancel_contract para apagar um
  programa. Para ENCERRAR um programa ATIVO preservando o histórico do aluno, use kinevo_expire_program (não exclua).
- Nunca dispare uma ação sensível em lote sem o treinador ter pedido explicitamente o alvo.
- Para o progresso de um aluno, use kinevo_get_student_progress antes de responder.
- Ao prescrever ou editar sessões, defina os dias da semana (scheduled_days) — é parte de uma boa
  prescrição e dispara os lembretes do aluno.`
