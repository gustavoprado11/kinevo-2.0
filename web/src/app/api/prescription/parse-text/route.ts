import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM } from '@/lib/prescription/llm-client'
import type { ParseTextRequest, ParseTextResponse } from './types'

export const maxDuration = 30

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

        // Parse request
        const body: ParseTextRequest = await req.json()
        const { text, exercises } = body

        if (!text?.trim()) {
            return NextResponse.json({ error: 'text is required' }, { status: 400 })
        }

        if (!exercises?.length) {
            return NextResponse.json({ error: 'exercises list is required' }, { status: 400 })
        }

        // Build exercise catalog string for the prompt
        const catalogStr = exercises
            .map(e => `${e.id}|${e.name}`)
            .join('\n')

        const userPrompt = `Texto do treinador:\n${text}\n\nCatálogo de exercícios disponíveis:\n${catalogStr}`

        // Call LLM
        const result = await callLLM({
            model: 'gpt-4.1-mini',
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
            max_tokens: 4000,
            timeout_ms: 20000,
            temperature: 0.1,
        })

        if (result.status !== 'success' || !result.data) {
            console.error('[parse-text] LLM call failed:', result.status)
            return NextResponse.json(
                { error: `LLM call failed: ${result.status}` },
                { status: 500 }
            )
        }

        // Parse JSON from LLM response
        const parsed = extractJson(result.data)
        if (!parsed) {
            console.error('[parse-text] Failed to parse LLM response as JSON:', result.data.slice(0, 500))
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 422 }
            )
        }

        // Validate structure and fix hallucinated IDs
        const exerciseIdSet = new Set(exercises.map(e => e.id))
        const response = validateAndFixResponse(parsed, exerciseIdSet)
        if (!response) {
            console.error('[parse-text] Invalid response structure:', JSON.stringify(parsed).slice(0, 500))
            return NextResponse.json(
                { error: 'Invalid AI response structure' },
                { status: 422 }
            )
        }

        if (result.usage) {
            console.log(`[parse-text] tokens: in=${result.usage.input_tokens} out=${result.usage.output_tokens} cost=$${result.usage.cost_usd.toFixed(4)}`)
        }

        return NextResponse.json(response)
    } catch (err) {
        console.error('[parse-text] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/** Extract JSON from LLM response text — handles markdown code blocks and raw JSON */
export function extractJson(text: string): unknown | null {
    // Try markdown code block first
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim()

    try {
        return JSON.parse(jsonStr)
    } catch {
        // Try to find raw JSON object in text
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0])
            } catch {
                return null
            }
        }
        return null
    }
}

/** Validate response structure and fix hallucinated exercise IDs */
export function validateAndFixResponse(
    parsed: unknown,
    exerciseIds: Set<string>
): ParseTextResponse | null {
    const response = parsed as ParseTextResponse
    if (!response?.workouts || !Array.isArray(response.workouts)) {
        return null
    }

    for (const workout of response.workouts) {
        if (!Array.isArray(workout.exercises)) continue
        for (const ex of workout.exercises) {
            if (ex.matched && ex.exercise_id && !exerciseIds.has(ex.exercise_id)) {
                ex.matched = false
                ex.exercise_id = null
                ex.catalog_name = null
            }
        }
    }

    return response
}
