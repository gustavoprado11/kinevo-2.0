'use server'

import { createClient } from '@/lib/supabase/server'

type FormCategory = 'anamnese' | 'checkin' | 'survey'
type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'scale' | 'photo'

interface GenerateFormWithAIInput {
    category: FormCategory
    goal: string
    studentContext?: string
    maxMinutes?: number
}

interface DraftQuestion {
    id: string
    type: QuestionType
    label: string
    required: boolean
    options?: Array<{ value: string; label: string }>
    scale?: { min: number; max: number; min_label?: string; max_label?: string }
    validation?: { min_length?: number; max_length?: number }
}

interface DraftSchema {
    schema_version: string
    layout: {
        estimated_minutes: number
        progress_mode: 'per_question'
    }
    questions: DraftQuestion[]
}

interface QualityReport {
    missing_areas: string[]
    redundant_questions: string[]
    reading_complexity: 'low' | 'medium' | 'high'
    risk_flags: string[]
}

interface AIResponseContract {
    template_draft: {
        title: string
        description: string
        category: FormCategory
        estimated_minutes: number
        questions: DraftQuestion[]
    }
    quality_report: QualityReport
    coach_review_checklist: string[]
}

type LLMGenerationStatus =
    | 'llm_used'
    | 'llm_disabled'
    | 'missing_api_key'
    | 'http_error'
    | 'invalid_response'
    | 'network_error'

interface OpenAIGenerationResult {
    contract: AIResponseContract | null
    status: LLMGenerationStatus
    model: string
}

function slugify(input: string) {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 36)
}

function normalizeQuestions(questions: DraftQuestion[]): DraftQuestion[] {
    const used = new Set<string>()

    return questions
        .map((q, index) => {
            const baseId = slugify(q.id || q.label || `pergunta_${index + 1}`) || `pergunta_${index + 1}`
            let nextId = baseId
            let suffix = 2

            while (used.has(nextId)) {
                nextId = `${baseId}_${suffix}`
                suffix += 1
            }
            used.add(nextId)

            const allowedTypes: QuestionType[] = ['short_text', 'long_text', 'single_choice', 'scale', 'photo']
            const safeType: QuestionType = allowedTypes.includes(q.type) ? q.type : 'short_text'

            const normalized: DraftQuestion = {
                id: nextId,
                type: safeType,
                label: (q.label || `Pergunta ${index + 1}`).trim(),
                required: Boolean(q.required),
            }

            if (safeType === 'single_choice') {
                const options = (q.options || [])
                    .filter((opt) => opt?.value && opt?.label)
                    .slice(0, 8)

                normalized.options = options.length >= 2
                    ? options
                    : [
                        { value: 'sim', label: 'Sim' },
                        { value: 'nao', label: 'Não' },
                    ]
            }

            if (safeType === 'scale') {
                const min = Number(q.scale?.min ?? 1)
                const max = Number(q.scale?.max ?? 5)
                normalized.scale = {
                    min: Number.isFinite(min) ? Math.max(1, Math.min(min, 5)) : 1,
                    max: Number.isFinite(max) ? Math.max(1, Math.min(max, 5)) : 5,
                    min_label: q.scale?.min_label || 'Baixo',
                    max_label: q.scale?.max_label || 'Alto',
                }
                if (normalized.scale.max < normalized.scale.min) {
                    normalized.scale.max = normalized.scale.min
                }
            }

            if (safeType === 'short_text' || safeType === 'long_text') {
                normalized.validation = q.validation || {
                    max_length: safeType === 'short_text' ? 120 : 600,
                }
            }

            return normalized
        })
        .slice(0, 20)
}

function buildHeuristicDraft(input: GenerateFormWithAIInput): AIResponseContract {
    const categoryLabel: Record<FormCategory, string> = {
        anamnese: 'Anamnese',
        checkin: 'Check-in',
        survey: 'Pesquisa',
    }

    const maxMinutes = Math.max(2, Math.min(input.maxMinutes || 6, 20))

    const baseByCategory: Record<FormCategory, DraftQuestion[]> = {
        anamnese: [
            {
                id: 'objetivo_principal',
                type: 'long_text',
                label: 'Qual seu principal objetivo com o treino neste momento?',
                required: true,
            },
            {
                id: 'historico_lesoes',
                type: 'long_text',
                label: 'Você possui histórico de lesões ou limitações relevantes?',
                required: true,
            },
            {
                id: 'nivel_estresse',
                type: 'scale',
                label: 'Como você avalia seu nível de estresse atualmente?',
                required: true,
                scale: { min: 1, max: 5, min_label: 'Baixo', max_label: 'Alto' },
            },
            {
                id: 'frequencia_treino',
                type: 'single_choice',
                label: 'Quantas vezes por semana você consegue treinar com constância?',
                required: true,
                options: [
                    { value: '1_2', label: '1-2 vezes' },
                    { value: '3_4', label: '3-4 vezes' },
                    { value: '5_plus', label: '5+ vezes' },
                ],
            },
        ],
        checkin: [
            {
                id: 'energia_hoje',
                type: 'scale',
                label: 'Como está seu nível de energia hoje?',
                required: true,
                scale: { min: 1, max: 5, min_label: 'Muito baixo', max_label: 'Muito alto' },
            },
            {
                id: 'qualidade_sono',
                type: 'single_choice',
                label: 'Como foi sua qualidade de sono nas últimas 24h?',
                required: true,
                options: [
                    { value: 'ruim', label: 'Ruim' },
                    { value: 'regular', label: 'Regular' },
                    { value: 'boa', label: 'Boa' },
                ],
            },
            {
                id: 'dor_desconforto',
                type: 'long_text',
                label: 'Teve alguma dor ou desconforto relevante desde o último treino?',
                required: true,
            },
            {
                id: 'observacao_livre',
                type: 'short_text',
                label: 'Quer adicionar alguma observação rápida para seu treinador?',
                required: false,
            },
        ],
        survey: [
            {
                id: 'satisfacao_geral',
                type: 'scale',
                label: 'Quão satisfeito você está com o acompanhamento atual?',
                required: true,
                scale: { min: 1, max: 5, min_label: 'Pouco', max_label: 'Muito' },
            },
            {
                id: 'ponto_forte',
                type: 'long_text',
                label: 'Qual o principal ponto forte do acompanhamento para você?',
                required: true,
            },
            {
                id: 'ponto_melhoria',
                type: 'long_text',
                label: 'Qual ponto você gostaria de melhorar no processo?',
                required: true,
            },
            {
                id: 'recomendaria',
                type: 'single_choice',
                label: 'Você recomendaria este acompanhamento para outra pessoa?',
                required: true,
                options: [
                    { value: 'sim', label: 'Sim' },
                    { value: 'talvez', label: 'Talvez' },
                    { value: 'nao', label: 'Não' },
                ],
            },
        ],
    }

    const contextQuestion: DraftQuestion = {
        id: 'contexto_especifico',
        type: 'long_text',
        label: `Contexto adicional: ${input.goal.trim()}`,
        required: true,
    }

    const questions = normalizeQuestions([
        ...baseByCategory[input.category],
        contextQuestion,
    ])

    return {
        template_draft: {
            title: `${categoryLabel[input.category]} - ${input.goal.slice(0, 48).trim() || 'Template IA'}`,
            description: `Gerado com assistência para: ${input.goal.trim()}`,
            category: input.category,
            estimated_minutes: maxMinutes,
            questions,
        },
        quality_report: {
            missing_areas: [],
            redundant_questions: [],
            reading_complexity: 'medium',
            risk_flags: [],
        },
        coach_review_checklist: [
            'Confirme se as perguntas obrigatórias são realmente essenciais.',
            'Remova termos ambíguos e simplifique linguagem quando possível.',
            'Verifique se o tempo estimado está adequado para o aluno.',
        ],
    }
}

function resolveOpenAIModel() {
    return process.env.OPENAI_FORMS_MODEL?.trim() || 'gpt-4o-mini'
}

function resolveLLMEnabled() {
    const raw = process.env.FORMS_AI_LLM_ENABLED
    if (!raw) return true
    return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

function resolveOpenAITimeoutMs() {
    const raw = Number(process.env.OPENAI_FORMS_TIMEOUT_MS || 12000)
    if (!Number.isFinite(raw)) return 12000
    return Math.max(3000, Math.min(Math.round(raw), 30000))
}

function runtimeNoteFromStatus(status: LLMGenerationStatus) {
    if (status === 'llm_disabled') return 'LLM desativado por configuração. Draft gerado em modo heurístico.'
    if (status === 'missing_api_key') return 'OPENAI_API_KEY ausente. Draft gerado em modo heurístico.'
    if (status === 'http_error') return 'OpenAI indisponível no momento. Draft gerado em modo heurístico.'
    if (status === 'invalid_response') return 'OpenAI retornou formato inválido. Draft gerado em modo heurístico.'
    if (status === 'network_error') return 'Falha de rede com OpenAI. Draft gerado em modo heurístico.'
    return null
}

async function tryOpenAIGeneration(input: GenerateFormWithAIInput): Promise<OpenAIGenerationResult> {
    const model = resolveOpenAIModel()
    const llmEnabled = resolveLLMEnabled()
    if (!llmEnabled) {
        return { contract: null, status: 'llm_disabled', model }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        return { contract: null, status: 'missing_api_key', model }
    }

    const system = [
        'Você gera apenas JSON válido para formulários de fitness coaching.',
        'IMPORTANTE: Gere TODAS as perguntas, títulos, descrições, opções de resposta, labels de escala e sugestões de revisão em PORTUGUÊS BRASILEIRO. Nunca gere conteúdo em inglês.',
        'Não inclua diagnóstico clínico ou prescrição médica.',
        'Use apenas tipos permitidos: short_text, long_text, single_choice, scale, photo.',
        'O campo coach_review_checklist deve conter sugestões práticas de revisão em português.',
        'Retorne estritamente o contrato: template_draft, quality_report, coach_review_checklist.',
    ].join(' ')

    const userPrompt = JSON.stringify({
        category: input.category,
        goal: input.goal,
        student_context: input.studentContext || '',
        max_minutes: input.maxMinutes || 6,
        output_contract: {
            template_draft: {
                title: 'string',
                description: 'string',
                category: 'anamnese|checkin|survey',
                estimated_minutes: 'number',
                questions: [
                    {
                        id: 'string',
                        type: 'short_text|long_text|single_choice|scale|photo',
                        label: 'string',
                        required: 'boolean',
                    },
                ],
            },
            quality_report: {
                missing_areas: ['string'],
                redundant_questions: ['string'],
                reading_complexity: 'low|medium|high',
                risk_flags: ['string'],
            },
            coach_review_checklist: ['string'],
        },
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), resolveOpenAITimeoutMs())

    let response: Response
    try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: userPrompt },
                ],
            }),
        })
    } catch {
        clearTimeout(timeout)
        return { contract: null, status: 'network_error', model }
    }
    clearTimeout(timeout)

    if (!response.ok) {
        return { contract: null, status: 'http_error', model }
    }

    const payload = await response.json() as any
    const content = payload?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
        return { contract: null, status: 'invalid_response', model }
    }

    try {
        const parsed = JSON.parse(content) as AIResponseContract
        return { contract: parsed, status: 'llm_used', model }
    } catch {
        return { contract: null, status: 'invalid_response', model }
    }
}

function postProcessContract(raw: AIResponseContract, fallbackInput: GenerateFormWithAIInput): AIResponseContract {
    const safeCategory: FormCategory = ['anamnese', 'checkin', 'survey'].includes(raw?.template_draft?.category)
        ? raw.template_draft.category
        : fallbackInput.category

    const safeQuestions = normalizeQuestions(raw?.template_draft?.questions || [])
    const fallback = buildHeuristicDraft(fallbackInput)

    return {
        template_draft: {
            title: (raw?.template_draft?.title || fallback.template_draft.title).trim().slice(0, 120),
            description: (raw?.template_draft?.description || fallback.template_draft.description).trim().slice(0, 600),
            category: safeCategory,
            estimated_minutes: Math.max(2, Math.min(Number(raw?.template_draft?.estimated_minutes || fallback.template_draft.estimated_minutes), 20)),
            questions: safeQuestions.length > 0 ? safeQuestions : fallback.template_draft.questions,
        },
        quality_report: {
            missing_areas: Array.isArray(raw?.quality_report?.missing_areas) ? raw.quality_report.missing_areas.slice(0, 6) : [],
            redundant_questions: Array.isArray(raw?.quality_report?.redundant_questions) ? raw.quality_report.redundant_questions.slice(0, 6) : [],
            reading_complexity: ['low', 'medium', 'high'].includes(raw?.quality_report?.reading_complexity)
                ? raw.quality_report.reading_complexity
                : 'medium',
            risk_flags: Array.isArray(raw?.quality_report?.risk_flags) ? raw.quality_report.risk_flags.slice(0, 6) : [],
        },
        coach_review_checklist: Array.isArray(raw?.coach_review_checklist) && raw.coach_review_checklist.length > 0
            ? raw.coach_review_checklist.slice(0, 8)
            : fallback.coach_review_checklist,
    }
}

export async function generateFormDraftWithAI(input: GenerateFormWithAIInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado.' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado.' }

    const goal = input.goal?.trim()
    if (!goal) return { success: false, error: 'Defina o objetivo do formulário.' }

    const safeCategory = input.category
    if (!['anamnese', 'checkin', 'survey'].includes(safeCategory)) {
        return { success: false, error: 'Categoria inválida.' }
    }

    const baseInput: GenerateFormWithAIInput = {
        category: safeCategory,
        goal,
        studentContext: input.studentContext?.trim() || '',
        maxMinutes: Math.max(2, Math.min(input.maxMinutes || 6, 20)),
    }

    const fallbackDraft = buildHeuristicDraft(baseInput)
    const llmResult = await tryOpenAIGeneration(baseInput)
    const llmDraft = llmResult.contract
    const finalDraft = llmDraft ? postProcessContract(llmDraft, baseInput) : fallbackDraft
    const runtimeNote = runtimeNoteFromStatus(llmResult.status)

    if (llmResult.status !== 'llm_used') {
        console.warn('[generateFormDraftWithAI] fallback_to_heuristic', {
            status: llmResult.status,
            model: llmResult.model,
        })
    }

    const schema: DraftSchema = {
        schema_version: '1.0',
        layout: {
            estimated_minutes: finalDraft.template_draft.estimated_minutes,
            progress_mode: 'per_question',
        },
        questions: finalDraft.template_draft.questions,
    }

    return {
        success: true,
        source: llmDraft ? 'llm' : 'heuristic',
        llmStatus: llmResult.status,
        llmModel: null,
        runtimeNote,
        templateDraft: {
            title: finalDraft.template_draft.title,
            description: finalDraft.template_draft.description,
            category: finalDraft.template_draft.category,
            schema,
        },
        qualityReport: finalDraft.quality_report,
        reviewChecklist: finalDraft.coach_review_checklist,
    }
}
