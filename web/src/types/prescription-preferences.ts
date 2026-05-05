export type DefaultView = 'preview' | 'compare' | 'normal' | 'ai_prescribe'

export type LoadMethod = 'kg' | 'percent_1rm' | 'rir' | 'rpe'
export type VisibleField = 'sets' | 'reps' | 'load' | 'rest' | 'tempo' | 'rir' | 'rpe'
export type AddExerciseMode = 'simplified' | 'set_editor'
export type NamingConvention = 'letter' | 'free'
export type AiFocus = 'hypertrophy' | 'strength' | 'conditioning' | 'mixed'
export type AiVariation = 'conservative' | 'moderate' | 'varied'

export interface PrescriptionPreferences {
    wizard_completed: boolean
    wizard_dismissed: boolean
    visualization: {
        default_view: DefaultView
        library_open_on_enter: boolean
    }
    set_defaults: {
        sets: string
        reps: string
        rest_compound_seconds: number
        rest_isolation_seconds: number
        tempo: string | null
        load_method: LoadMethod
        visible_fields: VisibleField[]
    }
    add_exercise: {
        open_mode: AddExerciseMode
        auto_warmup: boolean
    }
    quick_blocks: {
        warmup_template: string | null
        aerobic_template: string | null
        note_template: string | null
    }
    program_structure: {
        default_weeks: number
        default_workout_count: number
        naming_convention: NamingConvention
    }
    ai: {
        focus: AiFocus
        variation: AiVariation
    }
}

export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Array<infer U>
        ? Array<U>
        : T[K] extends object
            ? DeepPartial<T[K]>
            : T[K]
}

export const KINEVO_DEFAULT_PREFERENCES: PrescriptionPreferences = {
    wizard_completed: false,
    wizard_dismissed: false,
    visualization: {
        default_view: 'preview',
        library_open_on_enter: true,
    },
    set_defaults: {
        sets: '3-4',
        reps: '8-12',
        rest_compound_seconds: 90,
        rest_isolation_seconds: 60,
        tempo: null,
        load_method: 'kg',
        visible_fields: ['sets', 'reps', 'load', 'rest'],
    },
    add_exercise: {
        open_mode: 'simplified',
        auto_warmup: false,
    },
    quick_blocks: {
        warmup_template: null,
        aerobic_template: null,
        note_template: null,
    },
    program_structure: {
        default_weeks: 4,
        default_workout_count: 3,
        naming_convention: 'letter',
    },
    ai: {
        focus: 'hypertrophy',
        variation: 'moderate',
    },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype
    )
}

/**
 * Deep-merge a partial patch into a full PrescriptionPreferences object.
 * Arrays are replaced (not concatenated). Nested objects merge recursively.
 * Used by server actions and the Zustand store to apply optimistic updates.
 */
export function mergePreferences(
    current: PrescriptionPreferences,
    patch: DeepPartial<PrescriptionPreferences>,
): PrescriptionPreferences {
    return deepMerge(current, patch) as PrescriptionPreferences
}

function deepMerge<T>(target: T, patch: unknown): T {
    if (!isPlainObject(patch)) return target
    if (!isPlainObject(target)) return patch as T

    const result: Record<string, unknown> = { ...target }
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        const currentValue = result[key]
        if (isPlainObject(value) && isPlainObject(currentValue)) {
            result[key] = deepMerge(currentValue, value)
        } else {
            result[key] = value
        }
    }
    return result as T
}
