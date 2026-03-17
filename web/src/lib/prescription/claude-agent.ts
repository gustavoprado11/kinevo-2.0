// ============================================================================
// Kinevo Prescription Engine — Claude Agent Client
// ============================================================================
// Multi-turn Claude agent with web search for evidence-based prescription.
// Two phases: analyze (context + questions) and generate (program + rationale).

// OpenAI API called via fetch (no SDK dependency)

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

const OPENAI_MODEL = 'gpt-4.1-mini'

// Phase-specific limits
const ANALYSIS_MAX_TOKENS = 2048
const ANALYSIS_TIMEOUT_MS = 30_000

const GENERATION_MAX_TOKENS = 8000
const GENERATION_TIMEOUT_MS = 120_000

// GPT-4.1-mini input/output cost per 1M tokens (USD)
const COST_PER_1M_INPUT = 0.40
const COST_PER_1M_OUTPUT = 1.60

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
    studentNarrative?: string | null,
): Promise<AnalyzeResult> {
    console.log('[AgentePrescitor] analyzeContextAndAsk chamado')
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        return {
            analysis: emptyAnalysis(),
            questions: [],
            conversationMessages: [],
            status: 'missing_api_key',
        }
    }

    const systemPrompt = buildAgentSystemPrompt()
    const userMessage = buildAgentContextMessage(profile, exercises, enrichedContext, serverQuestions, studentNarrative)

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS)

        const fetchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: OPENAI_MODEL,
                max_tokens: ANALYSIS_MAX_TOKENS,
                temperature: 0.4,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
            }),
        })
        clearTimeout(timeout)

        if (!fetchResponse.ok) {
            console.error('[AgentePrescitor] OpenAI API error:', fetchResponse.status)
            return {
                analysis: emptyAnalysis(),
                questions: [],
                conversationMessages: [],
                status: 'http_error',
            }
        }

        const payload = await fetchResponse.json()
        logTokenUsage('analysis', payload)

        const textContent = payload?.choices?.[0]?.message?.content
        if (!textContent || typeof textContent !== 'string') {
            return {
                analysis: emptyAnalysis(),
                questions: [],
                conversationMessages: [],
                status: 'invalid_response',
            }
        }

        // Check finish reason
        if (payload?.choices?.[0]?.finish_reason === 'length') {
            console.warn('[AgentePrescitor] Analysis output truncated')
            return {
                analysis: emptyAnalysis(),
                questions: [],
                conversationMessages: [],
                status: 'agent_truncated',
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
        const status: AgentLLMStatus = err?.name === 'AbortError' ? 'timeout' : 'network_error'
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
    studentNarrative?: string | null,
): Promise<GenerateWithAgentResult> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        return { output: null, reasoning: null, status: 'missing_api_key', model: OPENAI_MODEL }
    }

    const systemPrompt = buildAgentSystemPrompt(constraints, trainerPatterns)

    // Build messages: conversation history + generation instruction (with exercises)
    const generationMessage = buildAgentGenerationMessage(agentState.answers, exercises, studentNarrative)

    const messages = [
        ...agentState.conversation_messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        })),
        { role: 'user' as const, content: generationMessage },
    ]

    // ── Diagnostic: estimate input size ──
    const systemPromptChars = systemPrompt.length
    const messagesChars = messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0)
    const totalChars = systemPromptChars + messagesChars
    const estimatedTokens = Math.round(totalChars / 4)
    console.log(
        `[AgentePrescitor] Generation input — system: ${systemPromptChars} chars, messages: ${messagesChars} chars, total: ${totalChars} chars, ~${estimatedTokens} tokens`
    )

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

        const fetchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: OPENAI_MODEL,
                max_tokens: GENERATION_MAX_TOKENS,
                temperature: 0.3,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
            }),
        })
        clearTimeout(timeout)

        if (!fetchResponse.ok) {
            console.error('[AgentePrescitor] OpenAI API error:', fetchResponse.status)
            return { output: null, reasoning: null, status: 'http_error', model: OPENAI_MODEL, fallback: true }
        }

        const payload = await fetchResponse.json()
        logTokenUsage('generation', payload)

        if (payload?.choices?.[0]?.finish_reason === 'length') {
            console.warn('[AgentePrescitor] Generation output truncated — triggering fallback')
            return { output: null, reasoning: null, status: 'agent_truncated', model: OPENAI_MODEL, fallback: true }
        }

        const textContent = payload?.choices?.[0]?.message?.content
        if (!textContent || typeof textContent !== 'string') {
            return { output: null, reasoning: null, status: 'invalid_response', model: OPENAI_MODEL }
        }

        // Extract JSON from the response (may contain markdown code blocks)
        const jsonStr = extractJsonFromText(textContent)
        const output = parseAiResponse(jsonStr)

        if (!output) {
            console.warn('[AgentePrescitor] Failed to parse agent generation response')
            return { output: null, reasoning: null, status: 'invalid_response', model: OPENAI_MODEL }
        }

        // Build extended reasoning
        const reasoning: PrescriptionReasoningExtended = {
            ...output.reasoning,
            context_analysis: agentState.context_analysis || undefined,
            evidence_references: [],
            trainer_answers: agentState.answers.length > 0 ? agentState.answers : undefined,
        }

        return {
            output: { ...output, reasoning },
            reasoning,
            status: 'agent_used',
            model: OPENAI_MODEL,
        }
    } catch (err: any) {
        console.error('[AgentePrescitor] Generation failed:', err?.message || err)
        const status: AgentLLMStatus = err?.name === 'AbortError' ? 'timeout' : 'network_error'
        return { output: null, reasoning: null, status, model: OPENAI_MODEL, fallback: true }
    }
}

// ============================================================================
// Helpers
// ============================================================================

function logTokenUsage(phase: string, payload: any): void {
    const input = payload?.usage?.prompt_tokens ?? 0
    const output = payload?.usage?.completion_tokens ?? 0
    const costUsd = (input / 1_000_000) * COST_PER_1M_INPUT + (output / 1_000_000) * COST_PER_1M_OUTPUT
    const finishReason = payload?.choices?.[0]?.finish_reason ?? 'unknown'
    console.log(
        `[AgentePrescitor] ${phase} tokens — input: ${input}, output: ${output}, cost: $${costUsd.toFixed(4)}, stop: ${finishReason}`
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
