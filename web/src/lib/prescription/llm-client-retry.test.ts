import { describe, it, expect, vi } from 'vitest'

import {
    callWithRetry,
    callWithModelFallback,
    computeCost,
    PRICING,
    type LLMCallResult,
    type LLMModel,
} from './llm-client'

function successResult<T>(model: LLMModel, data: T): LLMCallResult<T> {
    return {
        data,
        status: 'success',
        model,
        usage: { input_tokens: 100, output_tokens: 50, cached_input_tokens: 0, cost_usd: 0 },
    }
}

function failure(
    model: LLMModel,
    status: LLMCallResult<string>['status'],
    http?: number,
): LLMCallResult<string> {
    return { data: null, status, model, usage: null, http_status: http }
}

describe('callWithRetry', () => {
    it('returns success immediately without retry', async () => {
        const spy = vi.fn().mockResolvedValue(successResult('gpt-4.1-mini', 'ok'))
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithRetry(spy, { sleep, baseDelayMs: 1000 })
        expect(res.status).toBe('success')
        expect(res.retry_count).toBe(0)
        expect(spy).toHaveBeenCalledTimes(1)
        expect(sleep).not.toHaveBeenCalled()
    })

    it('retries transient failures with exponential backoff then succeeds', async () => {
        const spy = vi.fn()
            .mockResolvedValueOnce(failure('gpt-4.1-mini', 'network_error'))
            .mockResolvedValueOnce(failure('gpt-4.1-mini', 'timeout'))
            .mockResolvedValueOnce(successResult('gpt-4.1-mini', 'ok'))
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithRetry(spy, { sleep, baseDelayMs: 1000 })
        expect(res.status).toBe('success')
        expect(res.retry_count).toBe(2)
        expect(spy).toHaveBeenCalledTimes(3)
        expect(sleep).toHaveBeenNthCalledWith(1, 1000)
        expect(sleep).toHaveBeenNthCalledWith(2, 2000)
    })

    it('gives up after maxAttempts and returns last failure', async () => {
        const spy = vi.fn().mockResolvedValue(failure('gpt-4.1-mini', 'network_error'))
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithRetry(spy, { sleep, baseDelayMs: 1000, maxAttempts: 3 })
        expect(res.status).toBe('network_error')
        expect(res.retry_count).toBe(2)
        expect(spy).toHaveBeenCalledTimes(3)
        // 2 sleeps between the 3 attempts.
        expect(sleep).toHaveBeenCalledTimes(2)
    })

    it('does not retry 4xx http errors', async () => {
        const spy = vi.fn().mockResolvedValue(failure('gpt-4.1-mini', 'http_error', 401))
        const sleep = vi.fn()
        const res = await callWithRetry(spy, { sleep, baseDelayMs: 1000 })
        expect(res.status).toBe('http_error')
        expect(res.retry_count).toBe(0)
        expect(spy).toHaveBeenCalledTimes(1)
        expect(sleep).not.toHaveBeenCalled()
    })

    it('retries 5xx http errors', async () => {
        const spy = vi.fn()
            .mockResolvedValueOnce(failure('gpt-4.1-mini', 'http_error', 502))
            .mockResolvedValueOnce(successResult('gpt-4.1-mini', 'ok'))
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithRetry(spy, { sleep, baseDelayMs: 1000 })
        expect(res.status).toBe('success')
        expect(spy).toHaveBeenCalledTimes(2)
    })

    it('does not retry invalid_response or schema_validation_failed', async () => {
        const spy = vi.fn().mockResolvedValue(failure('gpt-4.1-mini', 'schema_validation_failed'))
        const res = await callWithRetry(spy, { sleep: vi.fn(), baseDelayMs: 1000 })
        expect(spy).toHaveBeenCalledTimes(1)
        expect(res.status).toBe('schema_validation_failed')
    })
})

describe('callWithModelFallback', () => {
    it('returns primary success without touching fallback', async () => {
        const make = vi.fn((model: LLMModel) =>
            Promise.resolve(successResult(model, `ok-${model}`)),
        )
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithModelFallback({
            makeCall: make,
            primary: 'gpt-4.1-mini',
            fallback: 'gpt-4o-mini',
            retry: { sleep, baseDelayMs: 1 },
        })
        expect(res.status).toBe('success')
        expect(res.model).toBe('gpt-4.1-mini')
        expect(make).toHaveBeenCalledTimes(1)
    })

    it('falls back to secondary model after primary exhausts retries', async () => {
        const make = vi.fn((model: LLMModel): Promise<LLMCallResult<string>> => {
            if (model === 'gpt-4.1-mini') return Promise.resolve(failure(model, 'network_error'))
            return Promise.resolve(successResult(model, 'fallback-ok'))
        })
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithModelFallback({
            makeCall: make,
            primary: 'gpt-4.1-mini',
            fallback: 'gpt-4o-mini',
            retry: { sleep, baseDelayMs: 1 },
        })
        // 3 primary attempts + 1 fallback = 4 calls.
        expect(make).toHaveBeenCalledTimes(4)
        expect(res.status).toBe('success')
        expect(res.model).toBe('gpt-4o-mini')
    })

    it('propagates last failure when both primary and fallback fail', async () => {
        const make = vi.fn(() =>
            Promise.resolve(failure('gpt-4.1-mini', 'network_error')),
        )
        const sleep = vi.fn().mockResolvedValue(undefined)
        const res = await callWithModelFallback({
            makeCall: make,
            primary: 'gpt-4.1-mini',
            fallback: 'gpt-4o-mini',
            retry: { sleep, baseDelayMs: 1 },
        })
        // 3 + 1 = 4 total.
        expect(make).toHaveBeenCalledTimes(4)
        expect(res.status).toBe('network_error')
    })
})

describe('computeCost', () => {
    it('charges cached input at the discounted rate (OpenAI: 50% off)', () => {
        const fullInput = computeCost('gpt-4.1-mini', {
            input_new: 1_000_000, input_cached: 0, output: 0,
        })
        const halfCached = computeCost('gpt-4.1-mini', {
            input_new: 500_000, input_cached: 500_000, output: 0,
        })
        // $0.40 full vs. $0.30 (0.5M @ $0.40 + 0.5M @ $0.20).
        expect(fullInput).toBeCloseTo(0.40, 5)
        expect(halfCached).toBeCloseTo(0.30, 5)
    })

    it('PRICING has gpt-4.1-mini cached rate at 50% off', () => {
        expect(PRICING['gpt-4.1-mini'].input).toBe(0.40)
        expect(PRICING['gpt-4.1-mini'].cached_input).toBe(0.20)
    })
})
