import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------
// Espelha o pattern de assessmentDraftStore.ts mas com namespace dedicado
// 'kinevo-assessment-template-draft'. Drafts de TEMPLATE são leves
// (sem measurements/attempts) — só title/description/schema/touched_at.

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-assessment-template-draft' });
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

export const TEMPLATE_DRAFT_SCHEMA_VERSION = 1;

/** Garbage-collection horizon: drafts intocados há mais de N dias somem
 *  silenciosamente no mount. */
export const STALE_TEMPLATE_DRAFT_HORIZON_DAYS = 14;

/** Chave usada quando o trainer está criando um template novo (ainda sem id). */
export const NEW_TEMPLATE_DRAFT_KEY = '__new__';

export interface AssessmentTemplateDraft {
    draft_schema_version: number;
    /** id do template existente OU NEW_TEMPLATE_DRAFT_KEY pra criação. */
    template_key: string;
    title: string;
    description: string | null;
    schema: AssessmentTemplateSchema;
    last_touched_at: string;
}

interface AssessmentTemplateDraftState {
    drafts: Record<string, AssessmentTemplateDraft>;

    /** Cria/atualiza um draft. Idempotente em template_key. */
    upsertDraft: (
        draft: Omit<AssessmentTemplateDraft, 'draft_schema_version' | 'last_touched_at'>,
    ) => void;

    /** Remove um draft (após save com sucesso ou descarte explícito). */
    removeDraft: (templateKey: string) => void;

    getDraft: (templateKey: string) => AssessmentTemplateDraft | undefined;

    /** Garbage-collect drafts antigos (silencioso). */
    gcStaleDrafts: () => void;
}

const nowISO = () => new Date().toISOString();

export const useAssessmentTemplateDraftStore = create<AssessmentTemplateDraftState>()(
    persist(
        (set, get) => ({
            drafts: {},

            upsertDraft: (draft) => {
                set((state) => ({
                    drafts: {
                        ...state.drafts,
                        [draft.template_key]: {
                            ...draft,
                            draft_schema_version: TEMPLATE_DRAFT_SCHEMA_VERSION,
                            last_touched_at: nowISO(),
                        },
                    },
                }));
            },

            removeDraft: (templateKey) => {
                set((state) => {
                    if (!state.drafts[templateKey]) return state;
                    const { [templateKey]: _removed, ...rest } = state.drafts;
                    return { drafts: rest };
                });
            },

            getDraft: (templateKey) => get().drafts[templateKey],

            gcStaleDrafts: () => {
                const horizon = Date.now() - STALE_TEMPLATE_DRAFT_HORIZON_DAYS * 24 * 60 * 60 * 1000;
                set((state) => {
                    const fresh: Record<string, AssessmentTemplateDraft> = {};
                    let purged = 0;
                    for (const [key, draft] of Object.entries(state.drafts)) {
                        const touched = new Date(draft.last_touched_at).getTime();
                        if (touched >= horizon) {
                            fresh[key] = draft;
                        } else {
                            purged += 1;
                        }
                    }
                    if (purged > 0 && __DEV__) {
                        console.log(`[assessmentTemplateDraft] GC purged ${purged} stale drafts`);
                    }
                    return purged > 0 ? { drafts: fresh } : state;
                });
            },
        }),
        {
            name: 'kinevo-assessment-template-draft',
            version: TEMPLATE_DRAFT_SCHEMA_VERSION,
            storage: createJSONStorage(() => storageBackend),
        },
    ),
);
