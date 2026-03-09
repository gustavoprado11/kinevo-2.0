// ============================================================================
// Kinevo Prescription Engine — Slot Templates
// ============================================================================
// Defines workout slot templates for the slot-based builder (Tier 2 Phase B).
// Each slot specifies a movement pattern, target muscle group, and volume range.
// The builder fills slots in priority order using scored exercise candidates.

// ============================================================================
// Types
// ============================================================================

export interface WorkoutSlot {
    /** Required movement pattern(s) — matched against exercise.movement_pattern */
    movement_pattern: string | string[]
    /** Primary muscle group for volume attribution */
    target_group: string
    /** Exercise function in the workout */
    function: 'main' | 'accessory'
    /** Minimum sets for this slot */
    min_sets: number
    /** Maximum sets for this slot */
    max_sets: number
    /** Fill order — lower = filled earlier (main slots first) */
    priority: number
    /** Can be skipped if no candidates match or session limit reached */
    optional: boolean
    /** Prefer compound exercises for this slot */
    prefer_compound: boolean
}

/** Movement pattern → movement_pattern_family fallback mapping */
export const PATTERN_TO_FAMILY: Record<string, string> = {
    squat: 'knee_dominant',
    lunge: 'knee_dominant',
    hinge: 'hip_dominant',
    push_horizontal: 'horizontal_push',
    push_vertical: 'vertical_push',
    pull_horizontal: 'horizontal_pull',
    pull_vertical: 'vertical_pull',
    isolation: 'isolation_upper', // Will also try isolation_lower
}

// ============================================================================
// Slot Templates by Workout Type
// ============================================================================

const PUSH_SLOTS: WorkoutSlot[] = [
    { movement_pattern: 'push_horizontal', target_group: 'Peito', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'push_vertical', target_group: 'Ombros', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: ['push_horizontal', 'isolation'], target_group: 'Peito', function: 'accessory', min_sets: 2, max_sets: 3, priority: 3, optional: false, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Ombros', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Tríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Tríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

const PULL_SLOTS: WorkoutSlot[] = [
    { movement_pattern: 'pull_vertical', target_group: 'Costas', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'pull_horizontal', target_group: 'Costas', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: ['pull_horizontal', 'pull_vertical'], target_group: 'Costas', function: 'accessory', min_sets: 2, max_sets: 3, priority: 3, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Bíceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Trapézio', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
]

const LEGS_A_SLOTS: WorkoutSlot[] = [
    { movement_pattern: 'squat', target_group: 'Quadríceps', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'lunge', target_group: 'Quadríceps', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: 'hinge', target_group: 'Posterior de Coxa', function: 'main', min_sets: 3, max_sets: 4, priority: 3, optional: false, prefer_compound: true },
    { movement_pattern: 'isolation', target_group: 'Quadríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Glúteo', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Panturrilha', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

const LEGS_B_SLOTS: WorkoutSlot[] = [
    { movement_pattern: 'hinge', target_group: 'Posterior de Coxa', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'squat', target_group: 'Quadríceps', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: 'lunge', target_group: 'Quadríceps', function: 'main', min_sets: 3, max_sets: 4, priority: 3, optional: true, prefer_compound: true },
    { movement_pattern: 'isolation', target_group: 'Posterior de Coxa', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Glúteo', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Panturrilha', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

const UPPER_SLOTS: WorkoutSlot[] = [
    { movement_pattern: 'push_horizontal', target_group: 'Peito', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'pull_horizontal', target_group: 'Costas', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: 'push_vertical', target_group: 'Ombros', function: 'main', min_sets: 3, max_sets: 4, priority: 3, optional: false, prefer_compound: true },
    { movement_pattern: 'pull_vertical', target_group: 'Costas', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Bíceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Tríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

const FULL_BODY_A_SLOTS: WorkoutSlot[] = [
    { movement_pattern: ['squat', 'lunge'], target_group: 'Quadríceps', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'push_horizontal', target_group: 'Peito', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: ['pull_horizontal', 'pull_vertical'], target_group: 'Costas', function: 'main', min_sets: 3, max_sets: 4, priority: 3, optional: false, prefer_compound: true },
    { movement_pattern: 'hinge', target_group: 'Posterior de Coxa', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: true },
    { movement_pattern: 'push_vertical', target_group: 'Ombros', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: true },
    { movement_pattern: 'isolation', target_group: 'Bíceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

const FULL_BODY_B_SLOTS: WorkoutSlot[] = [
    { movement_pattern: 'hinge', target_group: 'Posterior de Coxa', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'push_horizontal', target_group: 'Peito', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: ['pull_horizontal', 'pull_vertical'], target_group: 'Costas', function: 'main', min_sets: 3, max_sets: 4, priority: 3, optional: false, prefer_compound: true },
    { movement_pattern: ['squat', 'lunge'], target_group: 'Glúteo', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: true },
    { movement_pattern: 'isolation', target_group: 'Abdominais', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Tríceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

const FULL_BODY_C_SLOTS: WorkoutSlot[] = [
    { movement_pattern: ['squat', 'lunge'], target_group: 'Quadríceps', function: 'main', min_sets: 3, max_sets: 4, priority: 1, optional: false, prefer_compound: true },
    { movement_pattern: 'push_vertical', target_group: 'Ombros', function: 'main', min_sets: 3, max_sets: 4, priority: 2, optional: false, prefer_compound: true },
    { movement_pattern: ['pull_horizontal', 'pull_vertical'], target_group: 'Costas', function: 'main', min_sets: 3, max_sets: 4, priority: 3, optional: false, prefer_compound: true },
    { movement_pattern: 'hinge', target_group: 'Glúteo', function: 'accessory', min_sets: 2, max_sets: 3, priority: 4, optional: true, prefer_compound: true },
    { movement_pattern: 'isolation', target_group: 'Bíceps', function: 'accessory', min_sets: 2, max_sets: 3, priority: 5, optional: true, prefer_compound: false },
    { movement_pattern: 'isolation', target_group: 'Panturrilha', function: 'accessory', min_sets: 2, max_sets: 3, priority: 6, optional: true, prefer_compound: false },
]

// ============================================================================
// Slot Template Mapping — split_type → workout_label → slots
// ============================================================================

export const SLOT_TEMPLATES: Record<string, Record<string, WorkoutSlot[]>> = {
    full_body: {
        'Full Body A': FULL_BODY_A_SLOTS,
        'Full Body B': FULL_BODY_B_SLOTS,
        'Full Body C': FULL_BODY_C_SLOTS,
    },
    upper_lower: {
        'Upper A': UPPER_SLOTS,
        'Lower A': LEGS_A_SLOTS,
        'Upper B': UPPER_SLOTS,
        'Lower B': LEGS_B_SLOTS,
    },
    ppl_plus: {
        'Push': PUSH_SLOTS,
        'Pull': PULL_SLOTS,
        'Legs A': LEGS_A_SLOTS,
        'Upper': UPPER_SLOTS,
        'Legs B': LEGS_B_SLOTS,
    },
    ppl_complete: {
        'Push A': PUSH_SLOTS,
        'Pull A': PULL_SLOTS,
        'Legs A': LEGS_A_SLOTS,
        'Push B': PUSH_SLOTS,
        'Pull B': PULL_SLOTS,
        'Legs B': LEGS_B_SLOTS,
    },
}

/** Get slot template labels for a split type (ordered) */
export function getSlotLabels(splitType: string): string[] {
    const templates = SLOT_TEMPLATES[splitType]
    if (!templates) return []
    return Object.keys(templates)
}

/** Check if a movement pattern matches a slot's pattern requirement */
export function matchesSlotPattern(
    exercisePattern: string | null,
    exerciseFamily: string | null,
    slotPattern: string | string[],
): boolean {
    const patterns = Array.isArray(slotPattern) ? slotPattern : [slotPattern]

    for (const required of patterns) {
        // Exact match on movement_pattern
        if (exercisePattern === required) return true

        // Family fallback: if exercise has a family, check if it maps to the required pattern
        if (exerciseFamily) {
            const requiredFamily = PATTERN_TO_FAMILY[required]
            if (requiredFamily && exerciseFamily === requiredFamily) return true
            // Also check isolation_lower for lower body isolation slots
            if (required === 'isolation' && (exerciseFamily === 'isolation_upper' || exerciseFamily === 'isolation_lower')) return true
        }

        // If exercise has no pattern data, match 'isolation' slots for non-compound exercises
        if (!exercisePattern && required === 'isolation') return true
    }

    return false
}
