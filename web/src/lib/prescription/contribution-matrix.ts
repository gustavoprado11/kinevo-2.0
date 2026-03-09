// ============================================================================
// Kinevo Prescription Engine — Muscle Contribution Matrix
// ============================================================================
// Single source of truth for secondary muscle group activation from compound
// exercises. Replaces BUILDER_SECONDARY_MAP (program-builder) and
// SECONDARY_MUSCLE_GROUPS (rules-engine) with calibrated biomechanical weights.
//
// Two resolution levels:
// 1. PATTERN_CONTRIBUTIONS — movement_pattern-specific (preferred when available)
// 2. GROUP_CONTRIBUTIONS — group-level fallback

// ============================================================================
// Group-Level Contributions (fallback when no movement_pattern data)
// ============================================================================

export const GROUP_CONTRIBUTIONS: Record<string, Array<{ group: string; weight: number }>> = {
    'Quadríceps':        [{ group: 'Glúteo', weight: 0.35 }, { group: 'Posterior de Coxa', weight: 0.15 }],
    'Posterior de Coxa': [{ group: 'Glúteo', weight: 0.40 }],
    'Glúteo':            [{ group: 'Posterior de Coxa', weight: 0.25 }],
    'Peito':             [{ group: 'Ombros', weight: 0.40 }, { group: 'Tríceps', weight: 0.40 }],
    'Costas':            [{ group: 'Bíceps', weight: 0.40 }],
    'Ombros':            [{ group: 'Tríceps', weight: 0.30 }],
}

// ============================================================================
// Pattern-Level Contributions (movement_pattern → secondaries)
// ============================================================================

export const PATTERN_CONTRIBUTIONS: Record<string, Array<{ group: string; weight: number }>> = {
    'squat':           [{ group: 'Glúteo', weight: 0.35 }, { group: 'Posterior de Coxa', weight: 0.15 }],
    'lunge':           [{ group: 'Glúteo', weight: 0.50 }],
    'hinge':           [{ group: 'Glúteo', weight: 0.40 }, { group: 'Quadríceps', weight: 0.10 }],
    'push_horizontal': [{ group: 'Tríceps', weight: 0.40 }, { group: 'Ombros', weight: 0.30 }],
    'push_vertical':   [{ group: 'Tríceps', weight: 0.35 }],
    'pull_horizontal': [{ group: 'Bíceps', weight: 0.35 }, { group: 'Trapézio', weight: 0.20 }],
    'pull_vertical':   [{ group: 'Bíceps', weight: 0.40 }],
}

// ============================================================================
// Resolution Function
// ============================================================================

/**
 * Resolves secondary muscle contributions for a specific exercise.
 * Pattern-level takes priority over group-level when the exercise has
 * a known movement_pattern. Returns empty array for non-compound exercises.
 */
export function getContributions(
    primaryGroup: string,
    movementPattern: string | null,
    isCompound: boolean,
): Array<{ group: string; weight: number }> {
    if (!isCompound) return []

    // Prefer pattern-level when available
    if (movementPattern && PATTERN_CONTRIBUTIONS[movementPattern]) {
        return PATTERN_CONTRIBUTIONS[movementPattern]
    }

    // Fallback to group-level
    return GROUP_CONTRIBUTIONS[primaryGroup] || []
}
