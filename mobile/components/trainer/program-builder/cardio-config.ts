/**
 * Helpers puros do item_config de cardio no builder mobile.
 *
 * O schema canônico é o de `shared/types/workout-items.ts` (CardioConfig) —
 * o mesmo que o builder web grava e que o player do aluno (CardioCard) lê:
 * `{ mode, equipment, objective, duration_minutes, distance_km, intensity,
 *    intervals, notes }`.
 *
 * O builder mobile V1 gravava um schema próprio (`modality`/`target`) que o
 * resto do sistema não lê, e substituía o item_config inteiro no save —
 * destruindo protocolos intervalados criados no web (achado C3 da auditoria).
 * Estes helpers fazem: parse dos DOIS formatos (canônico + legado mobile),
 * merge preservando o que o sheet não edita, e migração do legado no save.
 */
import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    type CardioEquipment,
    type CardioObjective,
} from "@kinevo/shared/types/workout-items";

export interface ParsedCardioConfig {
    /** Protocolo intervalado (definido no web) — o sheet mobile não o edita. */
    isInterval: boolean;
    /** Modo por fases (definido no web) — estrutura E intensidade são derivadas
     *  dos segments; o sheet mobile edita só equipamento/observações. */
    isPhased: boolean;
    equipment: CardioEquipment | null;
    objective: CardioObjective;
    /** duration_minutes (time) ou distance_km (distance), conforme objective. */
    target: number | null;
    intensity: string;
    notes: string;
}

export interface CardioSheetEdits {
    equipment: CardioEquipment | null;
    objective: CardioObjective;
    target: number | null;
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

/** Lê um item_config cru (canônico OU legado mobile) para o estado do sheet. */
export function parseCardioConfig(raw: Record<string, unknown> | null | undefined): ParsedCardioConfig {
    const cfg = raw ?? {};
    const isInterval = cfg.mode === "interval";
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
        isInterval,
        isPhased,
        equipment,
        objective,
        target,
        intensity: typeof cfg.intensity === "string" ? cfg.intensity : "",
        notes: typeof cfg.notes === "string" ? cfg.notes : "",
    };
}

/**
 * Monta o item_config final: canônico, com merge sobre o config cru.
 * - Preserva campos que o sheet não edita (ex.: `intervals` + `mode` de um
 *   protocolo intervalado criado no web).
 * - Migra/strippa as chaves do legado mobile (`modality`, `target`).
 */
export function buildCardioConfig(
    raw: Record<string, unknown> | null | undefined,
    edits: CardioSheetEdits,
): Record<string, unknown> {
    const cfg = { ...(raw ?? {}) };
    const isInterval = cfg.mode === "interval";
    const isPhased = cfg.mode === "phased" && hasSegments(cfg);

    delete cfg.modality;
    delete cfg.target;

    cfg.mode = isInterval ? "interval" : isPhased ? "phased" : "continuous";
    if (edits.equipment) cfg.equipment = edits.equipment;
    else delete cfg.equipment;
    // Phased: intensity é DERIVADA dos segments (resumo) — o sheet não a edita.
    if (!isPhased) {
        if (edits.intensity.trim()) cfg.intensity = edits.intensity.trim();
        else delete cfg.intensity;
    }
    if (edits.notes.trim()) cfg.notes = edits.notes.trim();
    else delete cfg.notes;

    if (!isInterval && !isPhased) {
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
    }
    // Intervalado: objective/duration/distance/intervals ficam como o web gravou.
    // Phased: segments + duration_minutes/intensity derivados ficam intactos.

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

    return parts.length > 0 ? parts.join(" · ") : "Cardio livre";
}
