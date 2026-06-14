import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM, type LLMModel } from '@/lib/prescription/llm-client'
import { consumeRateLimit } from '@/lib/rate-limit'
import type { ParseTextRequest, ParseTextResponse } from './types'
import { extractJson, validateAndFixResponse, splitWorkoutBlocks, filterCatalogByText } from './lib'

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
  - "banco flexor" / "banco flexora" → "Cadeira Flexora"
  - "banco extensor" / "banco extensora" → "Cadeira Extensora"
  - "cadeira flexor" → "Cadeira Flexora"
  - "cadeira extensor" → "Cadeira Extensora"
  - "mesa flexor" → "Mesa Flexora"
  - "mesa extensor" → "Mesa Extensora"
  - "supino articulado" → "Supino Reto Articulado" (ou variante mais próxima do catálogo)
  - "rosca direta banco inclinado" → "Rosca Direta com Halteres no Banco Inclinado"
  - "tríceps francês polia" → "Tríceps Francês na Polia"
  - "panturrilha em pé" → "Panturrilha em Pé no Smith" (ou similar)
  - "puxada neutra" → "Puxada Pegada Neutra"
  - "remada aberta articulada" → "Remada Articulada Pegada Aberta"
- Em academias brasileiras, "banco" + flexor/extensor é gíria regional para os aparelhos guiados de bíceps femoral / quadríceps. Trate "banco flexor", "banco extensor", "cadeira flexor", "mesa flexor" e variações como sinônimos do exercício do catálogo correspondente.
- Se o texto especifica equipamento (halter, barra, máquina, polia, cabo, smith), priorize o match com esse equipamento
- Se o texto especifica pegada (pronada, supinada, neutra), priorize o match com essa pegada
- Extraia séries e repetições (ex: "3x10", "4x8-12", "3x15")
- Extraia descanso se mencionado (ex: "descanso 90s", "1min rest", "90\"")
- Qualquer informação extra (cadência, "até a falha") que NÃO seja método avançado já reconhecido vai no campo notes
- Identifique separações de treinos (ex: "Treino A", "Treino B", "Treino 1", "Dia 1", "---", ou linha em branco entre blocos distintos)

MÉTODOS AVANÇADOS DE PRESCRIÇÃO:

Quando o texto descrever séries com reps/cargas/descansos diferentes entre si,
ou usar termos de métodos específicos, identifique o método e preencha os
campos \`method_key\`, \`set_scheme\` e \`rounds\`. Cada item do \`set_scheme\` é
uma "fase" descrevendo UMA rondada (não multiplique pelas rondas).

Padrões a reconhecer:

PIRÂMIDE DECRESCENTE (method_key: "pyramid_down", rounds: 1):
- "pirâmide 12-10-8-6" → 4 fases decrescentes
- "decrescente 10/8/6" → 3 fases
- "10 a 6 reps" com indicação de pirâmide
- Cada fase: set_type "normal", reps escalando pra baixo

PIRÂMIDE CRESCENTE (method_key: "pyramid_up", rounds: 1):
- "pirâmide crescente 6-8-10-12" → 4 fases crescentes
- "6 a 12 reps em pirâmide"
- Cada fase: set_type "normal", reps escalando pra cima

DROP-SET (method_key: "drop_set", rounds >= 1):
- "drop-set 3 rondas 10/8/6 com -20%" → rounds=3, scheme=[normal/drop/drop]
- "10 reps + drop 8 + drop 6" → rounds=1, scheme=[normal/drop/drop]
- "drop-set 2 rondas 12-8" → rounds=2, scheme=[normal 12, drop 8]
- 1ª fase set_type "normal", demais "drop". Rest curto (0-15s) entre drops,
  rest da ÚLTIMA fase = descanso entre rondas (60-120s).

TOP + BACKOFF (method_key: "top_backoff", rounds: 1):
- "1x5 top + 3x8 a 80%" → scheme=[top 5, backoff 8, backoff 8, backoff 8]
- "top set 5RM, depois 3 backoff a 75%" → similar
- 1ª fase set_type "top" reps mais baixas, demais "backoff". Use weight_target_pct1rm
  no scheme quando o texto explicitar percentual (75-85% típico).

5x5 (method_key: "5x5", rounds: 1):
- "5x5" → 5 fases iguais de 5 reps, set_type "normal"
- "5 séries de 5 reps" → idem

CLUSTER / REST-PAUSE (method_key: "cluster", rounds >= 1):
- "cluster 3 rondas 8+4+2" → rounds=3, scheme com 3 fases (8, 4, 2)
- "rest-pause 8+4+2" → rounds=1, scheme=[fases com reps "8","4","2"]
- "10 reps com mini-pausas" → cluster com fases set_type "cluster"
- set_type "cluster" em todas as fases. Rest curto (15-20s) entre fases dentro
  de uma rondada.

REGRAS DE COERÊNCIA:
- Quando \`set_scheme\` for preenchido: \`sets\` = total de fases × rounds,
  \`reps\` agregado = resumo do scheme (ex: "12-10-8-6"), \`rest_seconds\` agregado
  = rest da PRIMEIRA fase.
- \`method_key\` deve ser EXATAMENTE um destes (ou null): "pyramid_down",
  "pyramid_up", "drop_set", "top_backoff", "5x5", "cluster". Sem espaços, com
  underscore. Texto livre como "drop set" → use "drop_set".
- \`rounds\` >= 1, default 1 quando linear. Sempre número, nunca null se
  \`set_scheme\` preenchido.
- Se NÃO houver método ou variação entre séries, mantém comportamento simples:
  \`set_scheme\`: null, \`method_key\`: null, \`rounds\`: null. NÃO preencha scheme
  para "3x10" comum.

Cada fase do \`set_scheme\` segue este shape:
{ "set_number": 1, "set_type": "normal", "reps": "10", "rest_seconds": 60,
  "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null,
  "tempo": null, "notes": null }

Se um exercício do texto NÃO tem correspondência clara no catálogo, retorne matched: false e preserve o nome original.
Se o texto mencionar apenas o exercício sem séries/reps, use os defaults: sets: 3, reps: "10".
Se o texto não separar em treinos distintos, coloque tudo em um treino chamado "Treino A".

Retorne APENAS o JSON válido, sem markdown, sem explicação, sem code blocks.

Formato de resposta (exemplo simples e exemplo com método):
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
          "notes": null,
          "method_key": null,
          "rounds": null,
          "set_scheme": null
        },
        {
          "matched": true,
          "exercise_id": "uuid-supino",
          "catalog_name": "Supino Reto com Barra",
          "original_text": "supino reto pirâmide 12-10-8-6 desc 90s",
          "sets": 4,
          "reps": "12-10-8-6",
          "rest_seconds": 90,
          "notes": null,
          "method_key": "pyramid_down",
          "rounds": 1,
          "set_scheme": [
            { "set_number": 1, "set_type": "normal", "reps": "12", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null },
            { "set_number": 2, "set_type": "normal", "reps": "10", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null },
            { "set_number": 3, "set_type": "normal", "reps": "8", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null },
            { "set_number": 4, "set_type": "normal", "reps": "6", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null }
          ]
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
        const limit = await consumeRateLimit(rateLimitKey, { perMinute: 5, perDay: 50 })
        if (!limit.allowed) {
            return NextResponse.json({ error: limit.error || 'Rate limit exceeded' }, { status: 429 })
        }

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
