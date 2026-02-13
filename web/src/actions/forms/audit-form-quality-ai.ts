'use server'

import { createClient } from '@/lib/supabase/server'

type ReadingComplexity = 'low' | 'medium' | 'high'

interface AuditFormQualityInput {
    schemaJson: string
}

interface AuditResult {
    missing_areas: string[]
    redundant_questions: string[]
    reading_complexity: ReadingComplexity
    risk_flags: string[]
    coach_review_checklist: string[]
}

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

function estimateReadingComplexity(labels: string[]): ReadingComplexity {
    const avgLength = labels.length > 0
        ? labels.reduce((acc, text) => acc + text.length, 0) / labels.length
        : 0

    if (avgLength <= 55) return 'low'
    if (avgLength <= 90) return 'medium'
    return 'high'
}

export async function auditFormQualityWithAI(input: AuditFormQualityInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado.' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado.' }

    let parsed: any
    try {
        parsed = JSON.parse(input.schemaJson)
    } catch {
        return { success: false, error: 'Schema JSON inválido.' }
    }

    const questions = Array.isArray(parsed?.questions) ? parsed.questions : []
    if (questions.length === 0) {
        return { success: false, error: 'Schema sem perguntas para auditar.' }
    }

    const labels = questions
        .map((q: any) => String(q?.label || '').trim())
        .filter(Boolean)

    const seen = new Map<string, string[]>()
    for (const q of questions) {
        const id = String(q?.id || '')
        const label = String(q?.label || '')
        const key = normalizeText(label)
        if (!key) continue
        const arr = seen.get(key) || []
        arr.push(id || label)
        seen.set(key, arr)
    }

    const redundantQuestions = Array.from(seen.entries())
        .filter(([, ids]) => ids.length > 1)
        .map(([label]) => label)
        .slice(0, 8)

    const missingAreas: string[] = []
    const riskFlags: string[] = []

    const hasScale = questions.some((q: any) => q?.type === 'scale')
    const hasFreeText = questions.some((q: any) => q?.type === 'long_text' || q?.type === 'short_text')
    const requiredCount = questions.filter((q: any) => Boolean(q?.required)).length

    if (!hasScale) missingAreas.push('Adicionar pelo menos uma pergunta de escala para comparação longitudinal.')
    if (!hasFreeText) missingAreas.push('Adicionar uma pergunta aberta para contexto qualitativo.')
    if (requiredCount === questions.length && questions.length >= 4) {
        riskFlags.push('Muitas perguntas obrigatórias podem reduzir taxa de conclusão.')
    }

    if (questions.length > 12) {
        riskFlags.push('Formulário longo; considere reduzir para melhorar adesão.')
    }

    const complexity = estimateReadingComplexity(labels)
    if (complexity === 'high') {
        riskFlags.push('Linguagem possivelmente complexa para mobile; simplificar frases.')
    }

    const result: AuditResult = {
        missing_areas: missingAreas,
        redundant_questions: redundantQuestions,
        reading_complexity: complexity,
        risk_flags: riskFlags,
        coach_review_checklist: [
            'As perguntas obrigatórias são essenciais?',
            'Existe alguma pergunta duplicada ou muito parecida?',
            'A linguagem está clara para leitura rápida no celular?',
        ],
    }

    return {
        success: true,
        source: 'heuristic',
        audit: result,
    }
}
