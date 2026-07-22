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

import { randomUUID } from 'node:crypto'
import { streamText, tool, jsonSchema, stepCountIs, type ToolSet, type ModelMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
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
import { creditLimitForTier, getQuotaForTier } from '@/lib/ai-usage/quota'
import { type AiTier } from '@/lib/auth/get-ai-tier'
import type { ToolConfirmationRequest, QuestionRequest, ProposalRequest } from '@/lib/assistant/hitl-types'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { buildInstructions, PROMPT_VERSION } from '@/lib/assistant/system-prompt'
import { buildMcpHitlInstructions } from '@/lib/assistant/hitl-instructions'
import { isBuildTurn, historyText } from '@/lib/assistant/build-signals'
import { projectMcpResultForLlm } from '@/lib/assistant/llm-projection'
import { recordTurnTrace, toolResultOk } from '@/lib/assistant/turn-trace'
import { validateConfirmArgs } from '@/lib/assistant/arg-validation'
import { ambiguousStudentTarget, withAmbiguityGuard, type StudentRef } from '@/lib/assistant/ambiguity'
import { digestToolResult, MEMORY_READ_TOOLS, type ProgramFocus, type NativeModelMessage } from '@/lib/assistant/tool-memory'
import { redactSensitive } from '@/lib/assistant/redact'
import { isAssistantDisabled, ASSISTANT_MAINTENANCE_MESSAGE } from '@/lib/assistant/kill-switch'
import { loadStyleBlock, loadTrainerStyle } from '@/lib/assistant/style-block'
import { runStyleInterviewTurn } from '@/lib/assistant/style-interview'
import {
    validateBuildArgs,
    loadBuildCatalog,
    loadActiveProgramExerciseIds,
    buildQualityCorrective,
    annotateResultWithWarnings,
    type BuildProgramArgs,
    type BuildValidation,
} from '@/lib/assistant/build-validator'
import type { StyleSlotId } from '@/lib/assistant/style-slots'
import type { StyleState } from '@/lib/assistant/style-state'

/**
 * Fallback de provedor DIFERENTE — SEMPRE OpenAI. É o último elo seguro quando o
 * modelo escolhido (Gemini/Claude) não tem key configurada ou o provedor está
 * instável. NÃO troque por um modelo Gemini/Claude: o valor deste fallback é
 * justamente ser de OUTRO provedor que o padrão do experimento, preservando a
 * resiliência ENTRE PROVEDORES na cadeia de retry do build (ver modelChain).
 */
const FALLBACK_MODEL = 'gpt-4.1-mini'

/**
 * Whitelist de modelos aceitos por env (tanto ASSISTANT_MODEL quanto
 * ASSISTANT_BUILD_MODEL) — p/ não aceitar lixo de env. Valor fora daqui cai no
 * default do respectivo resolvedor.
 */
const BUILD_MODELS: ReadonlySet<string> = new Set([
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
    'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash',
])

/**
 * EXPERIMENTO GLOBAL (21/jul/2026): modelo padrão de TODOS os turnos do assistente
 * — não só o build, mas também consulta, resumo, análise, edição, mensagem e
 * cobrança. Configurável por env ASSISTANT_MODEL, mesma mecânica do
 * resolveBuildModel: whitelist (BUILD_MODELS) + fallback de provedor. Se a env
 * faltar/for inválida, usa o default do experimento (gemini-3.6-flash); se o
 * modelo escolhido for de um provedor sem key (Gemini sem GOOGLE_GENERATIVE_AI_API_KEY,
 * Claude sem ANTHROPIC_API_KEY), cai pro FALLBACK_MODEL (OpenAI).
 *
 * REVERSÍVEL SEM DEPLOY: setar ASSISTANT_MODEL=gpt-4.1-mini no Vercel volta ao
 * comportamento anterior ao experimento (turnos normais no mini OpenAI).
 */
const DEFAULT_ASSISTANT_MODEL = 'gemini-3.6-flash'
function resolveAssistantModel(): string {
    const env = process.env.ASSISTANT_MODEL
    const wanted = env && BUILD_MODELS.has(env) ? env : DEFAULT_ASSISTANT_MODEL
    if (wanted.startsWith('claude') && !process.env.ANTHROPIC_API_KEY) return FALLBACK_MODEL
    if (wanted.startsWith('gemini') && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) return FALLBACK_MODEL
    return wanted
}
// Resolvido em tempo de CARGA do módulo (mesmo nome exportado de antes, p/ não
// quebrar imports). O tipo agora é `string`: o default do experimento
// (gemini-3.6-flash) não está no union LLMModel, e o metering já aceita string.
export const ASSISTANT_MODEL: string = resolveAssistantModel()

/**
 * Modelo dos turnos de CRIAÇÃO de programa (qualidade-crítico). Configurável por
 * env ASSISTANT_BUILD_MODEL. Permite usar um modelo mais forte/diferente SÓ no
 * build — onde a qualidade da prescrição importa — sem mexer nos turnos normais.
 * Whitelist (BUILD_MODELS) p/ não aceitar lixo de env.
 *
 * Padrão dos build turns = Gemini 3.6 Flash (upgrade 21/jul/2026: mesma família
 * do 3.5, output mais barato e ~17% menos tokens de saída, melhor em agêntico).
 * Rollback sem deploy: ASSISTANT_BUILD_MODEL=gemini-3.5-flash. Sem a key do
 * provedor escolhido → cai pro FALLBACK_MODEL (OpenAI, provedor DIFERENTE — não
 * pro ASSISTANT_MODEL, que no experimento também pode ser Gemini).
 */
const DEFAULT_BUILD_MODEL = 'gemini-3.6-flash'
function resolveBuildModel(): string {
    const env = process.env.ASSISTANT_BUILD_MODEL
    const wanted = env && BUILD_MODELS.has(env) ? env : DEFAULT_BUILD_MODEL
    if (wanted.startsWith('claude') && !process.env.ANTHROPIC_API_KEY) return FALLBACK_MODEL
    if (wanted.startsWith('gemini') && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) return FALLBACK_MODEL
    return wanted
}

/** Chave do provedor pelo prefixo — usada p/ decidir se dois modelos são de
 *  provedores DIFERENTES (resiliência da modelChain), sem instanciar o provider. */
function providerKey(model: string): 'google' | 'anthropic' | 'openai' {
    if (model.startsWith('gemini')) return 'google'
    return model.startsWith('claude') ? 'anthropic' : 'openai'
}

/** Provider pelo prefixo: gemini → Google; claude → Anthropic; resto → OpenAI. */
function providerFor(model: string) {
    const key = providerKey(model)
    if (key === 'google') return google(model)
    return key === 'anthropic' ? anthropic(model) : openai(model)
}

// Detecção de turno de build (modelo/orçamentos/retry) vive em build-signals.ts
// — módulo leve, testável, com os modos de falha de prod documentados.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Tiers Pro+ — usados SÓ onde o recurso é exclusivo do topo (ex.: briefing
 *  proativo). O Assistente on-demand NÃO usa isto (ver ASSISTANT_TIERS). */
export const PRO_TIERS: ReadonlySet<AiTier> = new Set<AiTier>(['pro_ia', 'premium_ia'])

/** Tiers que TÊM o Assistente on-demand = TODOS. O free entra com "taste"
 *  (1× cada ação pesada + N conversas/mês); os pagos pelo balde de créditos.
 *  O limite por-uso é decidido em gateAssistant (getAiUsageSummary.exhausted).
 *  Mantido como ponto único caso um tier futuro precise ficar sem IA. */
export const ASSISTANT_TIERS: ReadonlySet<AiTier> = new Set<AiTier>([
    'free', 'essencial', 'pro_ia', 'premium_ia',
])

export type AssistantGate =
    | { allowed: true; tier: AiTier; period: 'week' | 'month' }
    | { allowed: false; status: 403; error: 'tier_locked'; message: string }
    | { allowed: false; status: 403; error: 'maintenance'; message: string }
    | { allowed: false; status: 402; error: 'quota_exceeded'; message: string; resetAt: string | null }

/**
 * Gate de acesso ao Assistente (defense-in-depth — a UI já reflete).
 * TODOS os planos têm o Assistente; o acesso é por USO, não por tier:
 *   - tier precisa estar em ASSISTANT_TIERS (hoje: todos);
 *   - orçamento do ciclo não esgotado — unificado em getAiUsageSummary.exhausted
 *     (free: taste 1×/ação + N conversas/mês; pagos: balde de créditos).
 *     Esgotou → 402 amigável (degrada pra GUI).
 * Compartilhado pelo ⌘K (command_bar) e pela aba dedicada (workspace).
 */
export async function gateAssistant(
    admin: SupabaseClient,
    trainerId: string,
): Promise<AssistantGate> {
    // Kill-switch operacional (freio de emergência, sem deploy): desliga todos os
    // turnos antes de tocar tier/cota/LLM. 403 amigável de manutenção.
    if (isAssistantDisabled()) {
        return { allowed: false, status: 403, error: 'maintenance', message: ASSISTANT_MAINTENANCE_MESSAGE }
    }
    // getAiUsageSummary já resolve o tier + o estado de cota/free-trial num só lugar.
    const summary = await getAiUsageSummary(admin, trainerId)
    const tier = summary.tier
    if (!ASSISTANT_TIERS.has(tier)) {
        return {
            allowed: false,
            status: 403,
            error: 'tier_locked',
            message: 'O Assistente com IA não está disponível no seu plano.',
        }
    }
    if (summary.exhausted) {
        return {
            allowed: false,
            status: 402,
            error: 'quota_exceeded',
            message:
                tier === 'free'
                    ? 'Você usou seus créditos de IA deste mês no plano Gratuito. Assine um plano para continuar com o Assistente — o resto do app segue normal.'
                    : 'Sua cota de IA deste ciclo acabou. Você pode continuar pela interface normal; os créditos renovam em breve.',
            resetAt: summary.periodEnd ?? null,
        }
    }
    return { allowed: true, tier, period: getQuotaForTier(tier)?.period ?? 'month' }
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

// Vocabulário ampliado (Onda 1 — 2026-07-01): sinônimos comuns que antes NÃO
// casavam ("anamnese", "checkout", "medida", "avisa"…) derrubavam o turno no
// fallback estreito e o modelo "não conseguia" sem explicar. Falso positivo aqui
// é barato (só ADICIONA um domínio de tools); falso negativo é falha silenciosa.
const KEYWORD_INTENTS: ReadonlyArray<readonly [RegExp, ToolIntent]> = [
    [/pag|cobran|fatur|assinatur|plano|receita|mrr|inadimpl|contrat|checkout|pix|boleto|mensalidade|pre[çc]o|valor|reajust/i, 'financeiro'],
    [/treino|programa|prescri|exerc|s[ée]rie|carga|superset|ficha|split|periodiz|divis[ãa]o|hipertrofia|m[ée]todo|substitu|duplic|c[óo]pia|copiar|les[ãa]o|machuc/i, 'prescricao'],
    [/agenda|sess[ãa]o|hor[áa]rio|reagend|marcar|consulta|compromisso|remarc|desmarc|atendimento/i, 'agenda'],
    [/formul[áa]rio|check-?in|question[áa]rio|anamnese|par-?q|pesquisa/i, 'forms'],
    [/avalia|medi[çc][ãa]o|dobra|circunfer|medida|bioimped|antropom|percentual|gordura|composi[çc][ãa]o corporal|imc/i, 'avaliacao'],
    [/mensag|conversa|whats|recado|respond|avis|escrev|lembre|lembra/i, 'comunicacao'],
    [/lead|prospect|interessad|indica[çc][ãa]o|convers[ãa]o de lead/i, 'leads'],
    [/aluno|progresso|ader[êe]ncia|insight|arquiv|inativ|cadastr/i, 'alunos'],
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
    // Sem sinal confiável de intenção → SEM subsetting: devolve vazio e a ponte
    // carrega o catálogo INTEIRO (resolveToolSubset([]) = todas as tools). O
    // fallback antigo ([alunos, financeiro, agenda]) deixava 5 dos 8 domínios de
    // fora — a principal fonte de "o assistente não conseguiu" silencioso,
    // pior no mobile (que não tem rota). Subsetting agora é otimização quando há
    // confiança, nunca amputação quando não há.
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
    'kinevo_archive_student',
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
    kinevo_send_message: 'Enviar mensagem ao aluno',
    kinevo_send_message_batch: 'Enviar mensagem a vários alunos',
    kinevo_send_form: 'Enviar formulário ao(s) aluno(s)',
    kinevo_schedule_form: 'Agendar formulário recorrente',
    kinevo_generate_checkout_link: 'Gerar link de pagamento',
    kinevo_archive_student: 'Arquivar aluno',
    kinevo_correct_assessment: 'Corrigir avaliação finalizada',
    kinevo_create_student_draft_program: 'Criar programa para o aluno',
    kinevo_assign_program: 'Ativar programa do aluno',
}

/**
 * Preview-first (22/jul): o build transacional do rascunho é CONFIRM_TOOL (a
 * ponte tira o execute), mas ganha um execute de CAPTURA no engine — o payload
 * validado pelo gate de qualidade vira a PRÉVIA do programa no chat, e a criação
 * real só acontece no execute-tool quando o treinador aprova (salvar/ativar).
 */
const DRAFT_PROGRAM_TOOL = 'kinevo_create_student_draft_program'

/** Resultado sintético devolvido ao modelo quando a prévia é capturada. */
function previewCaptureResult(): unknown {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                preview_pending: true,
                message:
                    'Prévia do programa apresentada ao treinador — o programa AINDA NÃO foi criado. ' +
                    'Encerre com 1–2 frases sobre o racional da montagem e aguarde a decisão dele no card. ' +
                    'NÃO chame mais tools neste turno e NÃO repita a estrutura em texto (o card já mostra o programa completo).',
            }),
        }],
    }
}

/** A captura da prévia (não é uma execução real — sai de crédito/parts/memória). */
function isPreviewCaptureResult(result: unknown): boolean {
    const content = (result as { content?: Array<{ text?: string }> } | null)?.content
    return Array.isArray(content) && typeof content[0]?.text === 'string' &&
        content[0].text.includes('"preview_pending":true')
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

/**
 * Tools cujo card mostra um campo EDITÁVEL (textarea) antes de executar — ex.: a
 * mensagem ao aluno, que o treinador revê/ajusta na hora em vez de aprovar cego.
 */
const EDITABLE_FIELD: Record<string, { field: string; label: string }> = {
    kinevo_send_message: { field: 'content', label: 'Mensagem' },
    kinevo_send_message_batch: { field: 'content', label: 'Mensagem' },
}

function buildConfirmation(
    toolName: string,
    args: Record<string, unknown>,
): ToolConfirmationRequest {
    const editable = EDITABLE_FIELD[toolName]
    return {
        toolName,
        title: CONFIRM_TITLES[toolName] ?? toolName,
        summary: summarizeArgs(args),
        args,
        destructive: DESTRUCTIVE_TOOLS.has(toolName),
        // C6: chave única por card p/ o execute-tool dedup re-cliques/retries.
        idempotencyKey: randomUUID(),
        ...(editable ? { editableField: editable.field, editableLabel: editable.label } : {}),
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
function withReadGuard(tools: ToolSet): { tools: ToolSet; reset: () => void } {
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
    // reset: o fallback de modelo de build re-roda o turno do ZERO (contexto
    // novo, sem os resultados anteriores) — sem limpar o `seen`, as re-leituras
    // legítimas do fallback receberiam o corretivo em vez dos dados.
    return { tools: guarded, reset: () => seen.clear() }
}

/**
 * Gate de qualidade da prescrição (P3 — 13/jul). Intercepta os args dos creates
 * TRANSACIONAIS de programa antes de executar e valida as regras profissionais
 * do playbook em CÓDIGO (build-validator): violação grave → NÃO executa e
 * devolve um corretivo `blocked` (mesma família do read-guard/homônimos: não
 * cobra, não vira card) para o modelo corrigir e re-chamar no mesmo turno;
 * deslize → executa e anexa quality_warnings ao resultado. Best-effort: uma
 * falha do PRÓPRIO gate (DB fora etc.) nunca impede a criação.
 */
const BUILD_CREATE_TOOLS = [
    'kinevo_create_student_draft_program',
    'kinevo_create_program_template',
] as const

function withBuildQualityGate(
    tools: ToolSet,
    admin: SupabaseClient,
    trainerId: string,
): ToolSet {
    const gated: ToolSet = { ...tools }
    for (const name of BUILD_CREATE_TOOLS) {
        const t = gated[name]
        const orig = t?.execute
        if (!t || typeof orig !== 'function') continue
        gated[name] = {
            ...t,
            execute: (async (args, options) => {
                let verdict: BuildValidation | null = null
                try {
                    const buildArgs = args as BuildProgramArgs & { student_id?: string }
                    const [catalog, style, prevIds] = await Promise.all([
                        loadBuildCatalog(admin, buildArgs),
                        loadTrainerStyle(admin, trainerId),
                        // W7 (renovação repetida): só o caminho de draft tem aluno.
                        buildArgs.student_id
                            ? loadActiveProgramExerciseIds(admin, buildArgs.student_id)
                            : Promise.resolve(null),
                    ])
                    verdict = validateBuildArgs(buildArgs, catalog, style, prevIds)
                } catch (err) {
                    console.error('[build-quality-gate] gate indisponível — criação segue sem validação', err)
                    verdict = null
                }
                if (verdict && verdict.errors.length > 0) {
                    return buildQualityCorrective(verdict)
                }
                const result = await orig(args, options)
                return verdict && verdict.warnings.length > 0
                    ? annotateResultWithWarnings(result, verdict.warnings)
                    : result
            }) as typeof t.execute,
        }
    }
    return gated
}

// ----------------------------------------------------------------------------
// Turno do assistente.
// ----------------------------------------------------------------------------
export interface AssistantTurnHistory {
    role: 'user' | 'assistant'
    content: string
}

/** Mensagem de histórico aceita pelo turno: texto simples (legado/⌘K) OU
 *  mensagem NATIVA com tool-calls/results (P2 — toNativeModelHistory). */
export type AssistantHistoryMessage = AssistantTurnHistory | NativeModelMessage

export interface ExecutedToolSummary {
    toolName: string
    result: unknown
    /** Args da chamada (P2): persistidos na part `executed` p/ o replay nativo. */
    args?: Record<string, unknown>
}

/**
 * Modo do turno (composer do Assistente):
 *  - 'agir'     → executa ações no Kinevo (comportamento padrão/histórico).
 *  - 'planejar' → propõe um plano antes de agir; não escreve nada sem o "ok".
 *  - 'analisar' → SOMENTE LEITURA: o catálogo do turno cai para READ_TOOLS, então
 *                 nenhuma escrita/confirmação é sequer possível (garantia forte).
 */
export type AssistantTurnMode = 'agir' | 'planejar' | 'analisar'

/** Normaliza um valor cru (body da rota) para um modo válido; default 'agir'. */
export function parseTurnMode(raw: unknown): AssistantTurnMode {
    return raw === 'planejar' || raw === 'analisar' ? raw : 'agir'
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
    /** Tier do treinador (vem do gate) — define o teto de cota no metering (C1). */
    tier?: AiTier
    /** Histórico anterior (aba conversacional); vazio no ⌘K. Mensagens nativas
     *  (tool-calls/results de toNativeModelHistory) são repassadas ao modelo. */
    history?: AssistantHistoryMessage[]
    /** Rota atual (⌘K) — afeta o subsetting de tools. */
    route?: string
    /** Aluno em foco (UUID) — enriquece o contexto e direciona as tools. */
    studentId?: string
    /** Modo do composer (Agir/Planejar/Analisar). Default 'agir'. Analisar corta o
     *  catálogo para READ_TOOLS; os três injetam uma instrução no system-prompt. */
    mode?: AssistantTurnMode
    /** Programa em foco (Onda 2): o mais recente tocado na conversa — o modelo
     *  edita direto pelos IDs do bloco <<DADOS_DE_TOOLS>> em vez de reler. */
    programFocus?: ProgramFocus | null
    /** Progresso ao vivo: chamado no início de cada tool-call p/ streaming na UI. */
    onProgress?: (label: string) => void
    /** Streaming de token (U-STREAM): delta de texto da resposta, na ordem. */
    onTextDelta?: (delta: string) => void
    /** O modelo de build falhou e o turno reiniciou no fallback: o cliente deve
     *  descartar o texto parcial já recebido. */
    onTextReset?: () => void
    /** Stop real (U-STOP): abortar aqui cancela o LLM no SERVIDOR (não só o fetch).
     *  As rotas passam request.signal — desconexão/Parar do cliente interrompe o turno. */
    abortSignal?: AbortSignal
    /** Conversa de ENTREVISTA DE ESTILO (ai_conversations.kind='style_interview').
     *  Liga um turno roteirizado: sem tools do Kinevo, sem contexto, sem créditos. */
    styleInterview?: { conversationId: string; state: StyleState }
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
    kinevo_add_cardio_to_session: 'Adicionando bloco aeróbio…',
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
    /** Memória do turno (Onda 2): digests de LEITURAS que valem follow-up
     *  (MEMORY_READ_TOOLS). As rotas persistem como parts `context` (internas). */
    memory: Array<{ toolName: string; digest: string }>
    credits: number
    /** Medidor atualizado. `null` se o metering/resumo (best-effort) falhou — o
     *  texto do turno já foi gerado e NÃO deve ser derrubado por erro de DB. */
    summary: AiUsageSummary | null
    /** Entrevista de estilo: slot que a pergunta deste turno cobre (a rota grava a
     *  resposta seguinte nele). Ausente fora do modo entrevista. */
    styleSlot?: StyleSlotId | null
    /** Entrevista de estilo: o estilo foi aprovado e salvo neste turno. */
    styleSaved?: boolean
}

// 32 (era 20): o histórico nativo (P2) expande cada turno com tools em DUAS
// mensagens (assistant + tool) — a janela de 20 mensagens persistidas do
// builder vira até ~28 ModelMessages; 32 evita cortar os pares mais antigos.
const MAX_HISTORY = 32

/**
 * Executa um turno: entende a intenção, auto-executa leituras/ações simples e
 * pausa nas CONFIRM_TOOLS (HITL). Faz o metering e devolve o medidor atualizado.
 * Pressupõe que o caller já validou auth + tier (gateAssistant) + cota.
 */
export async function runAssistantTurn(opts: AssistantTurnInput): Promise<AssistantTurnResult> {
    const { admin, trainerId, trainerName, input, surface, periodType } = opts
    let bridgeClose: (() => Promise<void>) | null = null

    // MODO ENTREVISTA DE ESTILO: um turno inteiramente diferente — sem ponte MCP,
    // sem contexto do treinador, sem metering (D5). Sai antes de tudo isso em vez
    // de desviar de cada peça no caminho. Ver style-interview.ts.
    if (opts.styleInterview) {
        const interview = await runStyleInterviewTurn({
            admin,
            trainerId,
            trainerName: trainerName ?? null,
            conversationId: opts.styleInterview.conversationId,
            input,
            state: opts.styleInterview.state,
            // A entrevista conversa em texto puro (sem tools MCP): achata qualquer
            // mensagem nativa do histórico (P2) para {role, content} simples.
            history: (opts.history ?? [])
                .filter((m): m is AssistantHistoryMessage & { role: 'user' | 'assistant' } =>
                    m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: historyText(m) })),
            model: ASSISTANT_MODEL,
            provider: providerFor,
            onProgress: opts.onProgress,
            onTextDelta: opts.onTextDelta,
            onTextReset: opts.onTextReset,
            abortSignal: opts.abortSignal,
        })
        return {
            text: interview.text,
            confirmation: null,
            question: interview.question,
            proposal: interview.proposal,
            executed: [],
            memory: [],
            credits: 0,
            summary: null,
            styleSlot: interview.slot,
            styleSaved: interview.saved,
        }
    }

    try {
        // 1. Sinais do turno. As intents NÃO cortam mais o catálogo de tools
        //    (P5 — 13/jul): o subsetting por regex era a maior fonte de "o
        //    assistente não conseguiu" silencioso (falso negativo amputava o
        //    domínio inteiro) e, com o custo de input atual, o catálogo completo
        //    é barato. As intents seguem valendo onde regex funciona como
        //    OTIMIZAÇÃO (falso positivo inofensivo): minimização LGPD do
        //    contexto e montagem dos blocos do prompt (P4). buildTurn garante os
        //    sinais de prescrição num turno de RESPOSTA do build ("5x por
        //    semana") que não tem palavra-chave própria.
        const buildTurn = isBuildTurn(input, opts.history ?? [])
        const intents = resolveIntents(input, opts.route)
        if (buildTurn) {
            if (!intents.includes('prescricao')) intents.push('prescricao')
            if (!intents.includes('alunos')) intents.push('alunos')
        }
        const bridge = await buildMcpTools(trainerId)
        bridgeClose = bridge.close

        // Projeção lossless dos READS p/ o LLM (P7): tira null/vazio do payload
        // (~30% de um get_program real) antes de entrar no contexto. Aplica na
        // CAMADA MAIS INTERNA — digests/memória/cards derivam do mesmo resultado
        // enxuto (parseiam igual; campo ausente = campo null).
        const projectedTools: ToolSet = { ...bridge.tools }
        for (const [name, t] of Object.entries(projectedTools)) {
            const orig = t.execute
            if (!READ_TOOLS.has(name) || typeof orig !== 'function') continue
            projectedTools[name] = {
                ...t,
                execute: (async (a, o) => projectMcpResultForLlm(await orig(a, o))) as typeof t.execute,
            }
        }

        // PREVIEW-FIRST: re-anexa um execute de captura no build do rascunho (a
        // ponte o tirou por ser CONFIRM_TOOL). O gate de qualidade embrulha ESTE
        // execute — a correção in-turn (quality_errors → modelo re-chama) continua
        // viva; passando no gate, o payload é capturado e vira a prévia no fim.
        let programPreviewArgs: Record<string, unknown> | null = null
        const draftTool = projectedTools[DRAFT_PROGRAM_TOOL]
        if (draftTool) {
            projectedTools[DRAFT_PROGRAM_TOOL] = {
                ...draftTool,
                execute: (async (args) => {
                    programPreviewArgs = (args ?? {}) as Record<string, unknown>
                    return previewCaptureResult()
                }) as typeof draftTool.execute,
            }
        }

        // Guard anti-loop nas leituras (dedup por tool+args no turno).
        const { tools: readGuardedTools, reset: resetReadGuard } = withReadGuard(projectedTools)
        // Aluno em foco: o modelo já TEM o aluno (UUID + perfil no contexto) e não
        // precisa "listar alunos". Em prod ele entrava em loop justamente aqui
        // (kinevo_list_students 12x → estourava maxSteps sem concluir). Removemos a
        // tool nesse caso — determinístico, mata o loop na raiz.
        if (opts.studentId) delete readGuardedTools['kinevo_list_students']

        // Guarda de homônimos (determinística): write com student_id cujo pedido
        // cita o aluno só pelo 1º nome havendo 2+ homônimos → NÃO executa; o
        // corretivo manda o modelo perguntar (perguntar_treinador). CONFIRM_TOOLS
        // são checadas no card (abaixo). Carteira carregada 1x, sob demanda.
        let rosterCache: StudentRef[] | null = null
        const getRoster = async (): Promise<StudentRef[]> => {
            if (rosterCache) return rosterCache
            const { data } = await admin
                .from('students')
                .select('id, name')
                .eq('coach_id', trainerId)
                .eq('is_trainer_profile', false)
                .limit(400)
            rosterCache = ((data ?? []) as Array<{ id: string; name: string | null }>)
                .map((s) => ({ id: s.id, name: (s.name ?? '').trim() }))
                .filter((s) => s.name.length > 0)
            return rosterCache
        }
        const guardedBridgeTools = withAmbiguityGuard(readGuardedTools, {
            input,
            focusedStudentId: opts.studentId,
            getRoster,
        })
        // Gate de qualidade da prescrição nos creates transacionais (P3).
        const qualityGatedTools = withBuildQualityGate(guardedBridgeTools, admin, trainerId)

        const tools: ToolSet = {
            ...qualityGatedTools,
            // "Ask the user": client tool (SEM execute) — o app renderiza as opções
            // como botões clicáveis e a escolha vira o próximo turno.
            perguntar_treinador: tool({
                description:
                    'Faz uma pergunta de esclarecimento ao treinador com OPÇÕES clicáveis. Use quando faltar informação para agir (ex.: para qual aluno, qual objetivo, frequência semanal). Prefira esta tool a perguntar em texto livre. Não descreva os botões; apenas chame a tool.',
                inputSchema: perguntarSchema,
            }),
            // "Propor": client tool (SEM execute) — apresenta um plano para aprovar/ajustar.
            propor_ao_treinador: tool({
                description:
                    'Apresenta ao treinador uma PROPOSTA pronta para ele APROVAR, AJUSTAR (editando os valores) ou CANCELAR — ex.: a estrutura de um programa ANTES de criar. Use quando você já montou o plano e precisa do "ok". NÃO use a tool de escolha (perguntar_treinador) para isto: aqui os itens são linhas rótulo+valor editáveis. Escreva a pergunta de aprovação na sua resposta em texto.',
                inputSchema: proporSchema,
            }),
            // NOTA: o gerador determinístico (generateProgram/motor de prescrição) foi
            // REMOVIDO do assistente. Ele ignorava a ênfase pedida (volume_budget cego ao
            // pedido → ombro recebia menos que peito). Agora o assistente PRESCREVE como o
            // MCP externo: autora o programa com as próprias tools do Kinevo (create_program
            // + add_workout_session + add_exercise_to_session + create_superset / set_scheme),
            // decidindo o volume por grupo e honrando o que o treinador pediu. O motor segue
            // disponível só no botão "Gerar com IA" do builder.
        }

        // Modo do composer (Agir/Planejar/Analisar). 'analisar' = SOMENTE LEITURA:
        // remove do catálogo tudo que não é READ_TOOLS (writes/confirm/propor) —
        // garantia FORTE (o turno não consegue alterar dados mesmo se o modelo
        // tentar), não só uma instrução no prompt. perguntar_treinador (client tool,
        // sem execute) fica para o modelo ainda poder esclarecer.
        const turnMode: AssistantTurnMode = opts.mode ?? 'agir'
        if (turnMode === 'analisar') {
            for (const name of Object.keys(tools)) {
                if (name === 'perguntar_treinador') continue
                if (!READ_TOOLS.has(name)) delete tools[name]
            }
        }

        // 2. Prompt + histórico. Instruções estáveis (system-prompt v2) primeiro;
        //    bloco HITL/MCP em seguida; contexto dinâmico por último (studentId
        //    enriquece com o perfil do aluno).
        // Minimização LGPD: dado clínico/saúde só vai ao LLM nos turnos que precisam.
        // Restrição médica (clínica) → só prescrição/avaliação/build. Check-in cru →
        // turnos de saúde/monitoramento (inclui alunos/forms/comunicação). Turnos
        // puramente financeiros/agenda/leads não recebem nem um nem outro.
        const isHealthIntent = (i: ToolIntent) => i === 'prescricao' || i === 'avaliacao'
        const isMonitorIntent = (i: ToolIntent) =>
            isHealthIntent(i) || i === 'alunos' || i === 'forms' || i === 'comunicacao'
        const dynamicContext = await buildChatContext(trainerId, trainerName ?? '', opts.studentId, {
            includeMedical: buildTurn || intents.some(isHealthIntent),
            includeCheckins: buildTurn || intents.some(isMonitorIntent),
        })
        const routeHint = opts.route ? `\nTela atual do treinador: ${opts.route}.` : ''
        const studentHint = opts.studentId
            ? `\nAluno em foco (UUID): ${opts.studentId}. Os dados dele JÁ ESTÃO no contexto acima — NÃO chame kinevo_list_students nem kinevo_get_student para "encontrar" o aluno (você já o tem); use este UUID direto nas ações. Só faça uma leitura do aluno se precisar de um dado específico que realmente não esteja no contexto, e NUNCA repita a mesma leitura.`
            : ''
        // Onda 2: programa em foco — follow-ups de edição usam os IDs do bloco
        // <<DADOS_DE_TOOLS>> do histórico em vez de reler o programa inteiro.
        const programHint = opts.programFocus
            ? `\nPrograma em foco (o mais recente desta conversa): ${opts.programFocus.name ? `"${opts.programFocus.name}" ` : ''}(program_id: ${opts.programFocus.id}). Para EDITAR esse programa ("troca X por Y", "muda os dias", "ajusta séries/carga"), use DIRETO os workout_id/item_id do bloco <<DADOS_DE_TOOLS>> do histórico nas tools de edição (kinevo_update_workout_item, kinevo_update_workout_session, kinevo_delete_workout_item…). Só chame kinevo_get_program de novo se um ID/dado necessário NÃO estiver no histórico.`
            : ''
        // Estilo de prescrição do treinador: só carregado quando o turno vai
        // MONTAR treino (mesma minimização de payload do bloco clínico acima —
        // num turno de financeiro o estilo é peso morto no prompt).
        const styleBlock =
            buildTurn || intents.includes('prescricao')
                ? await loadStyleBlock(admin, trainerId)
                : ''

        // Instrução do modo do composer. 'agir' é o padrão histórico (sem bloco).
        // 'analisar' reforça no prompt o que o corte de tools já garante; 'planejar'
        // muda o COMPORTAMENTO (propor antes de agir) — não há corte de tools nele.
        const modeInstructions =
            turnMode === 'analisar'
                ? '\n\n## MODO ANALISAR (somente leitura)\nO treinador está em modo ANALISAR. Você só pode LER e RESPONDER — NÃO altere nada (nada de criar/editar/atribuir/enviar/excluir). Suas ferramentas de escrita estão desativadas neste turno. Se o pedido exigir uma ação, explique o que faria e diga que ele pode trocar para o modo "Agir" para você executar.'
                : turnMode === 'planejar'
                  ? '\n\n## MODO PLANEJAR (planeje antes de agir)\nO treinador está em modo PLANEJAR. Antes de QUALQUER ação que altere dados, apresente primeiro um PLANO curto e claro (o que você fará, em quais alunos/programas) e peça o "ok" — use a tool propor_ao_treinador quando o plano tiver itens revisáveis. NÃO crie, edite, atribua, envie nem exclua nada sem a aprovação explícita dele. Leituras para embasar o plano são bem-vindas.'
                  : ''
        const system =
            buildInstructions(surface) +
            modeInstructions +
            buildMcpHitlInstructions({ intents, buildTurn }) +
            '\n\n' +
            dynamicContext +
            routeHint +
            studentHint +
            programHint +
            styleBlock

        // Corte do histórico: mensagens NATIVAS vêm em pares (assistant com
        // tool-calls + tool com os results) — um corte que deixasse uma mensagem
        // `tool` órfã na frente quebraria o provider. Após o slice, descarta
        // mensagens `tool` órfãs no início.
        let history = (opts.history ?? []).slice(-MAX_HISTORY)
        while (history.length > 0 && history[0].role === 'tool') history = history.slice(1)
        const messages = [...history, { role: 'user' as const, content: input }] as ModelMessage[]

        // Turnos de CONSTRUÇÃO de programa: mais tokens de saída (a chamada
        // create_program_template carrega o programa inteiro e truncaria em 1500) e um
        // teto de passos maior (ler contexto + listar exercícios + criar). `buildTurn`
        // já foi calculado no passo 1 (afeta o subset de tools). O modelo do build é
        // configurável (qualidade-crítico) — ver resolveBuildModel.
        let turnModel: string = buildTurn ? resolveBuildModel() : ASSISTANT_MODEL
        // Grau de BUILD do turno (orçamentos/thinking/retry). Começa na detecção
        // (build-signals) e pode ESCALAR em runtime: um turno "comum" que trunca a
        // saída sem concluir era um build não detectado — re-roda em grau de build.
        let buildGrade = buildTurn

        // U-STREAM (Onda 1 — 2026-07-01): o turno usa streamText e consome o
        // fullStream — deltas de texto vão ao cliente via onTextDelta (canal
        // NDJSON) e o rótulo de progresso sai no INÍCIO do tool-call
        // (tool-input-start), mais cedo que o antigo onStepFinish. Erro/abort do
        // stream viram exceção DEPOIS do consumo, preservando o fallback de
        // modelo de build e o contrato de retorno (texto/steps/usage completos).
        const runGen = async (model: string) => {
            const stream = streamText({
                model: providerFor(model),
                system,
                messages,
                // Build: 12000 (era 8000) — no Gemini o thinking consome do orçamento
                // de saída; a chamada create_*_program sozinha já é grande, e truncar
                // no meio do JSON perde o turno inteiro.
                maxOutputTokens: buildGrade ? 12000 : 1500,
                temperature: 0.3,
                // stopWhen é o TETO de passos. O build agora é: contexto (já injetado)
                // → perguntar/propor → 1 list_exercises em LOTE (muscle_groups[]) →
                // 1 create transacional (~4–6 passos); 16 dá folga p/ correções sem
                // abrir loop (visto em prod: 10–11 list_exercises seriais estouravam
                // os 12 e o programa nunca era criado). Fora do build, 8 (era 5):
                // pedidos COMPOSTOS legítimos ("cria o aluno, registra a avaliação e
                // agenda a sessão") não cabiam em 5 — o turno morria no meio. O
                // anti-loop (read-guard) e o teto de créditos (MAX_TURN_CREDITS)
                // seguram o caso patológico.
                stopWhen: stepCountIs(buildGrade ? 16 : 8),
                tools,
                abortSignal: opts.abortSignal,
                // P1 do plano do harness (13/jul): thinking do Gemini nos turnos de
                // BUILD — o modelo planeja split/volume/restrições ANTES de emitir a
                // chamada transacional gigante (a classe de erro que motivou o upgrade
                // de modelo). Budget explícito p/ custo/latência previsíveis; só é
                // enviado quando o modelo do turno é Gemini (outros providers ignoram
                // a chave `google`, mas nem a recebem).
                ...(model.startsWith('gemini') && buildGrade
                    ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: 4096 } } } }
                    : {}),
            })
            let streamError: unknown = null
            let aborted = false
            let lastLabel = ''
            // NARRAÇÃO PROGRESSIVA (13/jul): o texto dos passos INTERMEDIÁRIOS
            // ("Achei o aluno, agora vou puxar o programa…") era DESCARTADO — o
            // treinador via só rótulos genéricos e a resposta final, enquanto o
            // mesmo fluxo via MCP externo narra o raciocínio e parece vivo. Agora
            // acumulamos TODOS os deltas (com parágrafo entre passos) e o texto
            // final do turno é a narração completa — o que o cliente viu em
            // streaming é exatamente o que persiste (sem reset no meio).
            let narration = ''
            let sawTextInStep = false
            for await (const part of stream.fullStream) {
                if (part.type === 'text-delta') {
                    if (part.text) {
                        sawTextInStep = true
                        narration += part.text
                        opts.onTextDelta?.(part.text)
                    }
                } else if (part.type === 'start-step') {
                    if (sawTextInStep) {
                        sawTextInStep = false
                        narration += '\n\n'
                        opts.onTextDelta?.('\n\n')
                    }
                } else if (part.type === 'tool-input-start') {
                    const label = progressLabel(part.toolName)
                    if (label !== lastLabel) {
                        lastLabel = label
                        opts.onProgress?.(label)
                    }
                } else if (part.type === 'error') {
                    streamError = part.error
                } else if (part.type === 'abort') {
                    aborted = true
                }
            }
            if (aborted) {
                const e = new Error('Turno interrompido pelo treinador.')
                e.name = 'AbortError'
                throw e
            }
            if (streamError) {
                throw streamError instanceof Error ? streamError : new Error(String(streamError))
            }
            const [steps, totalUsage, toolCalls, finishReason] = await Promise.all([
                stream.steps,
                stream.totalUsage,
                stream.toolCalls,
                stream.finishReason,
            ])
            return { text: narration.trim(), steps, totalUsage, toolCalls, finishReason }
        }

        // 3. Entende a intenção e age. CONFIRM_TOOLS chegam sem execute → para.
        //    Cadeia de tentativas: o BUILD re-roda o MESMO modelo 2x (flakiness — ver
        //    leak abaixo) e então cai no FALLBACK_MODEL; o turno NORMAL tenta 1x e cai no
        //    FALLBACK_MODEL (gpt-4.1-mini, OUTRO provedor) se a 1ª tentativa LANÇAR —
        //    resiliência cross-provider quando o modelo do turno (ex.: Gemini) tem
        //    instabilidade/outage. O fallback só entra quando é de provedor DIFERENTE do
        //    modelo do turno. Erros vão ao trace — console.error
        //    dentro do ReadableStream NÃO aparece nos logs do Vercel. Abort (Stop
        //    do treinador) propaga: quem trata é a rota (nada a persistir/cobrar).
        //
        //    LEAK DO GEMINI (visto em prod/QA, ~1 em 4 builds): em vez de emitir a
        //    function call gigante do create, o modelo despeja o thinking + o JSON
        //    dos args como TEXTO e o turno "termina" sem criar nada. Detectamos o
        //    padrão e tratamos como falha → re-tenta. Se um write JÁ aconteceu no
        //    turno, NÃO re-rodamos (duplicaria a ação): só saneamos o texto.
        const leakedToolJsonText = (text: string): boolean => {
            const head = (text ?? '').slice(0, 4000)
            if (/^\s*thought\b/i.test(head)) return true
            // Resposta legítima nunca contém JSON de args de tool (regra do prompt).
            return /"exercise_id"\s*:/.test(head) || /"sessions"\s*:\s*\[/.test(head)
        }
        // Tentativa falha de build é COBRADA pelo provider mas o usage dela se
        // perdia (o metering só vê a vencedora → COGS real subestimado). O erro
        // sintético carrega o usage p/ o trace de retry registrar o custo.
        type UsageLike = { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number }
        const failAttempt = (message: string, name: string, usage: UsageLike): never => {
            const e = new Error(message) as Error & { usage?: UsageLike }
            e.name = name
            e.usage = usage
            throw e
        }
        const hasSuccessfulWrite = (r: Awaited<ReturnType<typeof runGen>>): boolean => {
            const steps = r.steps as unknown as Array<{
                toolResults: Array<{ toolName: string; output?: unknown }>
            }>
            return steps.some((s) =>
                s.toolResults.some(
                    (tr) => !READ_TOOLS.has(tr.toolName) && toolResultOk(tr.output),
                ),
            )
        }

        // Cadeia de retry. O BUILD re-roda o MESMO modelo 2x antes do fallback (Gemini
        // é flaky no build ~1 em 4: vaza a tool-call como texto, ou termina vazio); o
        // turno NORMAL tenta 1x. Ambos terminam no FALLBACK_MODEL, de OUTRO provedor
        // (OpenAI), QUANDO o modelo do turno é de provedor diferente — agora que o
        // ASSISTANT_MODEL pode ser Gemini em TODOS os turnos (não só o build), sem esse
        // elo uma instabilidade/outage do Gemini derrubaria o turno inteiro em vez de
        // cair no OpenAI. O turno NORMAL só chega nesse elo se a 1ª tentativa LANÇAR
        // (erro real de provedor): uma conclusão normal quebra o loop já no attempt 0,
        // sem custo extra no caminho feliz. Só anexa quando o provedor difere do modelo
        // do turno (não repete o mesmo modelo quando o turno já roda no provedor do
        // fallback).
        const modelChain = buildTurn ? [turnModel, turnModel] : [turnModel]
        if (providerKey(turnModel) !== providerKey(FALLBACK_MODEL)) {
            modelChain.push(FALLBACK_MODEL)
        }
        let result: Awaited<ReturnType<typeof runGen>> | null = null
        let sanitizeLeakedText = false
        let lastErr: unknown = null
        for (let attempt = 0; attempt < modelChain.length; attempt++) {
            turnModel = modelChain[attempt]
            try {
                const r = await runGen(turnModel)
                if (buildGrade && leakedToolJsonText(r.text)) {
                    if (hasSuccessfulWrite(r)) {
                        // Ação aterrissou; só o texto veio corrompido — não re-rodar.
                        result = r
                        sanitizeLeakedText = true
                        lastErr = null
                        break
                    }
                    failAttempt(
                        'Gemini vazou a tool-call como texto (thinking leak).',
                        'LeakedToolJsonError',
                        r.totalUsage,
                    )
                }
                // Outro sabor da mesma flakiness: o build termina VAZIO — sem texto,
                // sem write e sem pergunta/proposta/card. É perda total garantida
                // (viraria o fallback "não consegui") — re-tentar é sempre melhor.
                if (buildGrade && !r.text.trim() && !hasSuccessfulWrite(r)) {
                    const rawCalls = r.toolCalls as unknown as Array<{ toolName: string }>
                    const askedOrPaused = rawCalls.some(
                        (tc) =>
                            tc.toolName === 'perguntar_treinador' ||
                            tc.toolName === 'propor_ao_treinador' ||
                            CONFIRM_TOOLS.has(tc.toolName),
                    )
                    if (!askedOrPaused) {
                        failAttempt(
                            'Turno de build terminou vazio (sem texto, write ou pergunta).',
                            'EmptyBuildTurnError',
                            r.totalUsage,
                        )
                    }
                }
                // ESCALADA POR TRUNCAMENTO (rede de segurança da detecção de build):
                // um turno "comum" que estourou o orçamento de saída SEM concluir um
                // write era um build não detectado — o create truncou no meio do JSON
                // (visto em prod 13/jul: "planejar o próximo programa" não casava com
                // a regex e o turno da aprovação morreu em 1500 tokens). Re-roda UMA
                // vez em grau de build (orçamento 12000, 16 passos, modelo de build).
                if (!buildGrade && r.finishReason === 'length' && !hasSuccessfulWrite(r)) {
                    buildGrade = true
                    modelChain.push(resolveBuildModel())
                    failAttempt(
                        'Saída truncada sem concluir — escalando para grau de build.',
                        'TruncatedTurnError',
                        r.totalUsage,
                    )
                }
                result = r
                lastErr = null
                break
            } catch (genErr) {
                if ((genErr as Error)?.name === 'AbortError') throw genErr
                lastErr = genErr
                const msg = genErr instanceof Error ? genErr.message : String(genErr)
                // Usage da tentativa falha (quando o erro sintético o carrega):
                // o provider cobrou esses tokens — ficam visíveis no trace mesmo
                // sem entrar no metering de créditos (só a vencedora cobra).
                const failedUsage = (genErr as { usage?: UsageLike }).usage
                await recordTurnTrace(admin, {
                    trainerId,
                    studentId: opts.studentId,
                    kind: 'turn',
                    surface,
                    input,
                    output: `[build-retry ${attempt + 1}/${modelChain.length}] ${turnModel} falhou: ${msg}`.slice(0, 500),
                    model: turnModel,
                    intents,
                    inputTokens: failedUsage?.inputTokens ?? null,
                    cachedInputTokens: failedUsage?.cachedInputTokens ?? null,
                    outputTokens: failedUsage?.outputTokens ?? null,
                    costMicros: failedUsage
                        ? turnCostMicros(turnModel, {
                              inputTokens: failedUsage.inputTokens ?? 0,
                              cachedInputTokens: failedUsage.cachedInputTokens ?? 0,
                              outputTokens: failedUsage.outputTokens ?? 0,
                          })
                        : null,
                }).catch(() => {})
                // O modelo que falhou pode ter emitido texto parcial: o cliente
                // descarta; e a tentativa seguinte começa sem os tool-results deste
                // — libera o dedup de leituras para as re-consultas legítimas.
                opts.onTextReset?.()
                resetReadGuard()
                // Prévia capturada por uma tentativa que morreu não vale: a
                // re-rodada monta (e captura) do zero.
                programPreviewArgs = null
            }
        }
        if (!result) throw lastErr ?? new Error('Turno falhou sem resultado.')
        if (sanitizeLeakedText) {
            result = {
                ...result,
                text: 'Montei o programa e ele já está salvo como rascunho no perfil do aluno, pronto para a sua revisão. (Tive um problema ao redigir o resumo — me pergunte se quiser os detalhes.)',
            }
        }

        // 4. Coleta o executado (crédito) e a confirmação pendente (HITL).
        interface RawToolCall {
            toolCallId: string
            toolName: string
            input?: Record<string, unknown>
        }
        interface RawToolResult extends RawToolCall {
            output?: unknown
        }
        const steps = result.steps as unknown as Array<{ toolResults: RawToolResult[] }>
        const toolCalls = result.toolCalls as unknown as RawToolCall[]

        const executed: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }> = []
        const executedIds = new Set<string>()
        for (const step of steps) {
            for (const tr of step.toolResults) {
                executedIds.add(tr.toolCallId)
                executed.push({ toolName: tr.toolName, args: tr.input ?? {}, result: tr.output })
            }
        }
        // Preview-first: a captura da prévia NÃO é uma execução — sai da lista
        // (não vira part "executado", não entra em crédito nem memória). A
        // criação real é cobrada no execute-tool quando o treinador aprova.
        for (let i = executed.length - 1; i >= 0; i--) {
            if (executed[i].toolName === DRAFT_PROGRAM_TOOL && isPreviewCaptureResult(executed[i].result)) {
                executed.splice(i, 1)
            }
        }

        let confirmation: ToolConfirmationRequest | null = null
        let blockedReason: string | null = null
        let disambigQuestion: QuestionRequest | null = null
        for (const tc of toolCalls) {
            if (!executedIds.has(tc.toolCallId) && CONFIRM_TOOLS.has(tc.toolName)) {
                // Homônimos (determinístico): CONFIRM_TOOLS não têm execute, então a
                // guarda roda AQUI — alvo citado só pelo 1º nome com 2+ alunos iguais
                // → nada de card; vira pergunta estruturada com os nomes completos.
                const sidArg = (tc.input as { student_id?: unknown } | undefined)?.student_id
                if (typeof sidArg === 'string' && sidArg.length > 0) {
                    try {
                        const cands = ambiguousStudentTarget(input, sidArg, await getRoster(), opts.studentId)
                        if (cands) {
                            disambigQuestion = {
                                question: 'Encontrei mais de um aluno com esse nome — qual deles?',
                                options: cands.map((c) => c.name).slice(0, 6),
                                multiple: false,
                                allowOther: true,
                            }
                            break
                        }
                    } catch {
                        // Guarda best-effort: nunca trava uma confirmação legítima.
                    }
                }
                const card = buildConfirmation(tc.toolName, tc.input ?? {})
                // G5: valida os args ANTES de mostrar o card. Inválido → não mostra
                // card, vira clarificação. Válido com alvo → resumo legível no card.
                const validation = await validateConfirmArgs(admin, trainerId, tc.toolName, tc.input ?? {})
                if (!validation.ok) {
                    blockedReason = validation.reason
                } else {
                    if (validation.target) {
                        card.summary = validation.target.label
                        // Destinatário em destaque no card (ex.: nome do aluno da mensagem).
                        if (validation.target.details?.recipientName) {
                            card.recipientName = validation.target.details.recipientName
                        }
                    }
                    confirmation = card
                }
                break
            }
        }

        // Preview-first: o payload capturado do build vira o card de PRÉVIA do
        // programa (uma confirmação rica — a UI renderiza a estrutura completa
        // com "Salvar rascunho" / "Ativar agora"). Tem precedência sobre outro
        // card pendente do mesmo turno: qualquer outra ação dependeria de um
        // programa que ainda não existe.
        if (programPreviewArgs) {
            const card = buildConfirmation(DRAFT_PROGRAM_TOOL, programPreviewArgs)
            const validation = await validateConfirmArgs(admin, trainerId, DRAFT_PROGRAM_TOOL, programPreviewArgs)
            if (!validation.ok) {
                blockedReason = validation.reason
                confirmation = null
            } else {
                if (validation.target) card.summary = validation.target.label
                confirmation = card
            }
        }

        // "Ask the user": se o modelo chamou perguntar_treinador (client tool, sem
        // execute), monta a pergunta estruturada p/ a UI mostrar opções clicáveis.
        // A pergunta sintetizada pela guarda de homônimos tem precedência.
        let question: QuestionRequest | null = disambigQuestion
        for (const tc of toolCalls) {
            if (question) break
            if (!executedIds.has(tc.toolCallId) && tc.toolName === 'perguntar_treinador') {
                const a = (tc.input ?? {}) as { pergunta?: unknown; opcoes?: unknown; multipla?: unknown }
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
                const a = (tc.input ?? {}) as { itens?: unknown; rotulo_acao?: unknown }
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
        // Homônimo detectado → o texto do turno é a PERGUNTA (o que o modelo tinha
        // escrito descrevia uma ação que não vai acontecer sem a escolha).
        let finalText = blockedReason
            ? `${result.text ? result.text + '\n\n' : ''}⚠️ ${blockedReason}`
            : disambigQuestion
              ? disambigQuestion.question
              : (result.text || (question?.question ?? '') || (proposal ? 'Aprova a proposta abaixo?' : ''))

        // Prévia sem texto do modelo: nunca deixa o card aparecer "mudo".
        if (!finalText && confirmation?.toolName === DRAFT_PROGRAM_TOOL) {
            finalText = 'Montei o programa — revise a prévia abaixo e escolha entre salvar como rascunho ou já ativar para o aluno.'
        }

        // Defesa em profundidade: um turno que terminou SEM texto, pergunta, proposta
        // e confirmação (ex.: estourou maxSteps sem concluir) jamais pode aparecer em
        // branco pro treinador ("travado"). Devolve um fallback amigável e acionável.
        if (!finalText && !confirmation && !question && !proposal) {
            finalText = 'Não consegui concluir essa ação agora. Pode reformular ou me dar um pouco mais de detalhe (ex.: frequência, ênfase, equipamento)?'
        }

        // 5. Metering do turno (CONFIRM_TOOLS NÃO entram — cobradas no execute-tool).
        //    Só cobra tools que REALMENTE deram certo: uma tool que falhou (mcpError →
        //    isError:true) não pode ser cobrada (auditoria 2026-06-22, C2). O piso de 1
        //    crédito do turno LLM segue (computeTurnCredits) mesmo se todas falharam.
        //    Corretivos INTERNOS (read-guard `repeated` / guarda de homônimos `blocked`)
        //    não são ação nenhuma: nem cobrança, nem card "executado".
        const isInternalCorrective = (r: unknown): boolean =>
            !!r && typeof r === 'object' && ('repeated' in (r as object) || 'blocked' in (r as object))
        const successfulCalls = executed.filter(
            (e) => toolResultOk(e.result) && !isInternalCorrective(e.result),
        )
        const turnCalls: TurnToolCall[] = successfulCalls.map((e) => ({
            tool: e.toolName,
            studentCount: studentCountFromArgs(e.args),
        }))
        const credits = computeTurnCredits(turnCalls)

        // Memória do turno (Onda 2): leituras que valem follow-up viram digest
        // (persistido pela rota como part `context`, interna). Redige antes de
        // digerir — a memória re-entra no prompt em turnos futuros.
        const memory: Array<{ toolName: string; digest: string }> = []
        for (const e of executed) {
            if (!MEMORY_READ_TOOLS.has(e.toolName)) continue
            if (!toolResultOk(e.result) || isInternalCorrective(e.result)) continue
            const digest = digestToolResult(e.toolName, redactSensitive(e.result))
            if (digest) memory.push({ toolName: e.toolName, digest })
        }
        // Cache do provider (OpenAI/Gemini reportam automático). undefined =
        // não reportado → NULL no registro (≠ 0 medido) e 0 na conta de custo
        // (o custo registrado vira TETO conservador, nunca subestimativa).
        const cachedInputTokens = result.totalUsage.cachedInputTokens
        const costMicros = turnCostMicros(turnModel, {
            inputTokens: (result.totalUsage.inputTokens ?? 0),
            cachedInputTokens: cachedInputTokens ?? 0,
            outputTokens: (result.totalUsage.outputTokens ?? 0),
        })

        const events: AiUsageEventInput[] = turnCalls.map((c, idx) => ({
            actionClass: actionClassForTool(c.tool),
            credits: creditWeightForCall(c.tool, c.studentCount),
            surface,
            ...(idx === 0
                ? {
                      model: turnModel,
                      inputTokens: (result.totalUsage.inputTokens ?? 0),
                      cachedInputTokens,
                      outputTokens: (result.totalUsage.outputTokens ?? 0),
                      costMicros,
                  }
                : {}),
        }))
        if (events.length === 0) {
            events.push({
                actionClass: 'query',
                credits: 1,
                surface,
                model: turnModel,
                inputTokens: (result.totalUsage.inputTokens ?? 0),
                cachedInputTokens,
                outputTokens: (result.totalUsage.outputTokens ?? 0),
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
                // Teto de cota do ciclo (C1): clamp atômico no DB — o medidor nunca
                // estoura (Free clampa na franquia mensal). Sem tier (ex.: proativo) → sem teto.
                creditLimit: opts.tier ? creditLimitForTier(opts.tier) : null,
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
                model: turnModel,
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
                inputTokens: (result.totalUsage.inputTokens ?? 0),
                cachedInputTokens: cachedInputTokens ?? null,
                outputTokens: (result.totalUsage.outputTokens ?? 0),
                costMicros,
                steps: steps.length,
            })
        } catch (e) {
            console.error('[runAssistantTurn] metering/summary/trace best-effort falhou', e)
        }

        return {
            text: finalText,
            confirmation,
            question,
            proposal,
            // Só AÇÕES (writes) viram cards "executado" na UI. Leituras e corretivos
            // internos (read-guard `repeated`, homônimo `blocked`) NÃO são mostráveis —
            // senão vazam "Ação executada" ×N e tool-speak técnico pro treinador.
            executed: executed
                .filter((e) => !READ_TOOLS.has(e.toolName) && !isInternalCorrective(e.result))
                .map((e) => ({ toolName: e.toolName, result: e.result, args: e.args })),
            memory,
            credits,
            summary,
        }
    } finally {
        if (bridgeClose) await bridgeClose().catch(() => {})
    }
}
