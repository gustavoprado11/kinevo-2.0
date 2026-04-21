'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

import type {
    PrescriptionOutputSnapshot,
    PrescriptionReasoningExtended,
} from '@kinevo/shared/types/prescription'
import type { Exercise } from '@/types/exercise'
import type { Workout } from '@/components/programs/program-builder-client'
import { hydrateGeneratedWorkout } from '@/components/programs/helpers/hydrate-workout'

export type PrescriptionGenerationStatus =
    | 'idle'       // no generationId yet
    | 'awaiting'   // generationId set, row missing or output_snapshot null
    | 'revealing'  // snapshot received, animating workouts in
    | 'done'       // reveal finished
    | 'error'      // backend marked status='failed' or fetch failed

export interface UsePrescriptionGenerationStreamArgs {
    generationId: string | null
    exercises: Exercise[]
    /**
     * Delay between workouts during the reveal animation. Pass `0` to skip
     * animation entirely (everything appears on the next tick). The builder
     * uses this to disable animation on refresh/deeplink.
     */
    revealIntervalMs?: number
}

export interface UsePrescriptionGenerationStreamReturn {
    /** Workouts revealed so far (grows over time while isStreaming). */
    workouts: Workout[]
    /** Extended reasoning; exposed once the reveal finishes. */
    reasoning: PrescriptionReasoningExtended | null
    /** True from the moment the snapshot arrives until the last workout is revealed. */
    isStreaming: boolean
    /** True after every workout has been revealed. */
    isDone: boolean
    /** Set when backend reports status='failed' or a fetch error occurs. */
    error: string | null
    /** Granular status for UI debugging / future use. */
    status: PrescriptionGenerationStatus
}

const DEFAULT_REVEAL_INTERVAL_MS = 450

export function usePrescriptionGenerationStream({
    generationId,
    exercises,
    revealIntervalMs = DEFAULT_REVEAL_INTERVAL_MS,
}: UsePrescriptionGenerationStreamArgs): UsePrescriptionGenerationStreamReturn {
    const [status, setStatus] = useState<PrescriptionGenerationStatus>(
        generationId ? 'awaiting' : 'idle',
    )
    const [snapshot, setSnapshot] = useState<PrescriptionOutputSnapshot | null>(null)
    const [revealedCount, setRevealedCount] = useState(0)
    const [error, setError] = useState<string | null>(null)

    // Refs survive across StrictMode double-mounts and avoid re-running timers.
    const revealStartedRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Cache hydrated workouts so each reveal tick doesn't regenerate temp IDs.
    const hydratedRef = useRef<Workout[]>([])
    // Latest exercises reference — hydration happens once snapshot arrives, so
    // we capture them at that moment and don't re-hydrate on later changes.
    const exercisesRef = useRef(exercises)
    exercisesRef.current = exercises

    // Reset internal state whenever the target generation changes. A consumer
    // passing a new id should get a clean slate.
    useEffect(() => {
        if (!generationId) {
            setStatus('idle')
            setSnapshot(null)
            setRevealedCount(0)
            setError(null)
            revealStartedRef.current = false
            hydratedRef.current = []
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
            return
        }
        setStatus('awaiting')
        setSnapshot(null)
        setRevealedCount(0)
        setError(null)
        revealStartedRef.current = false
        hydratedRef.current = []
    }, [generationId])

    // Fetch + subscribe. The effect depends on `generationId` only — exercises
    // and revealIntervalMs are read via refs / closures and shouldn't re-run
    // the subscription (which would drop and re-create the channel).
    useEffect(() => {
        if (!generationId) return

        const supabase = createClient()
        let cancelled = false

        function beginReveal(snap: PrescriptionOutputSnapshot) {
            if (cancelled) return
            if (revealStartedRef.current) return
            if (!snap || !Array.isArray(snap.workouts)) return

            revealStartedRef.current = true
            // Pre-hydrate once; the reveal state just slices this array.
            hydratedRef.current = snap.workouts.map(w =>
                hydrateGeneratedWorkout(w, exercisesRef.current),
            )
            setSnapshot(snap)
            setStatus('revealing')

            const total = hydratedRef.current.length
            if (total === 0) {
                setStatus('done')
                return
            }

            if (revealIntervalMs <= 0) {
                // No animation — reveal everything synchronously.
                setRevealedCount(total)
                setStatus('done')
                return
            }

            setRevealedCount(1)
            if (total === 1) {
                setStatus('done')
                return
            }

            timerRef.current = setInterval(() => {
                setRevealedCount(prev => {
                    const next = prev + 1
                    if (next >= total) {
                        if (timerRef.current) {
                            clearInterval(timerRef.current)
                            timerRef.current = null
                        }
                        setStatus('done')
                        return total
                    }
                    return next
                })
            }, revealIntervalMs)
        }

        function markFailed(message: string) {
            if (cancelled) return
            setError(message)
            setStatus('error')
        }

        // 1) Initial fetch — row may already exist if the user refreshed or
        // if the pipeline finished before we subscribed.
        void (async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('prescription_generations')
                    .select('id, status, output_snapshot')
                    .eq('id', generationId)
                    .maybeSingle()

                if (cancelled) return

                if (fetchError) {
                    markFailed(fetchError.message || 'Erro ao carregar geração.')
                    return
                }

                if (!data) {
                    // Row not created yet; keep awaiting.
                    return
                }

                // Typed loosely because prescription_generations isn't in
                // generated types (migration 035 @ts-ignore pattern).
                const row = data as {
                    status?: string
                    output_snapshot?: PrescriptionOutputSnapshot | null
                }

                if (row.status === 'failed') {
                    markFailed('A geração falhou.')
                    return
                }

                if (row.output_snapshot) {
                    beginReveal(row.output_snapshot)
                }
            } catch (err) {
                markFailed(err instanceof Error ? err.message : 'Erro ao carregar geração.')
            }
        })()

        // 2) Realtime subscription for UPDATE/INSERT on this row.
        const channel = supabase
            .channel(`prescription_generation:${generationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'prescription_generations',
                    filter: `id=eq.${generationId}`,
                },
                (payload: { new?: Record<string, unknown> }) => {
                    const row = payload.new as {
                        status?: string
                        output_snapshot?: PrescriptionOutputSnapshot | null
                    } | undefined
                    if (!row) return
                    if (row.status === 'failed') {
                        markFailed('A geração falhou.')
                        return
                    }
                    if (row.output_snapshot) {
                        beginReveal(row.output_snapshot)
                    }
                    // Else: output_snapshot still null (e.g. status='generating'
                    // in a future iteration where we insert early). Keep
                    // awaiting; next UPDATE will carry the snapshot.
                },
            )
            .subscribe()

        return () => {
            cancelled = true
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generationId])

    // Stable reference across renders: `.slice()` would allocate a new array on
    // every render even when revealedCount is unchanged, which caused consumers
    // mirroring `workouts` into their own state to enter an update loop. React
    // Compiler can't memoize this automatically because it reads from a mutable
    // ref, so we memoize explicitly on the values that actually change output.
    const revealedWorkouts = useMemo(
        () => hydratedRef.current.slice(0, revealedCount),
        // snapshot is in deps so that when the hydrated array is replaced (new
        // generation), the memo invalidates even if revealedCount resets to 0
        // and then climbs through the same values again.
        [revealedCount, snapshot],
    )
    const reasoning = snapshot?.reasoning
        ? (snapshot.reasoning as PrescriptionReasoningExtended)
        : null

    return {
        workouts: revealedWorkouts,
        reasoning: status === 'done' ? reasoning : null,
        isStreaming: status === 'revealing',
        isDone: status === 'done',
        error,
        status,
    }
}
