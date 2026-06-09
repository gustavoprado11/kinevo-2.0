import type { ProgramDraft } from '@/stores/program-builder-store';

/**
 * "Prateleira" de rascunhos de programa, separada do buffer de edição ativo
 * (`program-builder-store`). Permite MÚLTIPLOS rascunhos simultâneos chaveados
 * por contexto (um por aluno, um por modelo novo) — paridade com a web.
 *
 * O store ativo continua sendo o buffer de trabalho (um draft por vez); aqui
 * ficam os rascunhos "guardados" que aparecem na aba Programas de cada aluno
 * para o treinador retomar. Persistido em MMKV (namespace próprio), com
 * fallback in-memory no Expo Go — mesmo padrão dos outros stores.
 *
 * Escopo: apenas o fluxo de CRIAÇÃO (rascunho de aluno / modelo novo). Edição
 * de programa/modelo existente mantém o comportamento de reset ao sair.
 */

type Backend = {
    getString: (k: string) => string | undefined;
    set: (k: string, v: string) => void;
    remove: (k: string) => void;
};

let backend: Backend;
try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-program-drafts' });
    backend = {
        getString: (k: string) => mmkv.getString(k) ?? undefined,
        set: (k: string, v: string) => mmkv.set(k, v),
        remove: (k: string) => { mmkv.remove(k); },
    };
} catch {
    const mem = new Map<string, string>();
    backend = {
        getString: (k: string) => mem.get(k),
        set: (k: string, v: string) => { mem.set(k, v); },
        remove: (k: string) => { mem.delete(k); },
    };
}

const VERSION = 1;

interface StoredDraft {
    v: number;
    savedAt: number;
    draft: ProgramDraft;
}

export interface ProgramDraftSummary {
    key: string;
    name: string;
    workoutCount: number;
    savedAt: number;
    studentId: string | null;
}

/** Chave de contexto do rascunho. Mobile é single-user por device, então não
 *  precisa do trainerId na chave (diferente da web). */
export function draftKeyFor(draft: ProgramDraft): string | null {
    if (draft.editingAssignedProgramId) return `edit-assigned:${draft.editingAssignedProgramId}`;
    if (draft.editingTemplateId) return `edit-template:${draft.editingTemplateId}`;
    if (draft.studentId) return `student:${draft.studentId}`;
    return 'template:new';
}

/** Só fluxos de criação são guardados na prateleira. */
function isShelvableKey(key: string | null): key is string {
    return key === 'template:new' || (!!key && key.startsWith('student:'));
}

export function studentDraftKey(studentId: string): string {
    return `student:${studentId}`;
}

export function isProgramDraftMeaningful(draft: ProgramDraft): boolean {
    return draft.name.trim() !== '' || draft.workouts.some(w => w.items.length > 0);
}

/** Persiste o rascunho sob sua chave de contexto. No-op (e remove) para chaves
 *  não-guardáveis ou rascunho vazio. Retorna a chave usada ou null. */
export function saveProgramDraft(draft: ProgramDraft): string | null {
    const key = draftKeyFor(draft);
    if (!isShelvableKey(key)) return null;
    if (!isProgramDraftMeaningful(draft)) {
        removeProgramDraft(key);
        return null;
    }
    try {
        const payload: StoredDraft = { v: VERSION, savedAt: Date.now(), draft };
        backend.set(key, JSON.stringify(payload));
    } catch {
        /* quota/indisponível — falha silenciosa */
    }
    return key;
}

export function removeProgramDraft(key: string): void {
    try {
        backend.remove(key);
    } catch {
        /* noop */
    }
}

export function getProgramDraft(key: string): ProgramDraft | null {
    try {
        const raw = backend.getString(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredDraft;
        if (!parsed || parsed.v !== VERSION || !parsed.draft) return null;
        return parsed.draft;
    } catch {
        return null;
    }
}

/** Resumo do rascunho de um aluno (ou null), para a aba Programas. */
export function getStudentDraftSummary(studentId: string): ProgramDraftSummary | null {
    const key = studentDraftKey(studentId);
    try {
        const raw = backend.getString(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredDraft;
        if (!parsed || parsed.v !== VERSION || !parsed.draft) return null;
        if (!isProgramDraftMeaningful(parsed.draft)) return null;
        return {
            key,
            name: typeof parsed.draft.name === 'string' ? parsed.draft.name : '',
            workoutCount: Array.isArray(parsed.draft.workouts) ? parsed.draft.workouts.length : 0,
            savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
            studentId: parsed.draft.studentId ?? null,
        };
    } catch {
        return null;
    }
}
