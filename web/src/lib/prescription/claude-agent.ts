// ============================================================================
// Kinevo Prescription Engine — Claude Agent Client
// ============================================================================
// Multi-turn Claude agent with web search for evidence-based prescription.
// Two phases: analyze (context + questions) and generate (program + rationale).

import Anthropic from '@anthropic-ai/sdk'

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    PrescriptionAgentQuestion,
    PrescriptionAgentState,
    PrescriptionContextAnalysis,
    PrescriptionReasoningExtended,
    TrainerPatterns,
} from '@kinevo/shared/types/prescription'

import type { EnrichedStudentContext } from './context-enricher'
import type { PrescriptionConstraints } from './constraints-engine'
import { buildAgentSystemPrompt, buildAgentContextMessage, buildAgentGenerationMessage } from './prompt-builder'
import { parseAiResponse } from './prompt-builder'

// ============================================================================
// Config
// ============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-6'

// Phase-specific limits
const ANALYSIS_MAX_TOKENS = 2048
const ANALYSIS_TIMEOUT_MS = 30_000

const GENERATION_MAX_TOKENS = 8000
const GENERATION_TIMEOUT_MS = 120_000

// Sonnet input/output cost per 1M tokens (USD)
const COST_PER_1M_INPUT = 3.0
const COST_PER_1M_OUTPUT = 15.0

// ============================================================================
// Types
// ============================================================================

export type AgentLLMStatus =
    | 'agent_used'
    | 'agent_truncated'
    | 'missing_api_key'
    | 'http_error'
    | 'invalid_response'
    | 'network_error'
    | 'timeout'

export interface AnalyzeResult {
    analysis: PrescriptionContextAnalysis
    questions: PrescriptionAgentQuestion[]
    conversationMessages: PrescriptionAgentState['conversation_messages']
    status: AgentLLMStatus
}

export interface GenerateWithAgentResult {
    output: PrescriptionOutputSnapshot | null
    reasoning: PrescriptionReasoningExtended | null
    status: AgentLLMStatus
    model: string
    fallback?: boolean
}

// ============================================================================
// Phase 1: Analyze context and decide if questions are needed
// ============================================================================

export async function analyzeContextAndAsk(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    enrichedContext: EnrichedStudentContext,
    serverQuestions?: PrescriptionAgentQuestion[],
): Promise<AnalyzeResult> {
    console.log('[AgentePrescitor] analyzeContextAndAsk chamado')
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        return {
            analysis: emptyAnalysis(),
            questions: [],
            conversationMessages: [],
            status: 'missing_api_key',
        }
    }

    const client = new Anthropic({ apiKey })
    const systemPrompt = buildAgentSystemPrompt()
    const userMessage = buildAgentContextMessage(profile, exercises, enrichedContext, serverQuestions)

    try {
        const response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: ANALYSIS_MAX_TOKENS,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage },
            ],
        }, {
            timeout: ANALYSIS_TIMEOUT_MS,
        })

        logTokenUsage('analysis', response)

        if (response.stop_reason === 'max_tokens') {
            console.warn('[AgentePrescitor] Analysis output truncated')
            return {
                analysis: emptyAnalysis(),
                questions: [],
                conversationMessages: [],
                status: 'agent_truncated',
            }
        }

        // Extract text content from response
        const textContent = extractTextFromResponse(response)
        if (!textContent) {
            return {
                analysis: emptyAnalysis(),
                questions: [],
                conversationMessages: [],
                status: 'invalid_response',
            }
        }

        // Parse the analysis JSON from the response
        const parsed = parseAnalysisResponse(textContent)

        // Build conversation history for the next turn
        const conversationMessages: PrescriptionAgentState['conversation_messages'] = [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: textContent },
        ]

        return {
            analysis: parsed.analysis,
            questions: parsed.questions,
            conversationMessages,
            status: 'agent_used',
        }
    } catch (err: any) {
        console.error('[AgentePrescitor] Analysis failed:', err?.message || err)
        const status: AgentLLMStatus = err?.message?.includes('timeout') ? 'timeout' : 'network_error'
        return {
            analysis: emptyAnalysis(),
            questions: [],
            conversationMessages: [],
            status,
        }
    }
}

// ============================================================================
// Phase 2: Generate program with answers + web search evidence
// ============================================================================

export async function generateWithAgent(
    agentState: PrescriptionAgentState,
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    enrichedContext: EnrichedStudentContext,
    constraints: PrescriptionConstraints,
    trainerPatterns?: TrainerPatterns | null,
): Promise<GenerateWithAgentResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        return { output: null, reasoning: null, status: 'missing_api_key', model: CLAUDE_MODEL }
    }

    const client = new Anthropic({ apiKey })
    const systemPrompt = buildAgentSystemPrompt(constraints, trainerPatterns)

    // Build messages: conversation history + generation instruction (with exercises)
    const generationMessage = buildAgentGenerationMessage(agentState.answers, exercises)

    const messages: Anthropic.MessageParam[] = [
        ...agentState.conversation_messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        })),
        { role: 'user', content: generationMessage },
    ]

    // ── Diagnostic: estimate input size ──
    const systemPromptChars = systemPrompt.length
    const messagesChars = messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0)
    const totalChars = systemPromptChars + messagesChars
    const estimatedTokens = Math.round(totalChars / 4) // rough 4 chars/token estimate
    console.log(
        `[AgentePrescitor] Generation input — system: ${systemPromptChars} chars, messages: ${messagesChars} chars, total: ${totalChars} chars, ~${estimatedTokens} tokens`
    )

    try {
        // Use streaming to avoid HeadersTimeoutError (undici closes connection
        // if no headers arrive within ~30s). Streaming sends tokens immediately.
        const stream = client.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: GENERATION_MAX_TOKENS,
            system: systemPrompt,
            messages,
        })

        // Await final message with manual timeout guard
        const response = await Promise.race([
            stream.finalMessage(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Generation timeout')), GENERATION_TIMEOUT_MS)
            ),
        ])

        logTokenUsage('generation', response)

        if (response.stop_reason === 'max_tokens') {
            console.warn('[AgentePrescitor] Generation output truncated — triggering fallback')
            return { output: null, reasoning: null, status: 'agent_truncated', model: CLAUDE_MODEL, fallback: true }
        }

        const textContent = extractTextFromResponse(response)
        if (!textContent) {
            return { output: null, reasoning: null, status: 'invalid_response', model: CLAUDE_MODEL }
        }

        // Extract JSON from the response (may contain markdown code blocks)
        const jsonStr = extractJsonFromText(textContent)
        const output = parseAiResponse(jsonStr)

        if (!output) {
            console.warn('[AgentePrescitor] Failed to parse agent generation response')
            return { output: null, reasoning: null, status: 'invalid_response', model: CLAUDE_MODEL }
        }

        // Build extended reasoning
        const reasoning: PrescriptionReasoningExtended = {
            ...output.reasoning,
            context_analysis: agentState.context_analysis || undefined,
            evidence_references: extractWebSearchUrls(response),
            trainer_answers: agentState.answers.length > 0 ? agentState.answers : undefined,
        }

        return {
            output: { ...output, reasoning },
            reasoning,
            status: 'agent_used',
            model: CLAUDE_MODEL,
        }
    } catch (err: any) {
        console.error('[AgentePrescitor] Generation failed:', err?.message || err)
        const status: AgentLLMStatus = err?.message?.includes('timeout')
            || err?.code === 'UND_ERR_HEADERS_TIMEOUT'
            ? 'timeout' : 'network_error'
        return { output: null, reasoning: null, status, model: CLAUDE_MODEL, fallback: true }
    }
}

// ============================================================================
// Helpers
// ============================================================================

function logTokenUsage(phase: string, response: Anthropic.Message): void {
    const input = response.usage?.input_tokens ?? 0
    const output = response.usage?.output_tokens ?? 0
    const costUsd = (input / 1_000_000) * COST_PER_1M_INPUT + (output / 1_000_000) * COST_PER_1M_OUTPUT
    console.log(
        `[AgentePrescitor] ${phase} tokens — input: ${input}, output: ${output}, cost: $${costUsd.toFixed(4)}, stop: ${response.stop_reason}`
    )
}

function emptyAnalysis(): PrescriptionContextAnalysis {
    return {
        student_summary: '',
        identified_gaps: [],
        web_search_insights: [],
        web_search_queries: [],
    }
}

function extractTextFromResponse(response: Anthropic.Message): string | null {
    const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    if (textBlocks.length === 0) return null
    return textBlocks.map(b => b.text).join('\n')
}

function extractWebSearchUrls(response: Anthropic.Message): string[] {
    const urls: string[] = []
    for (const block of response.content) {
        // Web search results appear as tool_use blocks with URLs in the response
        if (block.type === 'text' && block.text) {
            // Extract URLs from citations in the text
            const urlRegex = /https?:\/\/[^\s\])"']+/g
            const matches = block.text.match(urlRegex)
            if (matches) {
                urls.push(...matches)
            }
        }
    }
    return [...new Set(urls)]
}

function extractJsonFromText(text: string): string {
    // Try to extract JSON from markdown code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim()
    }

    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        return jsonMatch[0]
    }

    return text
}

interface AnalysisParsed {
    analysis: PrescriptionContextAnalysis
    questions: PrescriptionAgentQuestion[]
}

function parseAnalysisResponse(text: string): AnalysisParsed {
    const jsonStr = extractJsonFromText(text)

    try {
        const parsed = JSON.parse(jsonStr)

        const analysis: PrescriptionContextAnalysis = {
            student_summary: parsed.student_summary || parsed.analysis?.student_summary || '',
            identified_gaps: parsed.identified_gaps || parsed.analysis?.identified_gaps || [],
            web_search_insights: parsed.web_search_insights || parsed.analysis?.web_search_insights || [],
            web_search_queries: parsed.web_search_queries || parsed.analysis?.web_search_queries || [],
        }

        const rawQuestions = parsed.questions || parsed.perguntas_para_treinador || []
        const VALID_TYPES = ['single_choice', 'multi_choice', 'text'] as const
        const questions: PrescriptionAgentQuestion[] = rawQuestions.map((q: any, i: number) => {
            if (typeof q === 'string') {
                return { id: `q${i + 1}`, question: q, context: '', type: 'text' as const }
            }
            const type = VALID_TYPES.includes(q.type) ? q.type : 'text'
            return {
                id: q.id || `q${i + 1}`,
                question: q.question || q.pergunta || '',
                context: q.context || q.contexto || '',
                type,
                options: Array.isArray(q.options) ? q.options : undefined,
                allows_text: typeof q.allows_text === 'boolean' ? q.allows_text : undefined,
                placeholder: q.placeholder || undefined,
            }
        }).filter((q: PrescriptionAgentQuestion) => q.question.length > 0)

        return { analysis, questions }
    } catch {
        // If JSON parsing fails, try to extract questions from text
        console.warn('[AgentePrescitor] Could not parse analysis JSON, extracting from text')
        return {
            analysis: {
                student_summary: text.slice(0, 500),
                identified_gaps: [],
                web_search_insights: [],
                web_search_queries: [],
            },
            questions: [],
        }
    }
}
