// ============================================================================
// Kinevo — Progressão semanal do bloco aeróbio (fonte única de resolução)
// ============================================================================
// Um bloco cardio pode carregar `progression: CardioWeekOverride[]` — overrides
// por semana do programa ("na semana 5 o longão vira 9 km", "da semana 9 em
// diante a qualidade vira tempo run"). Este módulo é a ÚNICA fonte da
// semântica de resolução, consumida por web (builder/preview), mobile
// (execução do aluno), Watch (snapshot) e MCP/IA.
//
// Regras canônicas:
//   • Override "vale A PARTIR da semana `week`": aplica-se o de maior week ≤
//     semana corrente. Semanas antes do primeiro override usam a config base.
//   • Override SEM `mode` → merge raso (números/intensidade sobre a base).
//   • Override COM `mode` → substituição ESTRUTURAL: só equipment/notes herdam.
//   • A semana corrente segue a MESMA convenção de todas as superfícies de
//     calendário (getProgramWeek de shared/utils/schedule-projection): dias
//     civis LOCAIS de quem olha — "Semana N" aqui bate com o ProgramCalendar
//     e as projeções de agenda.

import type {
    CardioConfig,
    CardioWeekOverride,
} from '../../types/workout-items'
import { getProgramWeek } from '../../utils/schedule-projection'

/**
 * Semana corrente do programa (1-based) a partir de `started_at`, na convenção
 * canônica do produto (getProgramWeek — startOfDay local nos dois lados).
 * Sem started_at (template) ou data inválida → null; programa ainda não
 * começou → 1 (mostra a semana 1). Não clampa na duração — quem exibe decide
 * o que fazer com "semana 13 de 12" (a resolução usa o último override).
 */
export function programWeekNumber(
    startedAt: string | Date | null | undefined,
    now: Date = new Date(),
): number | null {
    if (!startedAt) return null
    const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt
    if (Number.isNaN(start.getTime())) return null
    return getProgramWeek(now, start) ?? 1
}

/** O bloco tem progressão semanal de verdade (≥1 override)? */
export function hasProgression(config: CardioConfig | null | undefined): boolean {
    return !!config?.progression && config.progression.length > 0
}

/** Maior semana definida na progressão (null sem progressão). */
export function maxProgressionWeek(config: CardioConfig | null | undefined): number | null {
    if (!config?.progression || config.progression.length === 0) return null
    return config.progression.reduce((max, o) => Math.max(max, o.week), 0)
}

/** Overrides ordenados por semana (não muta a entrada). */
export function sortedProgression(config: CardioConfig): CardioWeekOverride[] {
    return [...(config.progression ?? [])].sort((a, b) => a.week - b.week)
}

/** Resultado da resolução: config pronto para exibir/executar + metadados. */
export interface ResolvedCardioWeek {
    /** Config resolvido da semana — SEM o campo progression. */
    config: CardioConfig
    /** Semana usada na resolução (eco da entrada; null = base/template). */
    week: number | null
    /** Semana do override aplicado (null = config base, sem override). */
    overrideWeek: number | null
    /** Rótulo do override aplicado ("Regenerativa"), se houver. */
    label: string | null
}

/** Config base sem o campo progression (para exibição/execução). */
function baseSansProgression(config: CardioConfig): CardioConfig {
    const { progression: _p, ...rest } = config
    return rest
}

/**
 * Resolve o config do bloco para uma semana do programa.
 * `week` null (template, started_at ausente) → config base.
 */
export function resolveCardioForWeek(
    config: CardioConfig,
    week: number | null | undefined,
): ResolvedCardioWeek {
    const base = baseSansProgression(config)
    const noWeek: ResolvedCardioWeek = { config: base, week: week ?? null, overrideWeek: null, label: null }
    if (week == null || week < 1) return noWeek
    if (!config.progression || config.progression.length === 0) return noWeek

    // Override de maior `week` ≤ semana corrente ("vale a partir de").
    let applied: CardioWeekOverride | null = null
    for (const o of config.progression) {
        if (o.week <= week && (applied === null || o.week > applied.week)) applied = o
    }
    if (!applied) return noWeek

    return {
        config: applyOverride(base, applied),
        week,
        overrideWeek: applied.week,
        label: applied.label ?? null,
    }
}

/** Aplica UM override sobre a base (regras estrutural vs merge raso). */
export function applyOverride(base: CardioConfig, o: CardioWeekOverride): CardioConfig {
    if (o.mode) {
        // Substituição ESTRUTURAL: a semana é exatamente o que o override
        // define; só equipment e notes (fallback) herdam da base.
        const out: CardioConfig = {
            mode: o.mode,
            equipment: base.equipment,
            notes: o.notes ?? base.notes,
        }
        if (o.objective != null) out.objective = o.objective
        if (o.duration_minutes != null) out.duration_minutes = o.duration_minutes
        if (o.distance_km != null) out.distance_km = o.distance_km
        if (o.intensity != null) out.intensity = o.intensity
        if (o.intensity_target != null) out.intensity_target = o.intensity_target
        if (o.intervals != null) out.intervals = o.intervals
        if (o.protocol_key != null) out.protocol_key = o.protocol_key
        if (o.segments != null) out.segments = o.segments
        return out
    }

    // Merge raso + higiene de campos derivados/acoplados:
    //   • alvo novo sem string nova → descarta a string herdada (estaria stale);
    //   • números de intervalo novos sem protocolo → descarta o selo herdado;
    //   • segments novos sem total novo → descarta o total herdado.
    const out: CardioConfig = { ...base }
    if (o.objective != null) out.objective = o.objective
    if (o.duration_minutes != null) out.duration_minutes = o.duration_minutes
    if (o.distance_km != null) out.distance_km = o.distance_km
    if (o.intensity != null) out.intensity = o.intensity
    if (o.intensity_target != null) {
        out.intensity_target = o.intensity_target
        if (o.intensity == null) delete out.intensity
    }
    if (o.intervals != null) {
        out.intervals = o.intervals
        if (o.protocol_key == null) delete out.protocol_key
    }
    if (o.protocol_key != null) out.protocol_key = o.protocol_key
    if (o.segments != null) {
        out.segments = o.segments
        if (o.duration_minutes == null) delete out.duration_minutes
        if (o.intensity == null && o.intensity_target == null) delete out.intensity
    }
    if (o.notes != null) out.notes = o.notes
    return out
}
