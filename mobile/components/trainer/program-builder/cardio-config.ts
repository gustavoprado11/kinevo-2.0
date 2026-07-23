/**
 * Helpers puros do item_config de cardio no builder mobile.
 *
 * O schema canônico é o de `shared/types/workout-items.ts` (CardioConfig) —
 * o mesmo que o builder web grava e que o player do aluno (CardioCard) lê:
 * `{ mode, equipment, objective, duration_minutes, distance_km, intensity,
 *    intensity_target, intervals, protocol_key, segments, notes }`.
 *
 * O builder mobile V1 gravava um schema próprio (`modality`/`target`) que o
 * resto do sistema não lê, e substituía o item_config inteiro no save —
 * destruindo protocolos intervalados criados no web (achado C3 da auditoria).
 * Estes helpers fazem: parse dos DOIS formatos (canônico + legado mobile),
 * merge preservando o que o sheet não edita, e migração do legado no save.
 *
 * Paridade de prescrição (jul/2026): o sheet mobile AUTORA contínuo e
 * intervalado (com protocolos nomeados) e intensidade estruturada
 * (zona/FC/RPE/pace) — a string `intensity` é DERIVADA do alvo no save, na
 * FCmáx do aluno quando conhecida (mesma espinha de retrocompat do web).
 * 'phased' segue autorado só no web: aqui é preservado intacto.
 */
import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    type CardioEquipment,
    type CardioIntensityTarget,
    type CardioIntervalConfig,
    type CardioObjective,
} from "@kinevo/shared/types/workout-items";
import { formatIntensityTarget } from "@kinevo/shared/lib/cardio/zones";
import { protocolMatchesIntervals } from "@kinevo/shared/lib/cardio/interval-protocols";

export type CardioSheetMode = "continuous" | "interval";

export interface ParsedCardioConfig {
    mode: CardioSheetMode;
    /** true quando o config atual é intervalado. */
    isInterval: boolean;
    /** Modo por fases (definido no web) — estrutura E intensidade são derivadas
     *  dos segments; o sheet mobile edita só equipamento/observações. */
    isPhased: boolean;
    equipment: CardioEquipment | null;
    objective: CardioObjective;
    /** duration_minutes (time) ou distance_km (distance), conforme objective. */
    target: number | null;
    intervals: CardioIntervalConfig | null;
    protocolKey: string | null;
    intensityTarget: CardioIntensityTarget | null;
    intensity: string;
    notes: string;
}

export interface CardioSheetEdits {
    mode: CardioSheetMode;
    equipment: CardioEquipment | null;
    objective: CardioObjective;
    target: number | null;
    /** mode='interval': work/rest/rounds autorados no sheet. */
    intervals: CardioIntervalConfig | null;
    /** Selo do protocolo escolhido — só persiste se os números ainda batem. */
    protocolKey: string | null;
    /** Alvo estruturado (zona/FC/RPE/pace); null = texto livre em `intensity`. */
    intensityTarget: CardioIntensityTarget | null;
    intensity: string;
    notes: string;
}

function asFiniteNumber(raw: unknown): number | null {
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

function isCardioEquipment(raw: unknown): raw is CardioEquipment {
    return typeof raw === "string" && (CARDIO_EQUIPMENT_OPTIONS as readonly string[]).includes(raw);
}

/** Legado mobile: "Esteira"/"bike"… (texto livre) → enum, por label ou valor. */
function equipmentFromLegacyModality(raw: unknown): CardioEquipment | null {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const needle = raw.trim().toLowerCase();
    if (isCardioEquipment(needle)) return needle;
    for (const key of CARDIO_EQUIPMENT_OPTIONS) {
        if (CARDIO_EQUIPMENT_LABELS[key].toLowerCase() === needle) return key;
    }
    return null;
}

function hasSegments(cfg: Record<string, unknown>): boolean {
    return Array.isArray(cfg.segments) && cfg.segments.length > 0;
}

function parseIntervals(raw: unknown): CardioIntervalConfig | null {
    if (!raw || typeof raw !== "object") return null;
    const iv = raw as Record<string, unknown>;
    const work = asFiniteNumber(iv.work_seconds);
    const rounds = asFiniteNumber(iv.rounds);
    if (work === null || rounds === null) return null;
    const rest = typeof iv.rest_seconds === "number" && Number.isFinite(iv.rest_seconds) && iv.rest_seconds >= 0
        ? iv.rest_seconds
        : 0;
    return { work_seconds: work, rest_seconds: rest, rounds };
}

function parseIntensityTarget(raw: unknown): CardioIntensityTarget | null {
    if (!raw || typeof raw !== "object") return null;
    const t = raw as CardioIntensityTarget;
    if (t.type === "zone" && t.zone) return t;
    if (t.type === "hr" && t.hr_min_bpm != null && t.hr_max_bpm != null) return t;
    if (t.type === "rpe" && t.rpe != null) return t;
    if (t.type === "pace" && t.pace_min_per_km) return t;
    return null;
}

/** Lê um item_config cru (canônico OU legado mobile) para o estado do sheet. */
export function parseCardioConfig(raw: Record<string, unknown> | null | undefined): ParsedCardioConfig {
    const cfg = raw ?? {};
    const intervals = parseIntervals(cfg.intervals);
    const isInterval = cfg.mode === "interval" && intervals !== null;
    const isPhased = cfg.mode === "phased" && hasSegments(cfg);
    const objective: CardioObjective = cfg.objective === "distance" ? "distance" : "time";

    const equipment = isCardioEquipment(cfg.equipment)
        ? cfg.equipment
        : equipmentFromLegacyModality(cfg.modality);

    // Canônico primeiro; `target` legado como fallback.
    const canonicalTarget = objective === "distance"
        ? asFiniteNumber(cfg.distance_km)
        : asFiniteNumber(cfg.duration_minutes);
    const target = canonicalTarget ?? asFiniteNumber(cfg.target);

    return {
        mode: isInterval ? "interval" : "continuous",
        isInterval,
        isPhased,
        equipment,
        objective,
        target,
        intervals,
        protocolKey: typeof cfg.protocol_key === "string" ? cfg.protocol_key : null,
        intensityTarget: parseIntensityTarget(cfg.intensity_target),
        intensity: typeof cfg.intensity === "string" ? cfg.intensity : "",
        notes: typeof cfg.notes === "string" ? cfg.notes : "",
    };
}

/**
 * Monta o item_config final: canônico, com merge sobre o config cru.
 * - Autora contínuo E intervalado (protocolo nomeado + work/rest/rounds).
 * - Intensidade: alvo estruturado → grava intensity_target E deriva a string
 *   `intensity` (FCmáx quando conhecida); sem alvo → texto livre.
 * - 'phased' (web) é preservado: só equipment/notes mudam aqui.
 * - Migra/strippa as chaves do legado mobile (`modality`, `target`).
 */
export function buildCardioConfig(
    raw: Record<string, unknown> | null | undefined,
    edits: CardioSheetEdits,
    maxHrBpm: number | null = null,
): Record<string, unknown> {
    const cfg = { ...(raw ?? {}) };
    const isPhased = cfg.mode === "phased" && hasSegments(cfg);

    delete cfg.modality;
    delete cfg.target;

    if (edits.equipment) cfg.equipment = edits.equipment;
    else delete cfg.equipment;
    if (edits.notes.trim()) cfg.notes = edits.notes.trim();
    else delete cfg.notes;

    // Phased: estrutura, derivados e intensidade (resumo) ficam intactos.
    if (isPhased) {
        cfg.mode = "phased";
        return cfg;
    }

    cfg.mode = edits.mode;

    if (edits.mode === "interval" && edits.intervals) {
        cfg.intervals = { ...edits.intervals };
        // Selo do protocolo só permanece se os números finais ainda batem
        // (mesma regra do web: editar work/rest/rounds limpa o selo).
        if (edits.protocolKey && protocolMatchesIntervals(edits.protocolKey, edits.intervals)) {
            cfg.protocol_key = edits.protocolKey;
        } else {
            delete cfg.protocol_key;
        }
        delete cfg.objective;
        delete cfg.duration_minutes;
        delete cfg.distance_km;
    } else {
        cfg.mode = "continuous";
        cfg.objective = edits.objective;
        if (edits.objective === "distance") {
            if (edits.target !== null) cfg.distance_km = edits.target;
            else delete cfg.distance_km;
            delete cfg.duration_minutes;
        } else {
            if (edits.target !== null) cfg.duration_minutes = edits.target;
            else delete cfg.duration_minutes;
            delete cfg.distance_km;
        }
        delete cfg.intervals;
        delete cfg.protocol_key;
    }

    // Intensidade: alvo estruturado vence e DERIVA a string de exibição.
    if (edits.intensityTarget) {
        cfg.intensity_target = { ...edits.intensityTarget };
        const derived = formatIntensityTarget(edits.intensityTarget, maxHrBpm);
        if (derived) cfg.intensity = derived;
        else delete cfg.intensity;
    } else {
        delete cfg.intensity_target;
        if (edits.intensity.trim()) cfg.intensity = edits.intensity.trim();
        else delete cfg.intensity;
    }

    return cfg;
}

/** Preview curto pro card do builder: "Esteira · 20min · Zona 2". */
export function formatCardioPreview(raw: Record<string, unknown> | null | undefined): string {
    const cfg = raw ?? {};
    const parsed = parseCardioConfig(cfg);
    const parts: string[] = [];

    if (parsed.equipment) parts.push(CARDIO_EQUIPMENT_LABELS[parsed.equipment]);
    else if (typeof cfg.modality === "string" && cfg.modality.trim()) parts.push(cfg.modality.trim());

    if (parsed.isPhased) {
        const segments = cfg.segments as unknown[];
        parts.push(`${segments.length} fases`);
        const total = asFiniteNumber(cfg.duration_minutes);
        if (total !== null) parts.push(`${total}min`);
        if (hasWeeklyProgression(cfg)) parts.push("Progressão semanal");
        return parts.join(" · ");
    }

    if (parsed.isInterval) {
        const intervals = cfg.intervals as { work_seconds?: number; rest_seconds?: number; rounds?: number } | undefined;
        if (intervals && typeof intervals.rounds === "number") {
            parts.push(`${intervals.rounds}× ${intervals.work_seconds ?? 0}s/${intervals.rest_seconds ?? 0}s`);
        } else {
            parts.push("Intervalado");
        }
    } else if (parsed.target !== null) {
        parts.push(parsed.objective === "distance" ? `${parsed.target}km` : `${parsed.target}min`);
    }

    if (parsed.intensity) parts.push(parsed.intensity);
    if (hasWeeklyProgression(cfg)) parts.push("Progressão semanal");

    return parts.length > 0 ? parts.join(" · ") : "Cardio livre";
}

/** Progressão semanal (autorada no web/IA) presente no config? O sheet mobile
 *  PRESERVA a progressão intacta — edita só a base (semana 1). */
export function hasWeeklyProgression(raw: Record<string, unknown> | null | undefined): boolean {
    return Array.isArray(raw?.progression) && (raw!.progression as unknown[]).length > 0;
}
