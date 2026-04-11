export interface ParsedExercise {
    matched: boolean
    exercise_id: string | null
    catalog_name: string | null
    original_text: string
    sets: number
    reps: string
    rest_seconds: number | null
    notes: string | null
}

export interface ParsedWorkout {
    name: string
    exercises: ParsedExercise[]
}

export interface ParseTextResponse {
    workouts: ParsedWorkout[]
}

export interface ParseTextRequest {
    text: string
    exercises: { id: string; name: string }[]
}
