import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt (same as web version)
// ─────────────────────────────────────────────────────────────────────────────

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
- Extraia descanso se mencionado (ex: "descanso 90s", "1min rest", "90\\"")
- Qualquer informação extra (cadência, técnica, "até a falha", "drop set") vai no campo notes
- Identifique separações de treinos (ex: "Treino A", "Treino B", "Treino 1", "Dia 1", "---", ou linha em branco entre blocos distintos)

SUPERSETS / BI-SETS / TRI-SETS:
- Identifique quando exercícios são marcados como superset, bi-set ou tri-set
- Indicadores comuns de superset:
  - "SS:", "Superset:", "Super set:", "Bi-set:", "Tri-set:", "Bi:", "Tri:"
  - Exercícios conectados com "+" (ex: "Rosca direta + Tríceps corda 3x10")
  - Exercícios conectados com "→" ou "->" (ex: "Supino reto → Crucifixo 3x10")
  - Termos como "combinado com", "junto com", "emendado com", "sem descanso entre"
  - Exercícios listados dentro de um bloco claramente agrupado (indentação, numeração a/b/c dentro de um item)
- Se detectar superset, agrupe os exercícios usando o campo "superset_group" com um identificador único (ex: "ss1", "ss2")
- Todos os exercícios do mesmo superset devem ter o MESMO valor em "superset_group"
- O campo "rest_seconds" nos exercícios de superset deve ser o descanso ENTRE RODADAS (não entre exercícios)
- Exercícios que NÃO fazem parte de superset devem ter superset_group: null

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
          "notes": null,
          "superset_group": null
        },
        {
          "matched": true,
          "exercise_id": "uuid-exercicio-1",
          "catalog_name": "Rosca Direta Barra W",
          "original_text": "rosca direta + tríceps corda",
          "sets": 3,
          "reps": "10",
          "rest_seconds": 60,
          "notes": null,
          "superset_group": "ss1"
        },
        {
          "matched": true,
          "exercise_id": "uuid-exercicio-2",
          "catalog_name": "Tríceps na Polia com Corda",
          "original_text": "rosca direta + tríceps corda",
          "sets": 3,
          "reps": "10",
          "rest_seconds": 60,
          "notes": null,
          "superset_group": "ss1"
        }
      ]
    }
  ]
}`;

// ─────────────────────────────────────────────────────────────────────────────
// LLM Call (OpenAI GPT-4.1-mini)
// ─────────────────────────────────────────────────────────────────────────────

interface LLMResult {
    data: string | null;
    status: "success" | "error" | "timeout";
    input_tokens?: number;
    output_tokens?: number;
}

async function callOpenAI(system: string, userMessage: string): Promise<LLMResult> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        console.error("[parse-workout-text] OPENAI_API_KEY not set");
        return { data: null, status: "error" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: "gpt-4.1-mini",
                temperature: 0.1,
                max_tokens: 4000,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: userMessage },
                ],
            }),
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`[parse-workout-text] OpenAI HTTP ${response.status}: ${errText.slice(0, 300)}`);
            return { data: null, status: "error" };
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;

        if (!content || typeof content !== "string") {
            return { data: null, status: "error" };
        }

        return {
            data: content,
            status: "success",
            input_tokens: payload?.usage?.prompt_tokens,
            output_tokens: payload?.usage?.completion_tokens,
        };
    } catch (err: any) {
        clearTimeout(timeoutId);
        const status = err?.name === "AbortError" ? "timeout" : "error";
        console.error(`[parse-workout-text] OpenAI call failed:`, err?.message);
        return { data: null, status };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(text: string): unknown | null {
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

    try {
        return JSON.parse(jsonStr);
    } catch {
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                return null;
            }
        }
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation (fix hallucinated IDs)
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedExercise {
    matched: boolean;
    exercise_id: string | null;
    catalog_name: string | null;
    original_text: string;
    sets: number;
    reps: string;
    rest_seconds: number | null;
    notes: string | null;
    superset_group: string | null;
}

interface ParsedWorkout {
    name: string;
    exercises: ParsedExercise[];
}

interface ParseTextResponse {
    workouts: ParsedWorkout[];
}

function validateAndFixResponse(
    parsed: unknown,
    exerciseIds: Set<string>
): ParseTextResponse | null {
    const response = parsed as ParseTextResponse;
    if (!response?.workouts || !Array.isArray(response.workouts)) {
        return null;
    }

    for (const workout of response.workouts) {
        if (!Array.isArray(workout.exercises)) continue;
        for (const ex of workout.exercises) {
            if (ex.matched && ex.exercise_id && !exerciseIds.has(ex.exercise_id)) {
                ex.matched = false;
                ex.exercise_id = null;
                ex.catalog_name = null;
            }
        }
    }

    return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Auth — validate JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return jsonResponse({ error: "Missing authorization" }, 401);
        }
        const token = authHeader.slice(7);

        const supabaseUser = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const {
            data: { user },
            error: userError,
        } = await supabaseUser.auth.getUser();
        if (userError || !user) {
            return jsonResponse({ error: "Unauthorized" }, 401);
        }

        // Service role client (bypass RLS for exercise catalog query)
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 2. Validate trainer
        const { data: trainer } = await supabase
            .from("trainers")
            .select("id")
            .eq("auth_user_id", user.id)
            .single();

        if (!trainer) {
            return jsonResponse({ error: "Trainer not found" }, 403);
        }

        // 3. Parse request body
        const body = await req.json();
        const { text } = body;

        if (!text?.trim()) {
            return jsonResponse({ error: "text is required" }, 400);
        }

        // 4. Fetch exercise catalog from DB
        // Include global exercises (owner_id IS NULL) and trainer's custom exercises
        const { data: exercisesData, error: exError } = await supabase
            .from("exercises")
            .select("id, name")
            .eq("is_archived", false)
            .or(`owner_id.is.null,owner_id.eq.${trainer.id}`)
            .order("name");

        if (exError) {
            console.error("[parse-workout-text] Error fetching exercises:", exError);
            return jsonResponse({ error: "Failed to fetch exercise catalog" }, 500);
        }

        const exercises: { id: string; name: string }[] = exercisesData ?? [];

        if (exercises.length === 0) {
            return jsonResponse({ error: "No exercises in catalog" }, 400);
        }

        // 5. Build catalog string for prompt
        const catalogStr = exercises.map((e) => `${e.id}|${e.name}`).join("\n");

        const userPrompt = `Texto do treinador:\n${text.trim()}\n\nCatálogo de exercícios disponíveis:\n${catalogStr}`;

        // 6. Call LLM
        const result = await callOpenAI(SYSTEM_PROMPT, userPrompt);

        if (result.status !== "success" || !result.data) {
            console.error("[parse-workout-text] LLM call failed:", result.status);
            return jsonResponse(
                { error: `AI processing failed: ${result.status}` },
                500
            );
        }

        // 7. Parse and validate response
        const parsed = extractJson(result.data);
        if (!parsed) {
            console.error(
                "[parse-workout-text] Failed to parse LLM JSON:",
                result.data.slice(0, 500)
            );
            return jsonResponse({ error: "Failed to parse AI response" }, 422);
        }

        const exerciseIdSet = new Set(exercises.map((e) => e.id));
        const validated = validateAndFixResponse(parsed, exerciseIdSet);
        if (!validated) {
            console.error(
                "[parse-workout-text] Invalid response structure:",
                JSON.stringify(parsed).slice(0, 500)
            );
            return jsonResponse({ error: "Invalid AI response structure" }, 422);
        }

        // Log usage
        if (result.input_tokens) {
            const costPerM = { input: 0.4, output: 1.6 };
            const cost =
                ((result.input_tokens ?? 0) / 1_000_000) * costPerM.input +
                ((result.output_tokens ?? 0) / 1_000_000) * costPerM.output;
            console.log(
                `[parse-workout-text] tokens: in=${result.input_tokens} out=${result.output_tokens} cost=$${cost.toFixed(4)}`
            );
        }

        return jsonResponse(validated);
    } catch (err) {
        console.error("[parse-workout-text] Unexpected error:", err);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
});
