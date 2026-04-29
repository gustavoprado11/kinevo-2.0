// ============================================================================
// Set meta label — unified "Meta: X reps · RIR Y · Tempo Z" string
// ============================================================================
// Single source of truth for the meta line shown above each phase row in
// the student execution, the trainer live-coaching room and the web mock
// preview in the builder. Reps + RIR + Tempo live on the same line so the
// trainer's prescription is communicated end-to-end.
//
// What this DOES include:
//   - Reps target (with AMRAP / cluster special formatting)
//   - RIR (when prescribed; RIR=0 IS valid — it means "to failure")
//   - Cadência (when prescribed; empty string treated as not prescribed).
//     Internal field is `tempo` (kept as-is across DB column, type and
//     payload). The user-facing label was renamed to "Cadência" in
//     Fase 4.5h to match BR personal-training jargon — "Tempo" was
//     confusing because it overlaps with chronological time.
//
// What this does NOT include:
//   - Carga / weight target → buildWeightMetaLabel renders that above the
//     weight input, separate column.
//   - Descanso → consumed by the rest timer overlay; never inline.
//
// Returns an empty string when nothing was prescribed — caller can use that
// to decide whether to render the meta line at all.

/** Structural input — only the fields we need. Compatible with `WorkoutSet`
 *  from `@kinevo/shared/types/prescription` AND with the local
 *  `SetPrescription` shape used by the mobile execution / web preview. */
export interface SetMetaInput {
    /** Free-form rep target: "10", "8-12", "AMRAP", "5+5+5" (cluster). */
    reps?: string | null
    /** Reps in reserve target. `0` is a valid prescription (= "to failure"). */
    rir?: number | null
    /** Cadência string, e.g. "3-1-1-0" (concêntrica-pausa-excêntrica-pausa).
     *  Internal property name is kept as `tempo` for DB / payload
     *  compatibility — only the user-facing label is "Cadência" (Fase 4.5h).
     *  Empty string treated as not prescribed. */
    tempo?: string | null
}

const isClusterReps = (reps: string) => reps.includes('+')

/** Reconhece prescrições "vai até não conseguir mais" no campo reps em
 *  texto livre. Cobre `AMRAP`, `falha` e `máximo` (com ou sem acento) —
 *  todas semanticamente equivalentes pro aluno. Exportado pra ser usado
 *  na UI do builder (auto-fill ao escolher tipo Falha) e na execução
 *  (mobile + preview web) sem duplicar regex. */
export const isAmrapReps = (reps: string): boolean =>
    /amrap|falha|m[áa]ximo/i.test(reps)

/** Build the unified meta line shown above each phase row.
 *
 *  - Reps part is always first (when prescribed). Special formats:
 *    - "AMRAP" / "até a falha" → "Meta: até a falha"
 *    - cluster ("5+5+5") → "Meta: 5+5+5 · cluster"
 *    - default → "Meta: 10 reps"
 *  - RIR is appended as "· RIR N" when not null/undefined. `0` is valid.
 *  - Cadência is appended as "· Cadência 3-1-1-0" when present (non-empty
 *    trimmed). Internal field is still `tempo`; only the rendered string
 *    was renamed in Fase 4.5h.
 *
 *  Returns `''` when nothing was prescribed — caller decides whether to
 *  hide the line entirely. */
export const buildSetMetaLabel = (set: SetMetaInput): string => {
    const parts: string[] = []

    const repsRaw = (set.reps ?? '').trim()
    if (repsRaw.length > 0) {
        if (isAmrapReps(repsRaw)) {
            parts.push('Meta: até a falha')
        } else if (isClusterReps(repsRaw)) {
            parts.push(`Meta: ${repsRaw} · cluster`)
        } else {
            parts.push(`Meta: ${repsRaw} reps`)
        }
    }

    // RIR=0 means "to failure" — valid prescription. Only hide for null/undefined.
    if (set.rir !== null && set.rir !== undefined && Number.isFinite(set.rir)) {
        parts.push(`RIR ${set.rir}`)
    }

    const tempoRaw = (set.tempo ?? '').trim()
    if (tempoRaw.length > 0) {
        parts.push(`Cadência ${tempoRaw}`)
    }

    return parts.join(' · ')
}
