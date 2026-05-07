import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
    AssessmentTemplateSchema,
    MeasurementInput,
    AssessmentSessionStatus,
} from '@kinevo/shared/types/assessments';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------
// Identical pattern to mobile/stores/program-builder-store.ts and
// mobile/stores/training-room-store.ts. Use `id: 'kinevo-assessment-draft'`
// to namespace MMKV.

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-assessment-draft' });
    storageBackend = {
        getItem: (name: string) => mmkv.getString(name) ?? null,
        setItem: (name: string, value: string) => mmkv.set(name, value),
        removeItem: (name: string) => { mmkv.remove(name); },
    };
} catch {
    const memoryStore = new Map<string, string>();
    storageBackend = {
        getItem: (name: string) => memoryStore.get(name) ?? null,
        setItem: (name: string, value: string) => { memoryStore.set(name, value); },
        removeItem: (name: string) => { memoryStore.delete(name); },
    };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Schema version for the persisted draft payload. Bump on backwards-incompatible
 * shape changes; see `migrate` in the persist config below.
 */
export const DRAFT_SCHEMA_VERSION = 1;

/**
 * Garbage-collection horizon. Drafts whose `last_synced_at` is older than this
 * are purged silently on app mount (see `gcStaleDrafts`).
 */
export const STALE_DRAFT_HORIZON_DAYS = 7;

/**
 * One in-progress assessment session being captured locally. Each measurement
 * goes into `measurements` first; sync to the backend happens in batches.
 */
export interface AssessmentDraft {
    /** draft_schema_version is preserved per-draft so a future migration can
     *  fix individual drafts even after the global version bumps. */
    draft_schema_version: number;

    session_id: string;
    student_id: string;
    student_name: string;
    student_avatar: string | null;
    template_id: string | null;
    template_title: string | null;
    template_snapshot: AssessmentTemplateSchema | null;

    status: AssessmentSessionStatus;

    /** Measurements already captured locally. May or may not be synced.
     *
     *  Sync tracking lives inside each measurement's `raw_input._synced`
     *  boolean: rows with `_synced=false` (or missing) are pending and
     *  will be sent on the next syncBatch; `markSynced` flips them to
     *  `true` after a successful RPC. We use raw_input (already a free-
     *  form JSONB column) instead of a separate table because the RPC is
     *  INSERT-only and we need the dedup to live client-side. The flag
     *  is stripped before the RPC payload is built. */
    measurements: MeasurementInput[];

    /** Test currently being measured in the wizard, null between tests. */
    current_test_id: string | null;

    /** Multi-attempt scratch space: testId → array of numeric attempts. */
    current_attempts: Record<string, number[]>;

    /** True when the local draft has unsynced changes. */
    is_dirty: boolean;

    /** ISO timestamp of last successful sync to backend (null = never). */
    last_synced_at: string | null;

    /** ISO timestamp of last local touch (created_at on creation, every edit). */
    last_touched_at: string;

    /** Notes typed by the trainer for this session. */
    notes: string;
}

interface AssessmentDraftState {
    /** Map of session_id → draft. Multiple drafts coexist (decision B). */
    drafts: Record<string, AssessmentDraft>;

    /** session_id of the draft currently in foreground (for crash-recovery
     *  pinned section). null when no session is active. */
    activeSessionId: string | null;

    // ---- Actions ----

    /** Create or replace a draft. Idempotent on session_id. */
    upsertDraft: (
        draft: Omit<AssessmentDraft, 'draft_schema_version' | 'last_touched_at'>,
    ) => void;

    /** Remove a draft (used after a successful finalize). */
    removeDraft: (sessionId: string) => void;

    setActiveSession: (sessionId: string | null) => void;

    /** Append a measurement to a draft and mark it dirty. */
    appendMeasurement: (sessionId: string, measurement: MeasurementInput) => void;

    /** Replace all measurements for a given testId (used by multi-attempt). */
    replaceMeasurementsForTest: (
        sessionId: string,
        testId: string,
        measurements: MeasurementInput[],
    ) => void;

    /** Update the multi-attempt scratch buffer for a test. */
    setAttempts: (sessionId: string, testId: string, attempts: number[]) => void;

    /** Drop the multi-attempt scratch buffer for one testId (used after a
     *  multi-attempt measurement is committed — keeps old tries from
     *  resurfacing if the trainer comes back to redo). */
    clearAttemptsBuffer: (sessionId: string, testId: string) => void;

    setCurrentTestId: (sessionId: string, testId: string | null) => void;

    setNotes: (sessionId: string, notes: string) => void;

    /** Mark every currently-pending measurement as synced and clear the
     *  `is_dirty` flag. Stamps `last_synced_at`. */
    markSynced: (sessionId: string, syncedAtISO?: string) => void;

    /** Mark dirty (used by appendMeasurement, exposed for tests). */
    markDirty: (sessionId: string) => void;

    /** Garbage-collect drafts older than STALE_DRAFT_HORIZON_DAYS by
     *  last_synced_at OR last_touched_at — whichever is more recent. Logs
     *  in __DEV__ when something is purged. */
    gcStaleDrafts: () => void;

    /** Selectors */
    getDraft: (sessionId: string) => AssessmentDraft | undefined;
    getActiveDraft: () => AssessmentDraft | undefined;
    listDrafts: () => AssessmentDraft[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const nowISO = () => new Date().toISOString();

export const useAssessmentDraftStore = create<AssessmentDraftState>()(
    persist(
        (set, get) => ({
            drafts: {},
            activeSessionId: null,

            upsertDraft: (draft) => {
                set((state) => ({
                    drafts: {
                        ...state.drafts,
                        [draft.session_id]: {
                            ...draft,
                            draft_schema_version: DRAFT_SCHEMA_VERSION,
                            last_touched_at: nowISO(),
                        },
                    },
                }));
            },

            removeDraft: (sessionId) => {
                set((state) => {
                    if (!state.drafts[sessionId]) return state;
                    const { [sessionId]: _removed, ...rest } = state.drafts;
                    return {
                        drafts: rest,
                        activeSessionId:
                            state.activeSessionId === sessionId ? null : state.activeSessionId,
                    };
                });
            },

            setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

            appendMeasurement: (sessionId, measurement) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                measurements: [...d.measurements, measurement],
                                is_dirty: true,
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            replaceMeasurementsForTest: (sessionId, testId, measurements) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    // Remove any prior measurement linked to this testId via a
                    // raw_input.test_id marker (set by the wizard) — keeps
                    // history clean when retrying.
                    const kept = d.measurements.filter(
                        (m) => (m.raw_input as { test_id?: string } | null | undefined)?.test_id !== testId,
                    );
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                measurements: [...kept, ...measurements],
                                is_dirty: true,
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            setAttempts: (sessionId, testId, attempts) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                current_attempts: { ...d.current_attempts, [testId]: attempts },
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            clearAttemptsBuffer: (sessionId, testId) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d || !(testId in d.current_attempts)) return state;
                    const { [testId]: _drop, ...rest } = d.current_attempts;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                current_attempts: rest,
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            setCurrentTestId: (sessionId, testId) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                current_test_id: testId,
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            setNotes: (sessionId, notes) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                notes,
                                is_dirty: true,
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            markSynced: (sessionId, syncedAtISO) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                is_dirty: false,
                                measurements: d.measurements.map((m) => ({
                                    ...m,
                                    raw_input: {
                                        ...((m.raw_input as Record<string, unknown> | null | undefined) ?? {}),
                                        _synced: true,
                                    },
                                })),
                                last_synced_at: syncedAtISO ?? nowISO(),
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            markDirty: (sessionId) => {
                set((state) => {
                    const d = state.drafts[sessionId];
                    if (!d) return state;
                    return {
                        drafts: {
                            ...state.drafts,
                            [sessionId]: {
                                ...d,
                                is_dirty: true,
                                last_touched_at: nowISO(),
                            },
                        },
                    };
                });
            },

            gcStaleDrafts: () => {
                const horizonMs = STALE_DRAFT_HORIZON_DAYS * 24 * 60 * 60 * 1000;
                const now = Date.now();
                const purged: string[] = [];
                set((state) => {
                    const next: Record<string, AssessmentDraft> = {};
                    for (const [id, d] of Object.entries(state.drafts)) {
                        const ref = d.last_synced_at ?? d.last_touched_at;
                        const refMs = ref ? Date.parse(ref) : 0;
                        if (now - refMs > horizonMs) {
                            purged.push(id);
                            continue;
                        }
                        next[id] = d;
                    }
                    if (purged.length === 0) return state;
                    return {
                        drafts: next,
                        activeSessionId:
                            state.activeSessionId && purged.includes(state.activeSessionId)
                                ? null
                                : state.activeSessionId,
                    };
                });
                if (__DEV__ && purged.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log(
                        `[assessmentDraftStore] gcStaleDrafts purged ${purged.length} draft(s):`,
                        purged,
                    );
                }
            },

            getDraft: (sessionId) => get().drafts[sessionId],

            getActiveDraft: () => {
                const id = get().activeSessionId;
                return id ? get().drafts[id] : undefined;
            },

            listDrafts: () => Object.values(get().drafts),
        }),
        {
            name: 'kinevo-assessment-draft-v1',
            version: DRAFT_SCHEMA_VERSION,
            storage: createJSONStorage(() => storageBackend),
            // Only persist drafts + activeSessionId. Selectors / actions are
            // ephemeral.
            partialize: (state) => ({
                drafts: state.drafts,
                activeSessionId: state.activeSessionId,
            }),
            // Forwards-compat: when DRAFT_SCHEMA_VERSION bumps, drop drafts
            // with stale per-draft schema. Keeps the contract simple.
            migrate: (persisted: unknown, _version: number) => {
                if (!persisted || typeof persisted !== 'object') {
                    return { drafts: {}, activeSessionId: null };
                }
                const p = persisted as Partial<AssessmentDraftState>;
                const validDrafts: Record<string, AssessmentDraft> = {};
                for (const [id, d] of Object.entries(p.drafts ?? {})) {
                    if (d && (d as AssessmentDraft).draft_schema_version === DRAFT_SCHEMA_VERSION) {
                        validDrafts[id] = d as AssessmentDraft;
                    }
                }
                return {
                    drafts: validDrafts,
                    activeSessionId:
                        p.activeSessionId && validDrafts[p.activeSessionId] ? p.activeSessionId : null,
                };
            },
        },
    ),
);
