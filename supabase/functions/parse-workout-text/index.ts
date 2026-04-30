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
- Extraia descanso se mencionado (ex: "descanso 90s", "1min rest", "90\\"")
- Qualquer informação extra (cadência, técnica, "até a falha", "drop set") vai no campo notes
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
- Métodos avançados NÃO são compatíveis com supersets. Se um exercício faz
  parte de um superset, mantenha \`set_scheme\`/\`method_key\`/\`rounds\` null
  mesmo que o texto descreva variação entre séries.

Cada fase do \`set_scheme\` segue este shape:
{ "set_number": 1, "set_type": "normal", "reps": "10", "rest_seconds": 60,
  "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null,
  "tempo": null, "notes": null }

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
          "superset_group": null,
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
          "superset_group": null,
          "method_key": "pyramid_down",
          "rounds": 1,
          "set_scheme": [
            { "set_number": 1, "set_type": "normal", "reps": "12", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null },
            { "set_number": 2, "set_type": "normal", "reps": "10", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null },
            { "set_number": 3, "set_type": "normal", "reps": "8", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null },
            { "set_number": 4, "set_type": "normal", "reps": "6", "rest_seconds": 90, "weight_target_kg": null, "weight_target_pct1rm": null, "rir": null, "tempo": null, "notes": null }
          ]
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
          "superset_group": "ss1",
          "method_key": null,
          "rounds": null,
          "set_scheme": null
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
          "superset_group": "ss1",
          "method_key": null,
          "rounds": null,
          "set_scheme": null
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
    status: "success" | "error" | "timeout" | "missing_key";
    /** Short human-readable failure detail — safe to surface to the UI. */
    detail?: string;
    /** HTTP status code returned by OpenAI (when applicable). */
    upstream_status?: number;
    input_tokens?: number;
    output_tokens?: number;
}

// Ordered fallback list — we try each model until one answers. `gpt-4.1-mini`
// is the primary (same model used by the web /api/prescription/parse-text
// route); `gpt-4o-mini` is the broadly-available fallback so the feature
// keeps working even if the project doesn't have access to the newer model.
const MODEL_FALLBACKS = ["gpt-4.1-mini", "gpt-4o-mini"];

// Split the user's text into separate per-workout blocks. See the equivalent
// comment in web/src/app/api/prescription/parse-text/route.ts for rationale.
// Parallel per-block calls turn O(total-exercises) into O(largest-workout).
const HEADING_KEYWORDS = [
    "treino", "dia", "workout", "day", "sessao", "session",
    "superior", "inferior", "push", "pull", "legs", "pernas",
    "peito", "costas", "ombro", "ombros", "braco", "bracos",
    "full", "upper", "lower", "posterior", "anterior",
    "ab", "abs", "abdomen", "core",
];

function normalizeHeading(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function isWorkoutHeading(
    line: string,
    nextNonEmpty: string | null,
    prevLineBlank: boolean,
): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 80) return false;
    if (/\d+\s*[x×]\s*\d+/i.test(trimmed)) return false;

    const norm = normalizeHeading(trimmed);

    for (const kw of HEADING_KEYWORDS) {
        const re = new RegExp(`^${kw}\\b`);
        if (re.test(norm)) return true;
    }

    if (/^[a-z0-9]{1,4}\s*[-–—:]/.test(norm)) return true;

    // (4) heuristic fallback: linha curta sem números de série, seguida (em
    // até 1 linha em branco) por uma linha de exercício "Nome ... NxM".
    // SÓ dispara se a linha está separada visualmente do bloco anterior
    // (linha em branco antes ou início do texto). Sem isso, "Aquecimento"
    // dentro de um bloco de exercícios viraria heading falso.
    if (
        prevLineBlank &&
        trimmed.length <= 40 &&
        nextNonEmpty &&
        /\d+\s*[x×]\s*\d+/i.test(nextNonEmpty)
    ) {
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        if (wordCount <= 5) return true;
    }

    return false;
}

export function splitWorkoutBlocks(text: string): string[] {
    const lines = text.split("\n");
    const blocks: string[] = [];
    let current: string[] = [];

    const nextNonEmpty: (string | null)[] = new Array(lines.length).fill(null);
    let pending: string | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        nextNonEmpty[i] = pending;
        if (lines[i].trim()) pending = lines[i].trim();
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prevLineBlank = i === 0 || lines[i - 1].trim() === "";
        if (isWorkoutHeading(line, nextNonEmpty[i], prevLineBlank)) {
            if (current.length > 0) {
                const block = current.join("\n").trim();
                if (block) blocks.push(block);
            }
            current = [line];
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) {
        const block = current.join("\n").trim();
        if (block) blocks.push(block);
    }
    if (blocks.length === 0) return [text];
    return blocks;
}

async function callOpenAI(system: string, userMessage: string): Promise<LLMResult> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        console.error("[parse-workout-text] OPENAI_API_KEY not set");
        return {
            data: null,
            status: "missing_key",
            detail: "OPENAI_API_KEY não está configurada nos secrets da Edge Function.",
        };
    }

    let lastDetail: string | undefined;
    let lastUpstream: number | undefined;

    for (const model of MODEL_FALLBACKS) {
        const controller = new AbortController();
        // 28s timeout per model attempt. Large free-text prescriptions with
        // 5+ workouts and 40+ exercises can approach this limit on gpt-4.1-mini;
        // if we hit the limit, the fallback model (gpt-4o-mini) usually finishes
        // faster because it generates shorter output tokens for the same task.
        const timeoutId = setTimeout(() => controller.abort(), 28000);

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
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
                // Try to extract the OpenAI error message for cleaner surfacing.
                let openaiMessage = errText.slice(0, 200);
                try {
                    const parsed = JSON.parse(errText);
                    if (parsed?.error?.message) openaiMessage = String(parsed.error.message).slice(0, 200);
                } catch {
                    // keep raw slice
                }
                console.error(
                    `[parse-workout-text] OpenAI ${model} HTTP ${response.status}: ${openaiMessage}`,
                );
                lastDetail = `OpenAI ${model}: ${openaiMessage}`;
                lastUpstream = response.status;
                // 400 "model not found" / 404 / 403 → try next fallback.
                // 429 rate-limit + 5xx → also worth a fallback attempt.
                // 401 invalid key → bail immediately, fallback won't help.
                if (response.status === 401) {
                    return {
                        data: null,
                        status: "error",
                        detail: lastDetail,
                        upstream_status: response.status,
                    };
                }
                continue;
            }

            const payload = await response.json();
            const content = payload?.choices?.[0]?.message?.content;

            if (!content || typeof content !== "string") {
                lastDetail = `OpenAI ${model}: resposta vazia (sem content).`;
                console.error(`[parse-workout-text] ${lastDetail}`);
                continue;
            }

            return {
                data: content,
                status: "success",
                input_tokens: payload?.usage?.prompt_tokens,
                output_tokens: payload?.usage?.completion_tokens,
            };
        } catch (err: any) {
            clearTimeout(timeoutId);
            const isAbort = err?.name === "AbortError";
            lastDetail = isAbort
                ? `OpenAI ${model}: tempo esgotado (28s).`
                : `OpenAI ${model}: ${err?.message || "erro de rede"}`;
            console.error(`[parse-workout-text] ${lastDetail}`);
            // On timeout, try the next (usually faster) fallback model rather
            // than bailing — a previous version returned early on the first
            // timeout, which kept large prescriptions broken even when the
            // fallback model would have finished in time.
        }
    }

    return {
        data: null,
        status: lastDetail?.includes("tempo esgotado") ? "timeout" : "error",
        detail: lastDetail ?? "Todos os modelos falharam.",
        upstream_status: lastUpstream,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog pre-filter — same strategy as the web /api/prescription/parse-text
// route. Sending 400+ exercises on every call was pushing the LLM over the
// 28s timeout for large free-text prescriptions (5+ workouts). By keeping
// only exercises whose name shares a content word with the trainer's text we
// cut both input and output tokens dramatically.
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
    "com", "sem", "para", "treino", "series", "serie", "reps", "rep",
    "repeticoes", "rodadas", "descanso", "rest", "set", "sets", "ate", "falha",
    "alternado", "alternada", "livre", "pegada", "enfasei", "enfase", "dia",
    "possivel", "maquina", "barra", "halter", "halteres", "cabo", "polia",
    "smith", "corda", "frente", "tras", "cima", "baixo", "completo", "media",
    "medio", "aberta", "fechada", "pronada", "supinada", "neutra",
]);

function normalize(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function stemPtBr(token: string): string {
    if (token.length <= 4) return token;
    if (/(or)(a|as|es)$/.test(token)) return token.replace(/(or)(a|as|es)$/, "$1");
    if (/(.{4,})(as|os|a|o)$/.test(token)) {
        return token.replace(/(.{4,})(as|os|a|o)$/, "$1");
    }
    if (/s$/.test(token) && token.length > 4) return token.slice(0, -1);
    return token;
}

const KEYWORD_ALIASES: Record<string, string[]> = {
    banco: ["cadeira", "mesa"],
    pulldown: ["puxada"],
    hip: ["elevacao", "quadril"],
    agacho: ["agachamento"],
    agache: ["agachamento"],
    bulgaro: ["agachamento", "bulgaro"],
    legpress: ["leg", "press"],
};

export function extractKeywords(text: string): Set<string> {
    const tokens = normalize(text).match(/[a-z0-9]+/g) || [];
    const keywords = new Set<string>();
    for (const tok of tokens) {
        if (tok.length < 3 || STOP_WORDS.has(tok) || /^\d+$/.test(tok)) continue;
        const stem = stemPtBr(tok);
        keywords.add(stem);
        const aliases = KEYWORD_ALIASES[stem] ?? KEYWORD_ALIASES[tok];
        if (aliases) for (const a of aliases) keywords.add(stemPtBr(a));
    }
    return keywords;
}

export function filterCatalogByText<T extends { id: string; name: string }>(
    text: string,
    catalog: T[],
): T[] {
    const keywords = extractKeywords(text);
    if (keywords.size === 0) return catalog;

    const scored: Array<{ ex: T; score: number }> = [];
    for (const ex of catalog) {
        const nameTokens = (normalize(ex.name).match(/[a-z0-9]+/g) || [])
            .filter(t => t.length >= 3)
            .map(stemPtBr);
        let score = 0;
        for (const tok of nameTokens) {
            if (keywords.has(tok)) {
                score += 2;
            } else {
                for (const kw of keywords) {
                    if (kw.length >= 4 && tok.length >= 4 &&
                        (kw.startsWith(tok) || tok.startsWith(kw))) {
                        score += 1;
                        break;
                    }
                }
            }
        }
        if (score > 0) scored.push({ ex, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.map(s => s.ex);
    if (filtered.length < 20) return catalog;
    return filtered.slice(0, 150);
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

interface WorkoutSetPhase {
    set_number: number;
    set_type: string;
    reps: string;
    rest_seconds: number;
    weight_target_kg?: number | null;
    weight_target_pct1rm?: number | null;
    rir?: number | null;
    tempo?: string | null;
    notes?: string | null;
}

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
    method_key: string | null;
    rounds: number | null;
    set_scheme: WorkoutSetPhase[] | null;
}

interface ParsedWorkout {
    name: string;
    exercises: ParsedExercise[];
}

interface ParseTextResponse {
    workouts: ParsedWorkout[];
}

const VALID_METHODS = new Set([
    "standard", "custom",
    "pyramid_down", "pyramid_up", "drop_set", "top_backoff", "5x5", "cluster",
]);

const VALID_SET_TYPES = new Set([
    "warmup", "normal", "top", "backoff", "drop", "failure", "cluster", "amrap",
]);

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
        // deno-lint-ignore no-explicit-any
        for (const ex of workout.exercises as any[]) {
            if (ex.matched && ex.exercise_id && !exerciseIds.has(ex.exercise_id)) {
                ex.matched = false;
                ex.exercise_id = null;
                ex.catalog_name = null;
            }

            // method_key
            if (ex.method_key != null && !VALID_METHODS.has(ex.method_key)) {
                ex.method_key = null;
            }
            if (ex.method_key === undefined) ex.method_key = null;

            // rounds
            if (ex.rounds != null) {
                if (typeof ex.rounds !== "number" || !Number.isFinite(ex.rounds) || ex.rounds < 1 || ex.rounds > 20) {
                    ex.rounds = 1;
                } else {
                    ex.rounds = Math.floor(ex.rounds);
                }
            }
            if (ex.rounds === undefined) ex.rounds = null;

            // set_scheme
            if (ex.set_scheme != null) {
                if (!Array.isArray(ex.set_scheme) || ex.set_scheme.length === 0) {
                    ex.set_scheme = null;
                    ex.method_key = null;
                    ex.rounds = null;
                } else {
                    let valid = true;
                    for (let i = 0; i < ex.set_scheme.length; i++) {
                        const phase = ex.set_scheme[i];
                        if (typeof phase !== "object" || phase === null) {
                            valid = false;
                            break;
                        }
                        phase.set_number = i + 1;
                        if (typeof phase.set_type !== "string" || !VALID_SET_TYPES.has(phase.set_type)) {
                            phase.set_type = "normal";
                        }
                        if (typeof phase.reps !== "string" || !phase.reps) {
                            phase.reps = "10";
                        }
                        if (typeof phase.rest_seconds !== "number" || !Number.isFinite(phase.rest_seconds) || phase.rest_seconds < 0) {
                            phase.rest_seconds = 0;
                        }
                        if (phase.weight_target_kg === undefined) phase.weight_target_kg = null;
                        if (phase.weight_target_pct1rm === undefined) phase.weight_target_pct1rm = null;
                        if (phase.rir === undefined) phase.rir = null;
                        if (phase.tempo === undefined) phase.tempo = null;
                        if (phase.notes === undefined) phase.notes = null;
                    }
                    if (!valid) {
                        ex.set_scheme = null;
                        ex.method_key = null;
                        ex.rounds = null;
                    }
                }
            }
            if (ex.set_scheme === undefined) ex.set_scheme = null;

            // Métodos avançados são incompatíveis com superset (V1).
            if (ex.superset_group && ex.set_scheme) {
                ex.set_scheme = null;
                ex.method_key = null;
                ex.rounds = null;
            }

            // Coerência: se set_scheme está preenchido, ajusta agregados.
            if (ex.set_scheme && ex.set_scheme.length > 0) {
                const rounds = (ex.rounds ?? 1) as number;
                ex.rounds = rounds;
                ex.sets = ex.set_scheme.length * rounds;
                // deno-lint-ignore no-explicit-any
                ex.reps = ex.set_scheme.map((p: any) => String(p.reps ?? "10")).join("-");
                const firstRest = ex.set_scheme[0].rest_seconds;
                if (typeof firstRest === "number") ex.rest_seconds = firstRest;
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

        // 5. Split into per-workout blocks and process each in parallel.
        // This turns a 5-workout prescription from ~54s (sequential single call)
        // into ~15s (parallel per-workout calls).
        const blocks = splitWorkoutBlocks(text.trim());
        const exerciseIdSet = new Set(exercises.map((e) => e.id));

        const parseOneBlock = async (block: string) => {
            const filtered = filterCatalogByText(block, exercises);
            const catalogStr = filtered.map((e) => `${e.id}|${e.name}`).join("\n");
            const userPrompt = `Texto do treinador:\n${block}\n\nCatálogo de exercícios disponíveis:\n${catalogStr}`;

            const r = await callOpenAI(SYSTEM_PROMPT, userPrompt);
            if (r.status !== "success" || !r.data) {
                return { response: null, status: r.status, detail: r.detail, usage: null };
            }
            const parsed = extractJson(r.data);
            if (!parsed) {
                return { response: null, status: "parse_error", detail: "Resposta da IA não é JSON válido.", usage: { in: r.input_tokens, out: r.output_tokens } };
            }
            const validated = validateAndFixResponse(parsed, exerciseIdSet);
            return {
                response: validated,
                status: validated ? "success" : "invalid_structure",
                detail: validated ? undefined : "Estrutura da resposta inválida.",
                usage: { in: r.input_tokens, out: r.output_tokens },
            };
        };

        const results = await Promise.all(blocks.map(parseOneBlock));
        const successful = results.filter((r) => r.response && r.response.workouts && r.response.workouts.length);

        if (successful.length === 0) {
            const first = results[0];
            const status = first?.status || "error";
            console.error("[parse-workout-text] All blocks failed:", results.map((r) => r.status).join(","));
            const statusCode = status === "missing_key" ? 500
                : status === "timeout" ? 504
                : 502;
            const userMessage = status === "timeout"
                ? "A IA está demorando demais. Tente novamente ou divida o treino em blocos menores."
                : status === "missing_key"
                    ? "Configuração de IA ausente. Contate o suporte."
                    : first?.detail || `AI processing failed: ${status}`;
            return jsonResponse(
                { error: userMessage, reason: status },
                statusCode,
            );
        }

        const aggregated = {
            workouts: successful.flatMap((r) => r.response!.workouts),
        };

        const totalIn = results.reduce((s, r) => s + (r.usage?.in || 0), 0);
        const totalOut = results.reduce((s, r) => s + (r.usage?.out || 0), 0);
        const costPerM = { input: 0.4, output: 1.6 };
        const cost = (totalIn / 1_000_000) * costPerM.input + (totalOut / 1_000_000) * costPerM.output;
        console.log(`[parse-workout-text] ${blocks.length} block(s), ${successful.length} ok, tokens: in=${totalIn} out=${totalOut} cost=$${cost.toFixed(4)}`);

        return jsonResponse(aggregated);
    } catch (err) {
        console.error("[parse-workout-text] Unexpected error:", err);
        return jsonResponse({ error: "Internal server error" }, 500);
    }
});
