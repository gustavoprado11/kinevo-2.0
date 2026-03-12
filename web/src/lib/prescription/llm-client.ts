// ============================================================================
// Kinevo Prescription Engine v2 — Unified LLM Client
// ============================================================================
// Abstraction layer for calling Claude (Anthropic) and OpenAI models.
// Handles provider-specific formatting, structured output, cost tracking,
// timeout management, and fallback chains.
//
// This file does NOT replace claude-agent.ts (v1 pipeline).
// It is used exclusively by the v2 pipeline (llm-generator.ts).

import Anthropic from '@anthropic-ai/sdk'

import type { CompactAnalysisOutput, CompactGenerationOutput } from './schemas'
import { GENERATION_JSON_SCHEMA, validateCompactAnalysis, validateCompactGeneration } from './schemas'

// ============================================================================
// Types
// ============================================================================

export type LLMProvider = 'anthropic' | 'openai'

export type LLMModel =
    | 'claude-haiku-4-5-20251001'
    | 'claude-sonnet-4-6'
    | 'gpt-4.1-mini'
    | 'gpt-4o-mini'

export type LLMCallStatus =
    | 'success'
    | 'missing_api_key'
    | 'http_error'
    | 'invalid_response'
    | 'network_error'
    | 'timeout'
    | 'schema_validation_failed'

export interface LLMCallResult<T> {
    data: T | null
    status: LLMCallStatus
    model: LLMModel
    usage: LLMTokenUsage | null
}

export interface LLMTokenUsage {
    input_tokens: number
    output_tokens: number
    cost_usd: number
}

export interface LLMCallOptions {
    /** Model to use */
    model: LLMModel
    /** System prompt */
    system: string
    /** User message(s) */
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    /** Maximum output tokens */
    max_tokens: number
    /** Timeout in milliseconds */
    timeout_ms: number
    /** Temperature (0.0-1.0) */
    temperature?: number
    /** If true, use structured output (JSON Schema for OpenAI, prompt-enforced for Claude) */
    structured_output?: boolean
}

// ============================================================================
// Pricing Table (USD per 1M tokens)
// ============================================================================

const PRICING: Record<LLMModel, { input: number; output: number }> = {
    'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
    'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
    'gpt-4.1-mini':              { input: 0.40, output: 1.60 },
    'gpt-4o-mini':               { input: 0.15, output: 0.60 },
}

function computeCost(model: LLMModel, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model]
    return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

// ============================================================================
// Provider Detection
// ============================================================================

function getProvider(model: LLMModel): LLMProvider {
    if (model.startsWith('claude')) return 'anthropic'
    return 'openai'
}

function getApiKey(provider: LLMProvider): string | undefined {
    if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY
    return process.env.OPENAI_API_KEY
}

// ============================================================================
// Anthropic Client
// ============================================================================

async function callAnthropic(options: LLMCallOptions): Promise<LLMCallResult<string>> {
    const apiKey = getApiKey('anthropic')
    if (!apiKey) {
        return { data: null, status: 'missing_api_key', model: options.model, usage: null }
    }

    const client = new Anthropic({ apiKey })

    try {
        const response = await client.messages.create({
            model: options.model,
            max_tokens: options.max_tokens,
            temperature: options.temperature ?? 0.3,
            system: options.system,
            messages: options.messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        }, {
            timeout: options.timeout_ms,
        })

        const inputTokens = response.usage?.input_tokens ?? 0
        const outputTokens = response.usage?.output_tokens ?? 0
        const cost = computeCost(options.model, inputTokens, outputTokens)

        const usage: LLMTokenUsage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: cost,
        }

        logUsage('anthropic', options.model, usage, response.stop_reason ?? 'unknown')

        if (response.stop_reason === 'max_tokens') {
            console.warn(`[LLMClient] ${options.model} output truncated`)
            return { data: null, status: 'invalid_response', model: options.model, usage }
        }

        const textBlocks = response.content.filter(
            (block): block is Anthropic.TextBlock => block.type === 'text'
        )
        if (textBlocks.length === 0) {
            return { data: null, status: 'invalid_response', model: options.model, usage }
        }

        const text = textBlocks.map(b => b.text).join('\n')
        return { data: text, status: 'success', model: options.model, usage }
    } catch (err: any) {
        const status: LLMCallStatus = err?.message?.includes('timeout') ? 'timeout' : 'network_error'
        console.error(`[LLMClient] Anthropic ${options.model} failed:`, err?.message || err)
        return { data: null, status, model: options.model, usage: null }
    }
}

// ============================================================================
// OpenAI Client (native fetch — no SDK dependency)
// ============================================================================

async function callOpenAI(options: LLMCallOptions): Promise<LLMCallResult<string>> {
    const apiKey = getApiKey('openai')
    if (!apiKey) {
        return { data: null, status: 'missing_api_key', model: options.model, usage: null }
    }

    const body: Record<string, unknown> = {
        model: options.model,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.max_tokens,
        messages: [
            { role: 'system', content: options.system },
            ...options.messages,
        ],
    }

    // Structured output via JSON Schema
    if (options.structured_output) {
        body.response_format = {
            type: 'json_schema',
            json_schema: GENERATION_JSON_SCHEMA,
        }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout_ms)

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify(body),
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            console.error(`[LLMClient] OpenAI HTTP ${response.status}`)
            return { data: null, status: 'http_error', model: options.model, usage: null }
        }

        const payload = await response.json() as any

        const inputTokens = payload?.usage?.prompt_tokens ?? 0
        const outputTokens = payload?.usage?.completion_tokens ?? 0
        const cost = computeCost(options.model, inputTokens, outputTokens)

        const usage: LLMTokenUsage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: cost,
        }

        const finishReason = payload?.choices?.[0]?.finish_reason
        logUsage('openai', options.model, usage, finishReason ?? 'unknown')

        const content = payload?.choices?.[0]?.message?.content
        if (!content || typeof content !== 'string') {
            return { data: null, status: 'invalid_response', model: options.model, usage }
        }

        return { data: content, status: 'success', model: options.model, usage }
    } catch (err: any) {
        clearTimeout(timeoutId)
        const status: LLMCallStatus = err?.name === 'AbortError' ? 'timeout' : 'network_error'
        console.error(`[LLMClient] OpenAI ${options.model} failed:`, err?.message || err)
        return { data: null, status, model: options.model, usage: null }
    }
}

// ============================================================================
// Unified Call
// ============================================================================

/**
 * Calls an LLM model and returns the raw text response.
 * Automatically routes to the correct provider based on model name.
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMCallResult<string>> {
    const provider = getProvider(options.model)
    if (provider === 'anthropic') return callAnthropic(options)
    return callOpenAI(options)
}

// ============================================================================
// Typed Callers (parse + validate)
// ============================================================================

/**
 * Calls the analysis model and returns a validated CompactAnalysisOutput.
 * Extracts JSON from the response, validates structure, and returns typed output.
 */
export async function callAnalysisModel(
    options: LLMCallOptions,
): Promise<LLMCallResult<CompactAnalysisOutput>> {
    const result = await callLLM(options)

    if (!result.data) {
        return { data: null, status: result.status, model: result.model, usage: result.usage }
    }

    const parsed = parseJsonFromText(result.data)
    if (!parsed) {
        console.warn('[LLMClient] Analysis: failed to extract JSON from response')
        return { data: null, status: 'invalid_response', model: result.model, usage: result.usage }
    }

    const validated = validateCompactAnalysis(parsed)
    if (!validated) {
        console.warn('[LLMClient] Analysis: schema validation failed')
        return { data: null, status: 'schema_validation_failed', model: result.model, usage: result.usage }
    }

    return { data: validated, status: 'success', model: result.model, usage: result.usage }
}

/**
 * Calls the generation model and returns a validated CompactGenerationOutput.
 * Uses structured output for OpenAI; parses + validates for Claude.
 */
export async function callGenerationModel(
    options: LLMCallOptions,
): Promise<LLMCallResult<CompactGenerationOutput>> {
    const result = await callLLM(options)

    if (!result.data) {
        return { data: null, status: result.status, model: result.model, usage: result.usage }
    }

    const parsed = parseJsonFromText(result.data)
    if (!parsed) {
        console.warn('[LLMClient] Generation: failed to extract JSON from response')
        return { data: null, status: 'invalid_response', model: result.model, usage: result.usage }
    }

    const validated = validateCompactGeneration(parsed)
    if (!validated) {
        console.warn('[LLMClient] Generation: schema validation failed')
        return { data: null, status: 'schema_validation_failed', model: result.model, usage: result.usage }
    }

    return { data: validated, status: 'success', model: result.model, usage: result.usage }
}

// ============================================================================
// Fallback Chain
// ============================================================================

export interface FallbackChainOptions<T> {
    /** Ordered list of attempts. First success wins. */
    attempts: Array<{
        label: string
        call: () => Promise<LLMCallResult<T>>
    }>
}

/**
 * Executes a chain of LLM calls in order. Returns the first successful result.
 * If all attempts fail, returns the last failure result.
 */
export async function callWithFallback<T>(
    chain: FallbackChainOptions<T>,
): Promise<LLMCallResult<T>> {
    let lastResult: LLMCallResult<T> | null = null

    for (const attempt of chain.attempts) {
        console.log(`[LLMClient] Trying ${attempt.label}...`)
        const result = await attempt.call()
        lastResult = result

        if (result.data !== null && result.status === 'success') {
            console.log(`[LLMClient] ${attempt.label} succeeded`)
            return result
        }

        console.warn(`[LLMClient] ${attempt.label} failed: ${result.status}`)
    }

    return lastResult ?? {
        data: null,
        status: 'network_error',
        model: 'gpt-4.1-mini',
        usage: null,
    }
}

// ============================================================================
// Helpers
// ============================================================================

function logUsage(
    provider: string,
    model: string,
    usage: LLMTokenUsage,
    stopReason: string,
): void {
    console.log(
        `[LLMClient] ${provider}/${model} — ` +
        `input: ${usage.input_tokens}, output: ${usage.output_tokens}, ` +
        `cost: $${usage.cost_usd.toFixed(4)}, stop: ${stopReason}`
    )
}

/**
 * Extracts JSON from a text response that may contain markdown code blocks
 * or other surrounding text.
 */
function parseJsonFromText(text: string): unknown | null {
    // Try to extract from markdown code block first
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim()

    // Try direct parse
    try {
        return JSON.parse(jsonStr)
    } catch {
        // Try to find raw JSON object in the text
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0])
            } catch {
                return null
            }
        }
        return null
    }
}
