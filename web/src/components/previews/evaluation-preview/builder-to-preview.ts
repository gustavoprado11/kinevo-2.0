/**
 * Transforms builder Question[] into normalized preview data.
 * Matches the Question type from builder-client.tsx.
 */

export interface BuilderQuestion {
    id: string
    type: string
    label: string
    required?: boolean
    options?: { value: string; label: string }[]
    scale?: { min: number; max: number; min_label?: string; max_label?: string }
}

export interface PreviewQuestion {
    id: string
    type: 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'scale' | 'photo'
    label: string
    required: boolean
    options: { value: string; label: string }[]
    scaleMin: number
    scaleMax: number
}

export interface EvaluationPreviewData {
    title: string
    subtitle: string | null
    questions: PreviewQuestion[]
}

export function builderToPreview(
    title: string,
    description: string,
    questions: BuilderQuestion[],
): EvaluationPreviewData {
    return {
        title: title || 'Formulário',
        subtitle: description || null,
        questions: questions.map((q) => ({
            id: q.id,
            type: (q.type || 'short_text') as PreviewQuestion['type'],
            label: q.label || 'Pergunta',
            required: q.required ?? true,
            options: q.options || [],
            scaleMin: q.scale?.min ?? 1,
            scaleMax: q.scale?.max ?? 5,
        })),
    }
}
