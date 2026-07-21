// ============================================================================
// Kinevo — Zonas de FC e alvo de intensidade aeróbia (fonte única)
// ============================================================================
// Modelo clássico de 5 zonas por %FCmáx. Consumido pelo builder web, pelo
// mobile e pelo MCP para resolver "Zona N" na faixa de bpm do aluno
// (students.max_heart_rate_bpm) e para derivar a string `intensity` exibida
// em todas as superfícies legadas.

import type { CardioIntensityTarget } from '../../types/workout-items'

export interface HrZoneDef {
    zone: 1 | 2 | 3 | 4 | 5
    /** Fração inferior/superior da FCmáx (ex.: 0.6–0.7). */
    pctMin: number
    pctMax: number
    label: string
}

export const HR_ZONES: readonly HrZoneDef[] = [
    { zone: 1, pctMin: 0.5, pctMax: 0.6, label: 'Recuperação' },
    { zone: 2, pctMin: 0.6, pctMax: 0.7, label: 'Base aeróbia' },
    { zone: 3, pctMin: 0.7, pctMax: 0.8, label: 'Aeróbio moderado' },
    { zone: 4, pctMin: 0.8, pctMax: 0.9, label: 'Limiar' },
    { zone: 5, pctMin: 0.9, pctMax: 1.0, label: 'VO2max' },
] as const

export function zoneDef(zone: number): HrZoneDef | null {
    return HR_ZONES.find(z => z.zone === zone) ?? null
}

/** Faixa de bpm de uma zona para uma FCmáx. Null quando zona/FCmáx inválidas. */
export function resolveZoneBpm(
    zone: number,
    maxHrBpm: number | null | undefined,
): { min: number; max: number } | null {
    const def = zoneDef(zone)
    if (!def || !maxHrBpm || maxHrBpm <= 0) return null
    return {
        min: Math.round(def.pctMin * maxHrBpm),
        max: Math.round(def.pctMax * maxHrBpm),
    }
}

/** Faixa da zona em %FCmáx, para exibição sem FCmáx conhecida ("60–70% FCmáx"). */
export function zonePctLabel(zone: number): string | null {
    const def = zoneDef(zone)
    if (!def) return null
    return `${Math.round(def.pctMin * 100)}–${Math.round(def.pctMax * 100)}% FCmáx`
}

/**
 * String humana do alvo de intensidade — é ela que vai para o campo legado
 * `intensity` do item_config (todas as superfícies de exibição já a mostram).
 *   zone + FCmáx → "Zona 2 · 114–133 bpm"
 *   zone sem FCmáx → "Zona 2 · 60–70% FCmáx"
 *   hr → "130–150 bpm" · rpe → "RPE 7" · pace → "Pace 5:30 /km"
 */
export function formatIntensityTarget(
    target: CardioIntensityTarget | null | undefined,
    maxHrBpm?: number | null,
): string | null {
    if (!target) return null
    switch (target.type) {
        case 'zone': {
            if (!target.zone) return null
            const bpm = resolveZoneBpm(target.zone, maxHrBpm)
            const range = bpm ? `${bpm.min}–${bpm.max} bpm` : zonePctLabel(target.zone)
            return range ? `Zona ${target.zone} · ${range}` : `Zona ${target.zone}`
        }
        case 'hr': {
            if (target.hr_min_bpm == null || target.hr_max_bpm == null) return null
            return `${target.hr_min_bpm}–${target.hr_max_bpm} bpm`
        }
        case 'rpe':
            return target.rpe != null ? `RPE ${target.rpe}` : null
        case 'pace':
            return target.pace_min_per_km ? `Pace ${target.pace_min_per_km} /km` : null
        default:
            return null
    }
}
