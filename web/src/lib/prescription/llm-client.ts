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
    /** HTTP status when status='http_error'; undefined otherwise. */
    http_status?: number
    /** Number of retries used before reaching this result (0 = first attempt). */
    retry_count?: number
}

export interface LLMTokenUsage {
    input_tokens: number
    output_tokens: number
    /** Subset of input_tokens that hit the provider's prompt cache (0 when unknown). */
    cached_input_tokens: number
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
    /**
     * Legacy JSON mode. Applies to OpenAI only; adds `response_format:
     * {type: 'json_object'}` to force JSON output without schema validation.
     * Ignored when `structured_output` is true (strict schema takes priority).
     * Kept because some call sites produce free-form JSON the caller parses.
     */
    json_object_mode?: boolean
}

// ============================================================================
// Pricing Table (USD per 1M tokens)
// ============================================================================
// Cached-input pricing reflects OpenAI's automatic prompt caching discount
// (50% off input). Anthropic does not yet expose a cached-input price here;
// their cache-read rate is approximated at 10% of the base input price, but
// we model 0 (no discount) until we actually consume prompt caching there.

export interface LLMPricing {
    /** USD per 1M non-cached input tokens. */
    input: number
    /** USD per 1M cached input tokens. */
    cached_input: number
    /** USD per 1M output tokens. */
    output: number
}

export const PRICING: Record<LLMModel, LLMPricing> = {
    'claude-haiku-4-5-20251001': { input: 1.00, cached_input: 1.00, output: 5.00 },
    'claude-sonnet-4-6':         { input: 3.00, cached_input: 3.00, output: 15.00 },
    'gpt-4.1-mini':              { input: 0.40, cached_input: 0.20, output: 1.60 },
    'gpt-4o-mini':               { input: 0.15, cached_input: 0.075, output: 0.60 },
}

/**
 * Cost of a call broken down by cached vs. new input. `input_new` is the
 * portion of prompt tokens that were NOT cached; `input_cached` is the
 * portion that hit the provider's prompt cache.
 */
export function computeCost(
    model: LLMModel,
    usage: { input_new: number; input_cached: number; output: number },
): number {
    const pricing = PRICING[model]
    return (
        (usage.input_new / 1_000_000) * pricing.input +
        (usage.input_cached / 1_000_000) * pricing.cached_input +
        (usage.output / 1_000_000) * pricing.output
    )
}

// Default generation models for the smart-v2 pipeline.
export const DEFAULT_GENERATION_MODEL: LLMModel = 'gpt-4.1-mini'
export const FALLBACK_GENERATION_MODEL: LLMModel = 'gpt-4o-mini'

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
        // Anthropic surfaces cache read tokens separately; we don't consume
        // that path yet, so treat all input as new.
        const cachedInputTokens = 0
        const cost = computeCost(options.model, {
            input_new: inputTokens - cachedInputTokens,
            input_cached: cachedInputTokens,
            output: outputTokens,
        })

        const usage: LLMTokenUsage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cached_input_tokens: cachedInputTokens,
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

    // Structured output via JSON Schema (preferred) or legacy JSON mode.
    if (options.structured_output) {
        body.response_format = {
            type: 'json_schema',
            json_schema: GENERATION_JSON_SCHEMA,
        }
    } else if (options.json_object_mode) {
        body.response_format = { type: 'json_object' }
    }

    // Opt-in full-payload dump. Off by default in production because prompts
    // are long and may leak context. Flip KINEVO_LLM_DEBUG_PAYLOAD=1 to trace.
    if (process.env.KINEVO_LLM_DEBUG_PAYLOAD === '1') {
        const redactedBody = {
            model: body.model,
            temperature: body.temperature,
            max_tokens: body.max_tokens,
            response_format: body.response_format,
            messages_summary: (body.messages as Array<{ role: string; content: string }>).map(m => ({
                role: m.role,
                chars: typeof m.content === 'string' ? m.content.length : 0,
            })),
        }
        console.log(
            `[LLMClient][debug] OpenAI request ${options.model} — ` +
            JSON.stringify(redactedBody),
        )
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
            // Always log the error body — OpenAI's structured error messages
            // ("Invalid schema for response_format: …") only live here.
            let errorBody: string | null = null
            try {
                errorBody = await response.clone().text()
            } catch { /* ignore */ }
            console.error(
                `[LLMClient] OpenAI HTTP ${response.status} model=${options.model}` +
                (errorBody ? ` body=${errorBody.slice(0, 2000)}` : ''),
            )
            return {
                data: null,
                status: 'http_error',
                model: options.model,
                usage: null,
                http_status: response.status,
            }
        }

        const payload = await response.json() as any

        const inputTokens = payload?.usage?.prompt_tokens ?? 0
        const outputTokens = payload?.usage?.completion_tokens ?? 0
        // OpenAI exposes cached prompt tokens in prompt_tokens_details.cached_tokens
        // when prompt caching is active (prompts ≥1024 tokens with a stable prefix).
        const cachedInputTokens =
            (payload?.usage?.prompt_tokens_details?.cached_tokens as number | undefined) ?? 0
        const cost = computeCost(options.model, {
            input_new: Math.max(0, inputTokens - cachedInputTokens),
            input_cached: cachedInputTokens,
            output: outputTokens,
        })

        const usage: LLMTokenUsage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cached_input_tokens: cachedInputTokens,
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
// Retry + Model Fallback (smart-v2 pipeline)
// ============================================================================

export interface RetryOptions {
    /** Max attempts including the first. Default 3. */
    maxAttempts?: number
    /** Base delay in ms. Delay is baseDelayMs * 2^(attempt-1). Default 1000. */
    baseDelayMs?: number
    /** Injectable sleep (tests override for deterministic timing). */
    sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Returns true when the result is recoverable by a retry (network hiccup, 5xx,
 * timeout). 4xx is a client/config error and never retried.
 */
function isRetryableFailure<T>(result: LLMCallResult<T>): boolean {
    if (result.status === 'success') return false
    if (result.status === 'network_error') return true
    if (result.status === 'timeout') return true
    if (result.status === 'http_error') {
        const code = result.http_status ?? 0
        return code === 0 || code >= 500
    }
    // missing_api_key / invalid_response / schema_validation_failed — not
    // transient, don't waste calls retrying.
    return false
}

/**
 * Runs a single LLM call with exponential backoff retry. Only retries
 * transient failures (see isRetryableFailure). Delays: 1s, 2s, 4s, …
 * Returns the final result with `retry_count` populated.
 */
export async function callWithRetry<T>(
    makeCall: () => Promise<LLMCallResult<T>>,
    opts: RetryOptions = {},
): Promise<LLMCallResult<T>> {
    const maxAttempts = opts.maxAttempts ?? 3
    const baseDelayMs = opts.baseDelayMs ?? 1000
    const sleep = opts.sleep ?? defaultSleep

    let lastResult: LLMCallResult<T> | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await makeCall()
        lastResult = { ...result, retry_count: attempt - 1 }

        if (result.status === 'success') return lastResult
        if (!isRetryableFailure(result)) return lastResult
        if (attempt === maxAttempts) return lastResult

        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        console.warn(
            `[LLMClient] attempt ${attempt}/${maxAttempts} failed (${result.status}); retrying in ${delay}ms`,
        )
        await sleep(delay)
    }

    // Unreachable under normal control flow; the loop always returns.
    return lastResult as LLMCallResult<T>
}

export interface ModelFallbackOptions<T> {
    /** Call factory parameterized by model. */
    makeCall: (model: LLMModel) => Promise<LLMCallResult<T>>
    /** Primary model tried up to `primaryRetry` attempts. */
    primary: LLMModel
    /** Fallback model tried once after primary fails. */
    fallback: LLMModel
    retry?: RetryOptions
}

/**
 * Tries the primary model with retry; on total failure, falls back to a
 * secondary model with a single attempt. Success short-circuits. The
 * returned result carries `model` = the one that actually succeeded (or
 * the last one tried on total failure).
 */
export async function callWithModelFallback<T>(
    opts: ModelFallbackOptions<T>,
): Promise<LLMCallResult<T>> {
    const primaryResult = await callWithRetry(
        () => opts.makeCall(opts.primary),
        opts.retry,
    )
    if (primaryResult.status === 'success') return primaryResult

    console.warn(
        `[LLMClient] primary ${opts.primary} exhausted (${primaryResult.status}); falling back to ${opts.fallback}`,
    )

    const fallbackResult = await callWithRetry(
        () => opts.makeCall(opts.fallback),
        { ...opts.retry, maxAttempts: 1 },
    )
    return fallbackResult
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
    const cachedHint =
        usage.cached_input_tokens > 0 ? `, cached: ${usage.cached_input_tokens}` : ''
    console.log(
        `[LLMClient] ${provider}/${model} — ` +
        `input: ${usage.input_tokens}${cachedHint}, output: ${usage.output_tokens}, ` +
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
