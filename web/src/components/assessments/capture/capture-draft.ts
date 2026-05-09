import type { MeasurementInput } from '@kinevo/shared/types/assessments'

// M10B — drafts de captura web (localStorage). Pareia com o draft mobile
// (MMKV em assessmentDraftStore) mas vive isolado por device — server é a
// fonte da verdade quando há divergência.
//
// Key pattern: `capture-draft:{sessionId}`. Conteúdo: array de
// MeasurementInput committed pelo trainer durante a sessão. Quando finalize
// for chamada com sucesso, draft é removido.

const KEY_PREFIX = 'capture-draft:'

interface CaptureDraftPayload {
    schema_version: number
    measurements: MeasurementInput[]
    saved_at: string
}

const DRAFT_SCHEMA_VERSION = 1

export function loadCaptureDraft(sessionId: string): MeasurementInput[] | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(KEY_PREFIX + sessionId)
        if (!raw) return null
        const parsed = JSON.parse(raw) as CaptureDraftPayload
        if (!parsed || parsed.schema_version !== DRAFT_SCHEMA_VERSION) return null
        if (!Array.isArray(parsed.measurements)) return null
        return parsed.measurements
    } catch {
        return null
    }
}

export function saveCaptureDraft(sessionId: string, measurements: MeasurementInput[]): void {
    if (typeof window === 'undefined') return
    try {
        const payload: CaptureDraftPayload = {
            schema_version: DRAFT_SCHEMA_VERSION,
            measurements,
            saved_at: new Date().toISOString(),
        }
        window.localStorage.setItem(KEY_PREFIX + sessionId, JSON.stringify(payload))
    } catch {
        // quota or disabled storage — fail silently
    }
}

export function clearCaptureDraft(sessionId: string): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(KEY_PREFIX + sessionId)
    } catch {
        // ignore
    }
}
