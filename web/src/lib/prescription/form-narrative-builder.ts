// ============================================================================
// Form Narrative Builder — Generic form submissions → text for AI prompts
// ============================================================================
// Converts ANY submitted form into a readable narrative. Unlike questionnaire-mapper
// (which maps specific prescription questionnaire fields), this reads the
// schema_snapshot_json to understand questions and answers_json for responses.

import type { FormSubmissionSummary } from '@/actions/prescription/get-prescription-data'

// ============================================================================
// Constants
// ============================================================================

const MAX_TOTAL_CHARS = 2000

// ============================================================================
// Public API
// ============================================================================

/**
 * Converts a list of form submissions into a narrative text for AI prompts.
 * Reads questions from schema_snapshot_json and answers from answers_json.
 * Returns null if no forms or no valid answers found.
 */
export function buildFormNarratives(submissions: FormSubmissionSummary[]): string | null {
    if (!submissions || submissions.length === 0) return null

    const blocks: string[] = []

    for (const submission of submissions) {
        const block = buildSingleFormBlock(submission)
        if (block) blocks.push(block)
    }

    if (blocks.length === 0) return null

    // Truncate oldest forms if total exceeds limit (submissions are already DESC by date)
    let total = ''
    const kept: string[] = []
    for (const block of blocks) {
        if (total.length + block.length + 2 > MAX_TOTAL_CHARS && kept.length > 0) break
        kept.push(block)
        total = kept.join('\n\n')
    }

    return total || null
}

// ============================================================================
// Internals
// ============================================================================

interface SchemaQuestion {
    id: string
    type: string
    label: string
    options?: Array<{ value: string; label: string }>
    scale?: { min: number; max: number; minLabel?: string; maxLabel?: string }
}

function buildSingleFormBlock(submission: FormSubmissionSummary): string | null {
    const questions = extractQuestions(submission.schema_snapshot_json)
    const answers = submission.answers_json?.answers || submission.answers_json || {}

    if (questions.length === 0) return null

    const lines: string[] = []

    for (const q of questions) {
        const formatted = formatAnswer(q, answers[q.id])
        if (formatted === null) continue
        lines.push(`P: ${q.label}\nR: ${formatted}`)
    }

    if (lines.length === 0) return null

    const dateFormatted = formatDate(submission.submitted_at)
    const header = `=== FORMULÁRIO: ${submission.template_title} (${submission.template_category}) ===\nRespondido em: ${dateFormatted}`

    return `${header}\n\n${lines.join('\n\n')}`
}

function extractQuestions(schema: Record<string, any>): SchemaQuestion[] {
    const questions = schema?.questions
    if (!Array.isArray(questions)) return []

    return questions.filter(
        (q: any) => q && typeof q.id === 'string' && typeof q.label === 'string',
    ) as SchemaQuestion[]
}

function formatAnswer(question: SchemaQuestion, raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null

    // Direct string
    if (typeof raw === 'string') {
        const trimmed = raw.trim()
        return trimmed || null
    }

    // Direct number
    if (typeof raw === 'number') {
        return formatScaleValue(question, raw)
    }

    // Array (multi_choice values)
    if (Array.isArray(raw)) {
        const resolved = raw.map(v => resolveOptionLabel(question, v)).filter(Boolean)
        return resolved.length > 0 ? resolved.join(', ') : null
    }

    // Object with { type, value } or { type, values }
    if (typeof raw === 'object') {
        const obj = raw as Record<string, any>
        const type = obj.type as string | undefined

        // Photo type — skip
        if (type === 'photo') return null

        // Scale type
        if (type === 'scale' && obj.value != null) {
            return formatScaleValue(question, obj.value)
        }

        // Single choice with value
        if (obj.value != null) {
            if (typeof obj.value === 'string') {
                const label = resolveOptionLabel(question, obj.value)
                return label || obj.value.trim() || null
            }
            if (typeof obj.value === 'number') {
                return formatScaleValue(question, obj.value)
            }
            return String(obj.value)
        }

        // Multi choice with values array
        if (Array.isArray(obj.values)) {
            const resolved = obj.values.map((v: any) => resolveOptionLabel(question, v)).filter(Boolean)
            return resolved.length > 0 ? resolved.join(', ') : null
        }
    }

    return null
}

function resolveOptionLabel(question: SchemaQuestion, value: unknown): string {
    if (!question.options || typeof value !== 'string') return String(value)

    const match = question.options.find(o => o.value === value)
    return match?.label || value
}

function formatScaleValue(question: SchemaQuestion, value: number): string {
    const scale = question.scale
    if (scale) {
        const maxLabel = scale.maxLabel || ''
        const minLabel = scale.minLabel || ''
        // Pick the label closest to the value
        const ratio = scale.max > scale.min ? (value - scale.min) / (scale.max - scale.min) : 0
        const closestLabel = ratio >= 0.5 ? maxLabel : minLabel
        if (closestLabel) {
            return `${value}/${scale.max} (${closestLabel})`
        }
        return `${value}/${scale.max}`
    }
    return String(value)
}

function formatDate(isoDate: string): string {
    try {
        const d = new Date(isoDate)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    } catch {
        return isoDate
    }
}
