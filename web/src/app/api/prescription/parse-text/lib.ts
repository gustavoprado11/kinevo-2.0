import type { ParseTextResponse } from './types'

// ---------------------------------------------------------------------------
// Splitter — recognize per-workout heading lines used by Brazilian trainers
// ---------------------------------------------------------------------------

const HEADING_KEYWORDS = [
    'treino', 'dia', 'workout', 'day', 'sessao', 'session',
    'superior', 'inferior', 'push', 'pull', 'legs', 'pernas',
    'peito', 'costas', 'ombro', 'ombros', 'braco', 'bracos',
    'full', 'upper', 'lower', 'posterior', 'anterior',
    'ab', 'abs', 'abdomen', 'core',
]

function normalizeHeadingStr(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function isWorkoutHeading(
    line: string,
    nextNonEmpty: string | null,
    prevLineBlank: boolean,
): boolean {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 80) return false
    if (/\d+\s*[x×]\s*\d+/i.test(trimmed)) return false

    const norm = normalizeHeadingStr(trimmed)

    for (const kw of HEADING_KEYWORDS) {
        const re = new RegExp(`^${kw}\\b`)
        if (re.test(norm)) return true
    }

    if (/^[a-z0-9]{1,4}\s*[-–—:]/.test(norm)) return true

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
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length
        if (wordCount <= 5) return true
    }

    return false
}

export function splitWorkoutBlocks(text: string): string[] {
    const lines = text.split('\n')
    const blocks: string[] = []
    let current: string[] = []

    const nextNonEmpty: (string | null)[] = new Array(lines.length).fill(null)
    let pending: string | null = null
    for (let i = lines.length - 1; i >= 0; i--) {
        nextNonEmpty[i] = pending
        if (lines[i].trim()) pending = lines[i].trim()
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const prevLineBlank = i === 0 || lines[i - 1].trim() === ''
        if (isWorkoutHeading(line, nextNonEmpty[i], prevLineBlank)) {
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

    if (blocks.length === 0) return [text]
    return blocks
}

// ---------------------------------------------------------------------------
// Catalog pre-filter
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
    'com', 'sem', 'para', 'treino', 'series', 'serie', 'reps', 'rep',
    'repeticoes', 'rodadas', 'descanso', 'rest', 'set', 'sets', 'ate', 'falha',
    'alternado', 'alternada', 'livre', 'pegada', 'enfasei', 'enfase', 'dia',
    'possivel', 'maquina', 'barra', 'halter', 'halteres', 'cabo', 'polia',
    'smith', 'corda', 'frente', 'tras', 'cima', 'baixo', 'completo', 'media',
    'medio', 'aberta', 'fechada', 'pronada', 'supinada', 'neutra',
])

function normalize(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function stemPtBr(token: string): string {
    if (token.length <= 4) return token
    if (/(or)(a|as|es)$/.test(token)) return token.replace(/(or)(a|as|es)$/, '$1')
    if (/(.{4,})(as|os|a|o)$/.test(token)) {
        return token.replace(/(.{4,})(as|os|a|o)$/, '$1')
    }
    if (/s$/.test(token) && token.length > 4) return token.slice(0, -1)
    return token
}

const KEYWORD_ALIASES: Record<string, string[]> = {
    banco: ['cadeira', 'mesa'],
    pulldown: ['puxada'],
    hip: ['elevacao', 'quadril'],
    agacho: ['agachamento'],
    agache: ['agachamento'],
    bulgaro: ['agachamento', 'bulgaro'],
    legpress: ['leg', 'press'],
}

export function extractKeywords(text: string): Set<string> {
    const tokens = normalize(text).match(/[a-z0-9]+/g) || []
    const keywords = new Set<string>()
    for (const tok of tokens) {
        if (tok.length < 3 || STOP_WORDS.has(tok) || /^\d+$/.test(tok)) continue
        const stem = stemPtBr(tok)
        keywords.add(stem)
        const aliases = KEYWORD_ALIASES[stem] ?? KEYWORD_ALIASES[tok]
        if (aliases) for (const a of aliases) keywords.add(stemPtBr(a))
    }
    return keywords
}

export function filterCatalogByText<T extends { id: string; name: string }>(
    text: string,
    catalog: T[],
): T[] {
    const keywords = extractKeywords(text)
    if (keywords.size === 0) return catalog

    const scored: Array<{ ex: T; score: number }> = []
    for (const ex of catalog) {
        const nameTokens = (normalize(ex.name).match(/[a-z0-9]+/g) || [])
            .filter(t => t.length >= 3)
            .map(stemPtBr)
        let score = 0
        for (const tok of nameTokens) {
            if (keywords.has(tok)) {
                score += 2
            } else {
                for (const kw of keywords) {
                    if (kw.length >= 4 && tok.length >= 4 &&
                        (kw.startsWith(tok) || tok.startsWith(kw))) {
                        score += 1
                        break
                    }
                }
            }
        }
        if (score > 0) scored.push({ ex, score })
    }

    scored.sort((a, b) => b.score - a.score)
    const filtered = scored.map(s => s.ex)

    if (filtered.length < 20) return catalog
    return filtered.slice(0, 150)
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

const VALID_METHODS = new Set([
    'standard', 'custom',
    'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster',
])

const VALID_SET_TYPES = new Set([
    'warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap',
])

/** Validate response structure and fix hallucinated exercise IDs.
 *  Fase 5: also coerces method_key, rounds, set_scheme and enforces aggregate
 *  coherence (sets / reps / rest_seconds reflect the scheme when present). */
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
        for (const ex of workout.exercises as unknown as Array<Record<string, unknown> & {
            matched: boolean
            exercise_id: string | null
            catalog_name: string | null
            sets: number
            reps: string
            rest_seconds: number | null
            method_key?: string | null
            rounds?: number | null
            set_scheme?: Array<Record<string, unknown>> | null
        }>) {
            if (ex.matched && ex.exercise_id && !exerciseIds.has(ex.exercise_id)) {
                ex.matched = false
                ex.exercise_id = null
                ex.catalog_name = null
            }

            // method_key: enum check, default null
            if (ex.method_key != null && !VALID_METHODS.has(ex.method_key)) {
                ex.method_key = null
            }
            if (ex.method_key === undefined) ex.method_key = null

            // rounds: must be a positive integer in [1,20] or null
            if (ex.rounds != null) {
                if (typeof ex.rounds !== 'number' || !Number.isFinite(ex.rounds) || ex.rounds < 1 || ex.rounds > 20) {
                    ex.rounds = 1
                } else {
                    ex.rounds = Math.floor(ex.rounds)
                }
            }
            if (ex.rounds === undefined) ex.rounds = null

            // set_scheme: array of phase objects or null
            if (ex.set_scheme != null) {
                if (!Array.isArray(ex.set_scheme) || ex.set_scheme.length === 0) {
                    ex.set_scheme = null
                    ex.method_key = null
                    ex.rounds = null
                } else {
                    let valid = true
                    for (let i = 0; i < ex.set_scheme.length; i++) {
                        const phase = ex.set_scheme[i] as Record<string, unknown>
                        if (typeof phase !== 'object' || phase === null) {
                            valid = false
                            break
                        }
                        // set_number sequencial 1..N
                        phase.set_number = i + 1
                        // set_type no enum, default normal
                        if (typeof phase.set_type !== 'string' || !VALID_SET_TYPES.has(phase.set_type as string)) {
                            phase.set_type = 'normal'
                        }
                        // reps obrigatório
                        if (typeof phase.reps !== 'string' || !phase.reps) {
                            phase.reps = '10'
                        }
                        // rest_seconds default 0
                        if (typeof phase.rest_seconds !== 'number' || !Number.isFinite(phase.rest_seconds) || phase.rest_seconds < 0) {
                            phase.rest_seconds = 0
                        }
                        // optional fields → coerce to null when missing/invalid
                        if (phase.weight_target_kg === undefined) phase.weight_target_kg = null
                        if (phase.weight_target_pct1rm === undefined) phase.weight_target_pct1rm = null
                        if (phase.rir === undefined) phase.rir = null
                        if (phase.tempo === undefined) phase.tempo = null
                        if (phase.notes === undefined) phase.notes = null
                    }
                    if (!valid) {
                        ex.set_scheme = null
                        ex.method_key = null
                        ex.rounds = null
                    }
                }
            }
            if (ex.set_scheme === undefined) ex.set_scheme = null

            // Coerência: se set_scheme está preenchido, ajusta agregados.
            if (ex.set_scheme && ex.set_scheme.length > 0) {
                const rounds = (ex.rounds ?? 1) as number
                ex.rounds = rounds
                ex.sets = ex.set_scheme.length * rounds
                ex.reps = ex.set_scheme.map((p) => String(p.reps ?? '10')).join('-')
                const firstRest = ex.set_scheme[0].rest_seconds
                ex.rest_seconds = typeof firstRest === 'number' ? firstRest : ex.rest_seconds
            }
        }
    }

    return response
}
