import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM, type LLMModel } from '@/lib/prescription/llm-client'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'
import type { ParseTextRequest, ParseTextResponse } from './types'
import { extractJson, validateAndFixResponse } from './lib'

export const maxDuration = 30

// Hard caps to prevent cost amplification. N parallel LLM calls × 4000
// output tokens per call × GPT-4.1-mini pricing adds up fast.
const MAX_TEXT_CHARS = 12_000
const MAX_BLOCKS = 10

// Ordered model fallback. gpt-4.1-mini is primary (higher quality matching on
// Portuguese exercise names); gpt-4o-mini is the fallback for large inputs or
// when the primary model times out / is throttled. Large free-text prescriptions
// with 5+ workouts and 40+ exercises can easily exceed gpt-4.1-mini's typical
// latency; falling back keeps the feature usable instead of surfacing a timeout.
const MODEL_FALLBACKS: LLMModel[] = ['gpt-4.1-mini', 'gpt-4o-mini']

// Keep well under the route's maxDuration (30s) so we still have time to parse
// and validate the response before the Vercel serverless function is killed.
const LLM_TIMEOUT_MS = 26_000

// Split the user's text into separate per-workout blocks. Prescriptions with
// 5+ workouts are too large to parse in a single LLM call (each extra workout
// adds ~500 output tokens and blows past the 26s per-model timeout). By
// splitting and running the calls in parallel we turn the latency from
// O(total-exercises) into O(largest-workout), which keeps the whole request
// under the route's 30s budget even for very long prescriptions.
function splitWorkoutBlocks(text: string): string[] {
    const lines = text.split('\n')
    const blocks: string[] = []
    let current: string[] = []

    // A heading looks like: "Treino A", "Treino Push B (...)", "Dia 1", "Workout 1".
    // We match lines that start with those keywords (case-insensitive) and are
    // short enough to not be an exercise description.
    const headingRe = /^\s*(?:treino|dia|workout|day)\b/i

    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length > 0 && trimmed.length < 80 && headingRe.test(trimmed)) {
            if (current.length > 0) {
                const block = current.join('\n').trim()
                if (block) blocks.push(block)
            }
            current = [line]
        } else {
            current.push(line)
        }
    }
    if (current.length > 0) {
        const block = current.join('\n').trim()
        if (block) blocks.push(block)
    }

    // If we couldn't detect any heading, return the text as a single block.
    if (blocks.length === 0) return [text]
    return blocks
}

const SYSTEM_PROMPT = `Você é um parser de prescrições de treino. Sua tarefa é interpretar texto livre escrito por um personal trainer e converter em dados estruturados.

Você receberá:
1. O texto livre do treinador descrevendo um ou mais treinos
2. A lista completa de exercícios disponíveis no catálogo (id|nome)

Para cada exercício mencionado no texto:
- Identifique o nome do exercício, mesmo que escrito de forma abreviada, informal, em inglês ou com nomenclatura diferente do catálogo
- Faça o match com o exercício mais próximo do catálogo. Exemplos de matching esperado:
  - "supino inclinado halter" → "Supino Inclinado com Halteres"
  - "puxada aberta" → "Puxada Aberta Barra reta"
  - "remada serrote" → "Remada Unilateral Halteres - Pegada Neutra (Serrote)"
  - "hip thrust" → "Elevação de Quadril com Barra"
  - "extensora" → "Cadeira Extensora"
  - "leg 45" → "Leg Press 45"
  - "rosca martelo" → "Rosca Martelo com Halteres"
  - "búlgaro" → "Agachamento Búlgaro"
  - "pulldown" → "Puxada Aberta Barra reta"
  - "crucifixo" → "Crucifixo com Halteres"
  - "desenvolvimento" → "Desenvolvimento com Halteres Sentado"
  - "stiff" → "Stiff Barra Livre"
  - "flexora" → "Cadeira Flexora"
  - "mesa flexora" → "Mesa Flexora"
  - "panturrilha" → "Panturrilha no Smith"
  - "face pull" → "Face Pull"
  - "tríceps corda" → "Tríceps na Polia com Corda"
  - "tríceps testa" → "Tríceps Testa com Barra W"
  - "rosca direta" → "Rosca Direta Barra W"
  - "elevação lateral" → "Elevação Lateral com Halteres"
- Se o texto especifica equipamento (halter, barra, máquina, polia, cabo, smith), priorize o match com esse equipamento
- Se o texto especifica pegada (pronada, supinada, neutra), priorize o match com essa pegada
- Extraia séries e repetições (ex: "3x10", "4x8-12", "3x15")
- Extraia descanso se mencionado (ex: "descanso 90s", "1min rest", "90\"")
- Qualquer informação extra (cadência, técnica, "até a falha", "drop set") vai no campo notes
- Identifique separações de treinos (ex: "Treino A", "Treino B", "Treino 1", "Dia 1", "---", ou linha em branco entre blocos distintos)

Se um exercício do texto NÃO tem correspondência clara no catálogo, retorne matched: false e preserve o nome original.
Se o texto mencionar apenas o exercício sem séries/reps, use os defaults: sets: 3, reps: "10".
Se o texto não separar em treinos distintos, coloque tudo em um treino chamado "Treino A".

Retorne APENAS o JSON válido, sem markdown, sem explicação, sem code blocks.

Formato de resposta:
{
  "workouts": [
    {
      "name": "Treino A",
      "exercises": [
        {
          "matched": true,
          "exercise_id": "uuid-do-catalogo",
          "catalog_name": "Nome Exato do Catálogo",
          "original_text": "texto original do treinador",
          "sets": 3,
          "reps": "8-10",
          "rest_seconds": null,
          "notes": null
        }
      ]
    }
  ]
}`

export async function POST(req: Request) {
    try {
        // Auth — cookie-based session (web dashboard)
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Validate trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
        }

        // Rate limit per trainer — each call fans out into N parallel LLM
        // requests, so this is the cheapest defense against cost amplification.
        const rateLimitKey = `prescription:parse-text:${trainer.id}`
        const limit = checkRateLimit(rateLimitKey, { perMinute: 5, perDay: 50 })
        if (!limit.allowed) {
            return NextResponse.json({ error: limit.error || 'Rate limit exceeded' }, { status: 429 })
        }
        recordRequest(rateLimitKey)

        // Parse request
        const body: ParseTextRequest = await req.json()
        const { text, exercises } = body

        if (!text?.trim()) {
            return NextResponse.json({ error: 'text is required' }, { status: 400 })
        }
        if (text.length > MAX_TEXT_CHARS) {
            return NextResponse.json({ error: `Texto muito longo (máx ${MAX_TEXT_CHARS} caracteres).` }, { status: 400 })
        }

        if (!exercises?.length) {
            return NextResponse.json({ error: 'exercises list is required' }, { status: 400 })
        }

        // Split by workout heading. Each block is processed by its own LLM call,
        // running in parallel — that way a prescription with 5 workouts × 8
        // exercises takes ~max(per-workout-latency) instead of the sum, which
        // is what kept the single-call path timing out.
        const blocks = splitWorkoutBlocks(text).slice(0, MAX_BLOCKS)

        const exerciseIdSet = new Set(exercises.map(e => e.id))

        const parseOneBlock = async (block: string): Promise<{
            response: ParseTextResponse | null
            status: string
            usage: { input_tokens: number; output_tokens: number; cost_usd: number } | null
        }> => {
            // Pre-filter the catalog per-block: if the trainer wrote a Push workout,
            // the LLM only needs to see upper-body pushing exercises, not the full 400+.
            const filtered = filterCatalogByText(block, exercises)
            const catalogStr = filtered.map(e => `${e.id}|${e.name}`).join('\n')
            const userPrompt = `Texto do treinador:\n${block}\n\nCatálogo de exercícios disponíveis:\n${catalogStr}`

            let result: Awaited<ReturnType<typeof callLLM>> | null = null
            let status: string = 'unknown'
            for (const model of MODEL_FALLBACKS) {
                result = await callLLM({
                    model,
                    system: SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: userPrompt }],
                    max_tokens: 4000,
                    timeout_ms: LLM_TIMEOUT_MS,
                    temperature: 0.1,
                })
                status = result.status
                if (result.status === 'success' && result.data) break
                console.warn(`[parse-text] ${model} failed (${result.status}) on block, trying next model`)
                if (result.status === 'missing_api_key') break
            }

            if (!result || result.status !== 'success' || !result.data) {
                return { response: null, status, usage: null }
            }

            const parsed = extractJson(result.data)
            if (!parsed) {
                console.error('[parse-text] Failed to parse LLM response as JSON (block):', result.data.slice(0, 300))
                return { response: null, status: 'parse_error', usage: result.usage ?? null }
            }

            const validated = validateAndFixResponse(parsed, exerciseIdSet)
            return {
                response: validated,
                status: validated ? 'success' : 'invalid_structure',
                usage: result.usage ?? null,
            }
        }

        // Fire all blocks in parallel. The whole request completes when the
        // slowest block returns, so even 5 workouts finish in ~one-workout time.
        const results = await Promise.all(blocks.map(parseOneBlock))

        // Aggregate. If every block failed, surface the most common failure.
        const successful = results.filter(r => r.response?.workouts?.length)
        if (successful.length === 0) {
            const lastStatus = results[0]?.status ?? 'error'
            console.error('[parse-text] All blocks failed:', results.map(r => r.status).join(','))
            const statusCode = lastStatus === 'timeout' ? 504
                : lastStatus === 'missing_api_key' ? 500
                : 502
            const userMessage = lastStatus === 'timeout'
                ? 'A IA está demorando demais. Tente novamente ou divida o treino em blocos menores.'
                : lastStatus === 'missing_api_key'
                    ? 'Configuração de IA ausente. Contate o suporte.'
                    : 'Falha ao processar com a IA. Tente novamente em alguns instantes.'
            return NextResponse.json(
                { error: userMessage, reason: lastStatus },
                { status: statusCode }
            )
        }

        const aggregated: ParseTextResponse = {
            workouts: successful.flatMap(r => r.response!.workouts),
        }

        const totalCost = results.reduce((sum, r) => sum + (r.usage?.cost_usd ?? 0), 0)
        const totalInput = results.reduce((sum, r) => sum + (r.usage?.input_tokens ?? 0), 0)
        const totalOutput = results.reduce((sum, r) => sum + (r.usage?.output_tokens ?? 0), 0)
        console.log(`[parse-text] ${blocks.length} block(s), ${successful.length} ok, tokens: in=${totalInput} out=${totalOutput} cost=$${totalCost.toFixed(4)}`)

        return NextResponse.json(aggregated)
    } catch (err) {
        console.error('[parse-text] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ============================================================================
// Catalog pre-filter
// ============================================================================

const STOP_WORDS = new Set([
    'com', 'sem', 'para', 'treino', 'series', 'serie', 'reps', 'rep',
    'repeticoes', 'rodadas', 'descanso', 'rest', 'set', 'sets', 'ate', 'falha',
    'alternado', 'alternada', 'livre', 'pegada', 'enfasei', 'enfase', 'dia',
    'possivel', 'maquina', 'barra', 'halter', 'halteres', 'cabo', 'polia',
    'smith', 'corda', 'frente', 'tras', 'cima', 'baixo', 'completo', 'media',
    'medio', 'aberta', 'fechada', 'pronada', 'supinada', 'neutra',
])

/** Remove accents and lowercase. "Elevação" -> "elevacao". */
function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Extract content words (≥3 chars, not stop words) from user's free text. */
function extractKeywords(text: string): Set<string> {
    const tokens = normalize(text).match(/[a-z0-9]+/g) || []
    const keywords = new Set<string>()
    for (const tok of tokens) {
        if (tok.length >= 3 && !STOP_WORDS.has(tok) && !/^\d+$/.test(tok)) {
            keywords.add(tok)
        }
    }
    return keywords
}

/** Return the exercises whose name shares at least one keyword with the text. */
function filterCatalogByText<T extends { id: string; name: string }>(
    text: string,
    catalog: T[],
): T[] {
    const keywords = extractKeywords(text)
    if (keywords.size === 0) return catalog

    // Exercises that share at least one content word with the text, scored by
    // how many words they share (so "supino reto barra" ranks above a generic
    // "barra fixa" match when the user wrote "supino reto com barra").
    const scored: Array<{ ex: T; score: number }> = []
    for (const ex of catalog) {
        const nameTokens = normalize(ex.name).match(/[a-z0-9]+/g) || []
        let score = 0
        for (const tok of nameTokens) {
            if (tok.length >= 3 && keywords.has(tok)) score++
        }
        if (score > 0) scored.push({ ex, score })
    }

    scored.sort((a, b) => b.score - a.score)
    const filtered = scored.map(s => s.ex)

    // Safety nets: always cap at ~150 so the prompt stays small; fall back to
    // the full catalog if the filter returned fewer than a handful (indicates
    // the filter missed something — better to be slow than to silently skip
    // exercises the trainer referenced).
    if (filtered.length < 20) return catalog
    return filtered.slice(0, 150)
}

