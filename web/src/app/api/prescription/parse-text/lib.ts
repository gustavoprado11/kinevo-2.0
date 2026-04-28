import type { ParseTextResponse } from './types'

/** Extract JSON from LLM response text — handles markdown code blocks and raw JSON */
export function extractJson(text: string): unknown | null {
    // Try markdown code block first
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim()

    try {
        return JSON.parse(jsonStr)
    } catch {
        // Try to find raw JSON object in text
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

const VALID_METHODS = new Set([
    'standard', 'custom',
    'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster',
])

const VALID_SET_TYPES = new Set([
    'warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap',
])

/** Validate response structure and fix hallucinated exercise IDs.
 *  Fase 5: also coerces method_key, rounds, set_scheme and enforces aggregate
 *  coherence (sets / reps / rest_seconds reflect the scheme when present). */
export function validateAndFixResponse(
    parsed: unknown,
    exerciseIds: Set<string>
): ParseTextResponse | null {
    const response = parsed as ParseTextResponse
    if (!response?.workouts || !Array.isArray(response.workouts)) {
        return null
    }

    for (const workout of response.workouts) {
        if (!Array.isArray(workout.exercises)) continue
        for (const ex of workout.exercises as unknown as Array<Record<string, unknown> & {
            matched: boolean
            exercise_id: string | null
            catalog_name: string | null
            sets: number
            reps: string
            rest_seconds: number | null
            method_key?: string | null
            rounds?: number | null
            set_scheme?: Array<Record<string, unknown>> | null
        }>) {
            if (ex.matched && ex.exercise_id && !exerciseIds.has(ex.exercise_id)) {
                ex.matched = false
                ex.exercise_id = null
                ex.catalog_name = null
            }

            // method_key: enum check, default null
            if (ex.method_key != null && !VALID_METHODS.has(ex.method_key)) {
                ex.method_key = null
            }
            if (ex.method_key === undefined) ex.method_key = null

            // rounds: must be a positive integer in [1,20] or null
            if (ex.rounds != null) {
                if (typeof ex.rounds !== 'number' || !Number.isFinite(ex.rounds) || ex.rounds < 1 || ex.rounds > 20) {
                    ex.rounds = 1
                } else {
                    ex.rounds = Math.floor(ex.rounds)
                }
            }
            if (ex.rounds === undefined) ex.rounds = null

            // set_scheme: array of phase objects or null
            if (ex.set_scheme != null) {
                if (!Array.isArray(ex.set_scheme) || ex.set_scheme.length === 0) {
                    ex.set_scheme = null
                    ex.method_key = null
                    ex.rounds = null
                } else {
                    let valid = true
                    for (let i = 0; i < ex.set_scheme.length; i++) {
                        const phase = ex.set_scheme[i] as Record<string, unknown>
                        if (typeof phase !== 'object' || phase === null) {
                            valid = false
                            break
                        }
                        // set_number sequencial 1..N
                        phase.set_number = i + 1
                        // set_type no enum, default normal
                        if (typeof phase.set_type !== 'string' || !VALID_SET_TYPES.has(phase.set_type as string)) {
                            phase.set_type = 'normal'
                        }
                        // reps obrigatório
                        if (typeof phase.reps !== 'string' || !phase.reps) {
                            phase.reps = '10'
                        }
                        // rest_seconds default 0
                        if (typeof phase.rest_seconds !== 'number' || !Number.isFinite(phase.rest_seconds) || phase.rest_seconds < 0) {
                            phase.rest_seconds = 0
                        }
                        // optional fields → coerce to null when missing/invalid
                        if (phase.weight_target_kg === undefined) phase.weight_target_kg = null
                        if (phase.weight_target_pct1rm === undefined) phase.weight_target_pct1rm = null
                        if (phase.rir === undefined) phase.rir = null
                        if (phase.tempo === undefined) phase.tempo = null
                        if (phase.notes === undefined) phase.notes = null
                    }
                    if (!valid) {
                        ex.set_scheme = null
                        ex.method_key = null
                        ex.rounds = null
                    }
                }
            }
            if (ex.set_scheme === undefined) ex.set_scheme = null

            // Coerência: se set_scheme está preenchido, ajusta agregados.
            if (ex.set_scheme && ex.set_scheme.length > 0) {
                const rounds = (ex.rounds ?? 1) as number
                ex.rounds = rounds
                ex.sets = ex.set_scheme.length * rounds
                ex.reps = ex.set_scheme.map((p) => String(p.reps ?? '10')).join('-')
                const firstRest = ex.set_scheme[0].rest_seconds
                ex.rest_seconds = typeof firstRest === 'number' ? firstRest : ex.rest_seconds
            }
        }
    }

    return response
}
