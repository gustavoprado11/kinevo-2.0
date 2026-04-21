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

/** Validate response structure and fix hallucinated exercise IDs */
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
        for (const ex of workout.exercises) {
            if (ex.matched && ex.exercise_id && !exerciseIds.has(ex.exercise_id)) {
                ex.matched = false
                ex.exercise_id = null
                ex.catalog_name = null
            }
        }
    }

    return response
}
