/**
 * Maps system template keys to their field IDs for body metrics extraction.
 * Used to pull weight/body fat from form_submissions.answers_json.
 */
export const BODY_METRIC_FIELD_MAP: Record<string, { weight: string; bodyFat: string }> = {
    initial_assessment: {
        weight: 'weight_kg',
        bodyFat: 'body_fat_percentage',
    },
    periodic_reassessment: {
        weight: 'ra1',
        bodyFat: 'ra2',
    },
}

export const SUPPORTED_METRIC_SYSTEM_KEYS = Object.keys(BODY_METRIC_FIELD_MAP)
