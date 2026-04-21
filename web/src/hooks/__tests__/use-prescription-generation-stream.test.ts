import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import type { PrescriptionOutputSnapshot } from '@kinevo/shared/types/prescription'

// ── Supabase mock ────────────────────────────────────────────────────────────
// Shared refs so the test can drive fetch result and Realtime events.

const fetchResult: { data: unknown; error: unknown } = { data: null, error: null }
const realtimeHandlers: Array<(payload: { new?: unknown }) => void> = []
const removedChannels: unknown[] = []

const channel = {
    on(_event: string, _filter: unknown, cb: (payload: { new?: unknown }) => void) {
        realtimeHandlers.push(cb)
        return this
    },
    subscribe() {
        return this
    },
}

const supabaseMock = {
    from: () => ({
        select: () => ({
            eq: () => ({
                maybeSingle: async () => fetchResult,
            }),
        }),
    }),
    channel: () => channel,
    removeChannel: (c: unknown) => {
        removedChannels.push(c)
    },
}

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => supabaseMock,
}))

import { usePrescriptionGenerationStream } from '../use-prescription-generation-stream'

function makeSnapshot(nWorkouts: number): PrescriptionOutputSnapshot {
    return {
        program: { name: 'Prog', description: '', duration_weeks: 4 },
        workouts: Array.from({ length: nWorkouts }, (_, i) => ({
            name: `Treino ${String.fromCharCode(65 + i)}`,
            order_index: i,
            scheduled_days: [1 + i],
            items: [],
        })),
        reasoning: {
            structure_rationale: '',
            volume_rationale: '',
            workout_notes: [],
            attention_flags: [],
            confidence_score: 0.8,
        },
    }
}

function resetSupabaseMock() {
    fetchResult.data = null
    fetchResult.error = null
    realtimeHandlers.length = 0
    removedChannels.length = 0
}

function emitRealtime(newRow: unknown) {
    realtimeHandlers.forEach(h => h({ new: newRow }))
}

describe('usePrescriptionGenerationStream', () => {
    beforeEach(() => {
        resetSupabaseMock()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stays idle when generationId is null', () => {
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({ generationId: null, exercises: [] }),
        )
        expect(result.current.status).toBe('idle')
        expect(result.current.workouts).toEqual([])
        expect(result.current.isStreaming).toBe(false)
        expect(result.current.isDone).toBe(false)
    })

    it('goes to awaiting when row is missing and subscription is active', async () => {
        // fetchResult.data stays null → row not yet created
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({ generationId: 'g1', exercises: [] }),
        )
        // The fetch is async; let it settle.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(result.current.status).toBe('awaiting')
        expect(realtimeHandlers.length).toBe(1)
    })

    it('reveals workouts one per revealIntervalMs after Realtime UPDATE', async () => {
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({
                generationId: 'g2',
                exercises: [],
                revealIntervalMs: 450,
            }),
        )
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        await act(async () => {
            emitRealtime({ status: 'pending_review', output_snapshot: makeSnapshot(4) })
        })
        // First workout shows immediately.
        expect(result.current.workouts.length).toBe(1)
        expect(result.current.status).toBe('revealing')
        expect(result.current.isDone).toBe(false)

        await act(async () => { await vi.advanceTimersByTimeAsync(450) })
        expect(result.current.workouts.length).toBe(2)

        await act(async () => { await vi.advanceTimersByTimeAsync(450) })
        expect(result.current.workouts.length).toBe(3)

        await act(async () => { await vi.advanceTimersByTimeAsync(450) })
        expect(result.current.workouts.length).toBe(4)
        expect(result.current.isDone).toBe(true)
        expect(result.current.reasoning).not.toBeNull()
    })

    it('exposes error when backend reports status=failed via Realtime', async () => {
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({ generationId: 'g3', exercises: [] }),
        )
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })

        await act(async () => {
            emitRealtime({ status: 'failed', output_snapshot: null })
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toBeTruthy()
    })

    it('initial fetch returning a ready row triggers reveal without Realtime', async () => {
        fetchResult.data = {
            id: 'g4',
            status: 'pending_review',
            output_snapshot: makeSnapshot(2),
        }
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({
                generationId: 'g4',
                exercises: [],
                revealIntervalMs: 450,
            }),
        )
        // Let the fetch promise resolve (microtasks) + initial tick.
        await act(async () => { await vi.advanceTimersByTimeAsync(10) })
        expect(result.current.workouts.length).toBe(1)

        await act(async () => { await vi.advanceTimersByTimeAsync(450) })
        expect(result.current.workouts.length).toBe(2)
        expect(result.current.isDone).toBe(true)
    })

    it('revealIntervalMs=0 reveals everything on the same tick', async () => {
        fetchResult.data = {
            id: 'g5',
            status: 'pending_review',
            output_snapshot: makeSnapshot(3),
        }
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({
                generationId: 'g5',
                exercises: [],
                revealIntervalMs: 0,
            }),
        )
        await act(async () => { await vi.advanceTimersByTimeAsync(10) })
        expect(result.current.isDone).toBe(true)
        expect(result.current.workouts.length).toBe(3)
    })

    it('ignores output_snapshot=null (future status=generating rows)', async () => {
        const { result } = renderHook(() =>
            usePrescriptionGenerationStream({ generationId: 'g6', exercises: [] }),
        )
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })

        await act(async () => {
            emitRealtime({ status: 'generating', output_snapshot: null })
        })
        expect(result.current.status).toBe('awaiting')
        expect(result.current.workouts).toEqual([])
    })
})
