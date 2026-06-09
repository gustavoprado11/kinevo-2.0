'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Persistência de rascunho do builder de programa.
 *
 * Motivação: o `ProgramBuilderClient` mantém TODO o programa em construção em
 * estado React volátil. Qualquer interrupção (refresh, sessão expirada, erro,
 * fechar a aba, voltar) apagava o trabalho não salvo — o treinador relatava o
 * treino "sumindo totalmente" enquanto montava.
 *
 * Este hook salva um snapshot serializável em `localStorage` (debounce + flush
 * na saída), avisa via `beforeunload` quando há alterações não salvas e expõe
 * um rascunho pendente para o componente oferecer restauração. É genérico
 * sobre o formato do snapshot para não acoplar aos tipos internos do builder.
 *
 * Os helpers puros (`buildDraftKey`, `listBuilderDrafts`, …) são reusados pelo
 * card de rascunhos do dashboard.
 */

const DRAFT_VERSION = 1
const DRAFT_KEY_BASE = 'kinevo:builder-draft:v1'
const DEBOUNCE_MS = 800

export interface StoredDraft<T> {
    v: number
    savedAt: number
    data: T
}

// ── Helpers de chave/rota (puros, reusados pelo dashboard) ──

export function buildDraftKey(opts: {
    trainerId: string
    isEditing: boolean
    programId?: string | null
    isStudentContext: boolean
    studentId?: string | null
}): string | null {
    const base = `${DRAFT_KEY_BASE}:${opts.trainerId}`
    if (opts.isEditing && opts.programId) return `${base}:edit:${opts.programId}`
    if (opts.isStudentContext && opts.studentId) return `${base}:student:${opts.studentId}`
    if (!opts.isStudentContext && !opts.isEditing) return `${base}:template:new`
    return null
}

/** Mapeia uma chave de rascunho de volta para a rota do builder que a originou. */
export function draftKeyToRoute(key: string, trainerId: string): string | null {
    const prefix = `${DRAFT_KEY_BASE}:${trainerId}:`
    if (!key.startsWith(prefix)) return null
    const [kind, id] = key.slice(prefix.length).split(':')
    if (kind === 'edit' && id) return `/programs/${id}`
    if (kind === 'student' && id) return `/students/${id}/program/new`
    if (kind === 'template') return '/programs/new'
    return null
}

export interface BuilderDraftSummary {
    key: string
    name: string
    workoutCount: number
    savedAt: number
    route: string
}

/** Lê todos os rascunhos do treinador no localStorage (client-only). */
export function listBuilderDrafts(trainerId: string): BuilderDraftSummary[] {
    if (typeof window === 'undefined') return []
    const prefix = `${DRAFT_KEY_BASE}:${trainerId}:`
    const out: BuilderDraftSummary[] = []
    try {
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (!key || !key.startsWith(prefix)) continue
            const raw = window.localStorage.getItem(key)
            if (!raw) continue
            try {
                const parsed = JSON.parse(raw) as StoredDraft<{ name?: unknown; workouts?: unknown }>
                if (!parsed || parsed.v !== DRAFT_VERSION || !parsed.data) continue
                const route = draftKeyToRoute(key, trainerId)
                if (!route) continue
                out.push({
                    key,
                    name: typeof parsed.data.name === 'string' ? parsed.data.name : '',
                    workoutCount: Array.isArray(parsed.data.workouts) ? parsed.data.workouts.length : 0,
                    savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
                    route,
                })
            } catch {
                /* entrada corrompida — ignora */
            }
        }
    } catch {
        /* storage indisponível */
    }
    return out.sort((a, b) => b.savedAt - a.savedAt)
}

/** Lê o resumo de um único rascunho a partir da sua chave (client-only). */
export function readDraftSummary(key: string, trainerId: string): BuilderDraftSummary | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as StoredDraft<{ name?: unknown; workouts?: unknown }>
        if (!parsed || parsed.v !== DRAFT_VERSION || !parsed.data) return null
        const route = draftKeyToRoute(key, trainerId)
        if (!route) return null
        return {
            key,
            name: typeof parsed.data.name === 'string' ? parsed.data.name : '',
            workoutCount: Array.isArray(parsed.data.workouts) ? parsed.data.workouts.length : 0,
            savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
            route,
        }
    } catch {
        return null
    }
}

export function removeBuilderDraft(key: string): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(key)
    } catch {
        /* noop */
    }
}

// ── Hook ──

interface UseBuilderDraftOptions<T> {
    /** Chave de storage já escopada ao contexto (use `buildDraftKey`).
     *  `null` desliga completamente a persistência. */
    storageKey: string | null
    /** Snapshot atual do estado do builder (recriado a cada render). */
    snapshot: T
    /** Quando `false`, não salva nem dispara aviso de saída (ex.: durante a
     *  animação de revelação da IA, antes do handoff para edição manual). */
    enabled: boolean
    /** Decide se o snapshot tem conteúdo que vale a pena persistir/restaurar.
     *  Evita salvar o estado inicial vazio como rascunho. */
    isMeaningful: (snapshot: T) => boolean
}

interface UseBuilderDraftResult<T> {
    /** Rascunho encontrado no mount (ou `null`). */
    pendingDraft: StoredDraft<T> | null
    /** Esconde o banner sem apagar o rascunho do storage. */
    dismissPending: () => void
    /** Esconde o banner E remove o rascunho pendente, sem parar a persistência
     *  de edições futuras. */
    discardPending: () => void
    /** Apaga o rascunho do storage e cancela escrita pendente. Chamar após
     *  salvar com sucesso. Não desativa permanentemente — edições futuras
     *  voltam a ser persistidas. */
    clearDraft: () => void
    /** `true` quando há alterações não salvas relevantes. */
    isDirty: boolean
    /** Persiste imediatamente (bypass do debounce). Usado ao sair. */
    flush: () => void
    /** Re-baseia a detecção de dirty para o snapshot dado (usado ao restaurar
     *  um rascunho automaticamente). */
    markPristine: (snapshot: T) => void
}

function safeStringify(value: unknown): string | null {
    try {
        return JSON.stringify(value)
    } catch {
        return null
    }
}

export function useBuilderDraft<T>({
    storageKey,
    snapshot,
    enabled,
    isMeaningful,
}: UseBuilderDraftOptions<T>): UseBuilderDraftResult<T> {
    // Leitura one-shot no mount. Initializer puro (sem efeitos colaterais).
    const [pendingDraft, setPendingDraft] = useState<StoredDraft<T> | null>(() => {
        if (typeof window === 'undefined' || !storageKey) return null
        try {
            const raw = window.localStorage.getItem(storageKey)
            if (!raw) return null
            const parsed = JSON.parse(raw) as StoredDraft<T>
            if (!parsed || parsed.v !== DRAFT_VERSION || !isMeaningful(parsed.data)) return null
            return parsed
        } catch {
            return null
        }
    })

    const dismissPending = useCallback(() => setPendingDraft(null), [])

    // Baseline serializado capturado uma única vez no mount (useState lazy).
    const [initialSerialized, setInitialSerialized] = useState<string | null>(() => safeStringify(snapshot))
    const serialized = enabled ? safeStringify(snapshot) : null

    // Derivado no render — sempre atual, sem setState dentro de efeito.
    const meaningful = isMeaningful(snapshot)
    const isDirty = enabled && serialized !== null && serialized !== initialSerialized && meaningful

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dirtyRef = useRef(false)
    // Último payload pronto para escrita; usado pelo flush (saída/unmount).
    const latestPayloadRef = useRef<StoredDraft<T> | null>(null)
    // Parada permanente após salvar com sucesso: impede que um re-render
    // tardio (ex.: setSaving(false) no finally) ressuscite o rascunho limpo.
    const clearedRef = useRef(false)
    // Marca que o baseline atual veio de um rascunho restaurado (não do seed
    // inicial). Quando true, "current === baseline" NÃO significa "voltou ao
    // vazio" — então não apagamos o rascunho recém-restaurado.
    const restoredRef = useRef(false)

    const flush = useCallback(() => {
        if (clearedRef.current) return
        if (typeof window === 'undefined' || !storageKey) return
        const payload = latestPayloadRef.current
        if (!payload) return
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        const out = safeStringify(payload)
        if (out === null) return
        try {
            window.localStorage.setItem(storageKey, out)
        } catch {
            /* quota/privado */
        }
    }, [storageKey])

    const clearDraft = useCallback(() => {
        clearedRef.current = true
        dirtyRef.current = false
        latestPayloadRef.current = null
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        if (typeof window === 'undefined' || !storageKey) return
        try {
            window.localStorage.removeItem(storageKey)
        } catch {
            /* noop */
        }
    }, [storageKey])

    // Descarta o rascunho PENDENTE (sessão anterior) sem parar a persistência:
    // some o banner, remove a chave, mas edições futuras voltam a ser salvas.
    const discardPending = useCallback(() => {
        setPendingDraft(null)
        if (typeof window === 'undefined' || !storageKey) return
        try {
            window.localStorage.removeItem(storageKey)
        } catch {
            /* noop */
        }
    }, [storageKey])

    // Re-baseia a detecção de "dirty" para o snapshot dado. Usado ao restaurar
    // um rascunho automaticamente: o conteúdo restaurado vira o estado "limpo",
    // então sair sem editar não dispara aviso nem apaga o rascunho.
    const markPristine = useCallback((snap: T) => {
        restoredRef.current = true
        setInitialSerialized(safeStringify(snap))
    }, [])

    // Autosave (debounced) + manutenção de dirtyRef/latestPayload (refs, sem
    // setState — escrita de ref em efeito é permitida).
    useEffect(() => {
        if (clearedRef.current) return
        dirtyRef.current = isDirty
        latestPayloadRef.current = isDirty
            ? { v: DRAFT_VERSION, savedAt: Date.now(), data: snapshot }
            : null

        if (!enabled || !storageKey || serialized === null) return

        // Voltou ao baseline: se o baseline for o seed inicial, significa
        // "desfez tudo" → remove rascunho antigo. Se veio de um rascunho
        // restaurado, current === baseline é o estado normal → mantém.
        // Só removemos quando é claramente "desfez tudo até o seed inicial":
        // baseline não-restaurado E sem rascunho pendente aguardando restauração.
        // (No mount de um reopen, o 1º render ainda mostra o seed e este efeito
        // roda ANTES da auto-restauração — sem a checagem de pendingDraft, ele
        // apagaria o rascunho que está prestes a ser restaurado.)
        if (serialized === initialSerialized) {
            if (!restoredRef.current && !pendingDraft) {
                try {
                    window.localStorage.removeItem(storageKey)
                } catch {
                    /* noop */
                }
            }
            return
        }

        if (!isDirty) return

        timerRef.current = setTimeout(() => {
            const out = safeStringify(latestPayloadRef.current)
            if (out === null) return
            try {
                window.localStorage.setItem(storageKey, out)
            } catch {
                /* quota/privado — falha silenciosa */
            }
        }, DEBOUNCE_MS)

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [serialized, initialSerialized, enabled, storageKey, snapshot, isDirty, pendingDraft])

    // Flush na desmontagem — cobre voltar/navegação SPA mesmo dentro da janela
    // de debounce. flushRef mantém a referência atual sem reanexar o efeito.
    const flushRef = useRef(flush)
    useEffect(() => {
        flushRef.current = flush
    }, [flush])
    useEffect(() => () => flushRef.current(), [])

    // Aviso nativo ao fechar/recarregar com alterações não salvas.
    useEffect(() => {
        if (typeof window === 'undefined') return
        const handler = (e: BeforeUnloadEvent) => {
            if (!dirtyRef.current) return
            // Persiste o estado mais recente síncronamente (fecha a janela do
            // debounce) antes de pedir confirmação de saída.
            flushRef.current()
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [])

    return { pendingDraft, dismissPending, discardPending, clearDraft, isDirty, flush, markPristine }
}
