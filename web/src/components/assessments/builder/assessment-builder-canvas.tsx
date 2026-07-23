'use client'

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2, Plus, Save } from 'lucide-react'
import type {
    AssessmentSection,
    AssessmentTemplateSchema,
    AssessmentTest,
} from '@kinevo/shared/types/assessments'
import { TestLibraryColumn } from './test-library-column'
import { TestPropertiesPanel } from './test-properties-panel'
import { SectionEditor } from './section-editor'
import { TEST_CATALOG, type CatalogEntry } from './test-catalog'

interface AssessmentBuilderCanvasProps {
    /**
     * Existing template id (when editing). Used as the localStorage draft key.
     * `null` means a brand-new template — drafts use 'new' key.
     */
    templateId: string | null
    initialTitle: string
    initialDescription?: string | null
    initialSchema: AssessmentTemplateSchema
    onSave: (payload: {
        title: string
        description: string | null
        schema: AssessmentTemplateSchema
    }) => Promise<{ success: boolean; error?: string }>
    onCancel?: () => void
    saving?: boolean
    /**
     * Quando false, o canvas não renderiza topbar próprio (header com voltar/
     * salvar). Usado pelo M8 BuilderShell que substitui essa UI por uma
     * versão compartilhada com o form builder. O caller pode acessar o
     * estado de save via `onStateChange` callback.
     */
    renderTopbar?: boolean
    /**
     * Notifica o caller quando o estado de save/dirty/canSave muda. Usado
     * pelo BuilderShell pra refletir esses estados no header externo.
     */
    onStateChange?: (state: {
        title: string
        isDirty: boolean
        canSave: boolean
        save: () => Promise<void>
    }) => void
}

const EMPTY_SCHEMA: AssessmentTemplateSchema = {
    schema_version: '1.0',
    sections: [],
}

function genId(prefix: string) {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}_${crypto.randomUUID().split('-')[0]}`
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function draftKey(templateId: string | null): string {
    return `assessment-builder-draft:${templateId ?? 'new'}`
}

interface DraftPayload {
    title: string
    description: string | null
    schema: AssessmentTemplateSchema
    savedAt: number
}

export function AssessmentBuilderCanvas({
    templateId,
    initialTitle,
    initialDescription,
    initialSchema,
    onSave,
    onCancel,
    saving = false,
    renderTopbar = true,
    onStateChange,
}: AssessmentBuilderCanvasProps) {
    const [title, setTitle] = useState(initialTitle)
    const [description, setDescription] = useState(initialDescription ?? '')
    const [schema, setSchema] = useState<AssessmentTemplateSchema>(() =>
        initialSchema?.sections?.length ? initialSchema : { ...EMPTY_SCHEMA, sections: [] },
    )
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null)
    const [propsPanelOpen, setPropsPanelOpen] = useState(false)
    const [draggingCatalogId, setDraggingCatalogId] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [restoredFromDraft, setRestoredFromDraft] = useState(false)

    const initialSnapshotRef = useRef<string>(JSON.stringify({ title: initialTitle, description: initialDescription ?? '', schema }))

    // Restore draft on mount, if any. We only restore newer-than-init drafts.
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = window.localStorage.getItem(draftKey(templateId))
            if (!raw) return
            const draft = JSON.parse(raw) as DraftPayload
            if (!draft || !draft.schema) return
            const initSnap = JSON.stringify({ title: initialTitle, description: initialDescription ?? '', schema: initialSchema })
            const draftSnap = JSON.stringify({ title: draft.title, description: draft.description, schema: draft.schema })
            if (initSnap === draftSnap) return // identical, skip
            setTitle(draft.title)
            setDescription(draft.description ?? '')
            setSchema(draft.schema)
            setRestoredFromDraft(true)
            setDirty(true)
        } catch {
            // corrupt draft — ignore silently
        }
        // run once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Autosave draft to localStorage on every change (debounced via rAF coalesce)
    const draftWriteScheduled = useRef(false)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const snap = JSON.stringify({ title, description: description || null, schema })
        const isPristine = snap === initialSnapshotRef.current
        setDirty(!isPristine)
        if (!isPristine) {
            if (draftWriteScheduled.current) return
            draftWriteScheduled.current = true
            requestAnimationFrame(() => {
                draftWriteScheduled.current = false
                try {
                    window.localStorage.setItem(
                        draftKey(templateId),
                        JSON.stringify({
                            title,
                            description: description || null,
                            schema,
                            savedAt: Date.now(),
                        }),
                    )
                } catch {
                    // quota or disabled storage — fail silently
                }
            })
        }
    }, [title, description, schema, templateId])

    // Track viewport for responsive props-panel (modal under 1100px).
    const [isCompact, setIsCompact] = useState(false)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const mq = window.matchMedia('(max-width: 1099px)')
        const sync = () => setIsCompact(mq.matches)
        sync()
        mq.addEventListener('change', sync)
        return () => mq.removeEventListener('change', sync)
    }, [])

    // ─── Validation ────────────────────────────────────────────────
    const allTests = useMemo(
        () => schema.sections.flatMap(s => s.tests),
        [schema.sections],
    )

    const duplicateMetricKeys = useMemo(() => {
        const counts = new Map<string, number>()
        for (const t of allTests) {
            const k = (t as { metric_key?: string }).metric_key ?? ''
            if (!k) continue
            counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k))
    }, [allTests])

    const titleValid = title.trim().length > 0
    const hasSections = schema.sections.length > 0
    const hasTests = allTests.length > 0
    const canSave =
        !saving
        && titleValid
        && hasSections
        && hasTests
        && duplicateMetricKeys.size === 0

    // Propaga estado pra um shell externo (M8 BuilderShell) quando esse
    // canvas é montado sem topbar próprio.
    const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
    useEffect(() => {
        onStateChange?.({
            title,
            isDirty: dirty,
            canSave,
            save: () => handleSaveRef.current(),
        })
    }, [title, dirty, canSave, onStateChange])

    // ─── Mutations ─────────────────────────────────────────────────
    const addSection = useCallback(() => {
        setSchema(s => ({
            ...s,
            sections: [
                ...s.sections,
                { id: genId('sec'), title: `Seção ${s.sections.length + 1}`, tests: [] },
            ],
        }))
    }, [])

    const removeSection = useCallback((sectionId: string) => {
        setSchema(s => ({
            ...s,
            sections: s.sections.filter(sec => sec.id !== sectionId),
        }))
    }, [])

    const renameSection = useCallback((sectionId: string, nextTitle: string) => {
        setSchema(s => ({
            ...s,
            sections: s.sections.map(sec =>
                sec.id === sectionId ? { ...sec, title: nextTitle } : sec,
            ),
        }))
    }, [])

    const removeTest = useCallback((testId: string) => {
        setSchema(s => ({
            ...s,
            sections: s.sections.map(sec => ({
                ...sec,
                tests: sec.tests.filter(t => t.id !== testId),
            })),
        }))
        setSelectedTestId(prev => (prev === testId ? null : prev))
    }, [])

    const updateTest = useCallback((testId: string, next: AssessmentTest) => {
        setSchema(s => ({
            ...s,
            sections: s.sections.map(sec => ({
                ...sec,
                tests: sec.tests.map(t => (t.id === testId ? next : t)),
            })),
        }))
    }, [])

    const addTestFromCatalog = useCallback(
        (entry: CatalogEntry, targetSectionId?: string) => {
            setSchema(s => {
                let sections = s.sections
                let sectionId = targetSectionId

                if (!sectionId) {
                    if (sections.length === 0) {
                        const newSection: AssessmentSection = {
                            id: genId('sec'),
                            title: 'Avaliação',
                            tests: [],
                        }
                        sections = [newSection]
                        sectionId = newSection.id
                    } else {
                        sectionId = sections[sections.length - 1]!.id
                    }
                }

                const baseTest = entry.make()
                const newTest = { ...baseTest, id: genId('test') } as AssessmentTest

                const nextSections = sections.map(sec =>
                    sec.id === sectionId ? { ...sec, tests: [...sec.tests, newTest] } : sec,
                )
                setSelectedTestId(newTest.id)
                if (isCompact) setPropsPanelOpen(true)
                return { ...s, sections: nextSections }
            })
        },
        [isCompact],
    )

    // ─── DnD ───────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const onDragStart = (e: DragStartEvent) => {
        const id = String(e.active.id)
        if (id.startsWith('lib:')) {
            setDraggingCatalogId(id.slice(4))
        } else {
            setDraggingCatalogId(null)
        }
    }

    const onDragEnd = (e: DragEndEvent) => {
        setDraggingCatalogId(null)
        const active = e.active
        const over = e.over
        if (!over) return

        const activeId = String(active.id)
        const overId = String(over.id)

        // Drop from library → canvas section (or onto a test row, which means
        // append to that section).
        if (activeId.startsWith('lib:')) {
            const catalogId = activeId.slice(4)
            const entry = TEST_CATALOG.find(c => c.catalogId === catalogId)
            if (!entry) return

            let targetSectionId: string | undefined
            if (overId.startsWith('section:')) {
                targetSectionId = overId.slice('section:'.length)
            } else if (overId.startsWith('test:')) {
                const testId = overId.slice('test:'.length)
                targetSectionId = schema.sections.find(s =>
                    s.tests.some(t => t.id === testId),
                )?.id
            }
            addTestFromCatalog(entry, targetSectionId)
            return
        }

        // Reorder existing test inside its section.
        if (activeId.startsWith('test:') && overId.startsWith('test:') && activeId !== overId) {
            const fromTestId = activeId.slice('test:'.length)
            const toTestId = overId.slice('test:'.length)
            setSchema(s => {
                const next = s.sections.map(sec => {
                    const fromIdx = sec.tests.findIndex(t => t.id === fromTestId)
                    const toIdx = sec.tests.findIndex(t => t.id === toTestId)
                    if (fromIdx === -1 || toIdx === -1) return sec
                    const reordered = [...sec.tests]
                    const [moved] = reordered.splice(fromIdx, 1)
                    reordered.splice(toIdx, 0, moved!)
                    return { ...sec, tests: reordered }
                })
                return { ...s, sections: next }
            })
        }
    }

    // ─── Save ──────────────────────────────────────────────────────
    const handleSave: () => Promise<void> = async () => {
        setErrorMsg(null)
        if (!canSave) {
            if (!titleValid) setErrorMsg('Título é obrigatório')
            else if (!hasSections) setErrorMsg('Adicione ao menos uma seção')
            else if (!hasTests) setErrorMsg('Adicione ao menos um teste')
            else if (duplicateMetricKeys.size > 0) setErrorMsg('Existem chaves de métrica duplicadas')
            return
        }
        const result = await onSave({
            title: title.trim(),
            description: description.trim() || null,
            schema,
        })
        if (result.success) {
            // On success, drop the draft and reset dirty.
            try {
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(draftKey(templateId))
                }
            } catch { /* noop */ }
            initialSnapshotRef.current = JSON.stringify({
                title: title.trim(),
                description: description.trim() || null,
                schema,
            })
            setDirty(false)
            setRestoredFromDraft(false)
        } else {
            setErrorMsg(result.error ?? 'Falha ao salvar')
        }
    }
    handleSaveRef.current = handleSave

    const selectedTest = selectedTestId
        ? allTests.find(t => t.id === selectedTestId) ?? null
        : null

    // ─── Render ────────────────────────────────────────────────────
    const draggingEntry = draggingCatalogId
        ? TEST_CATALOG.find(c => c.catalogId === draggingCatalogId)
        : null

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <div className="flex h-full min-h-0 w-full flex-col gap-3">
                {/* Topbar (interno) — desabilitado quando renderTopbar=false (M8 shell). */}
                {renderTopbar && (
                    <div className="flex flex-shrink-0 items-center gap-3 rounded-panel border border-k-border-subtle bg-surface-card px-4 py-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-k-text-secondary hover:bg-surface-inset"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Voltar
                            </button>
                        )}
                        <div className="flex-1">
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Nome da avaliação (ex: Avaliação Inicial)"
                                className="w-full bg-transparent text-base font-semibold text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none"
                            />
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Descrição opcional"
                                className="mt-0.5 w-full bg-transparent text-xs text-k-text-tertiary placeholder:text-k-text-quaternary focus:outline-none"
                            />
                        </div>
                        {dirty && (
                            <span className="text-[11px] text-k-text-tertiary">Alterações não salvas</span>
                        )}
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!canSave}
                            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Salvar
                        </button>
                    </div>
                )}

                {/* Quando o topbar interno está oculto, renderiza um par de inputs
                    para nome/descrição no topo do canvas (não há outro lugar para editá-los). */}
                {!renderTopbar && (
                    <div className="flex flex-shrink-0 flex-col gap-1 rounded-panel border border-k-border-subtle bg-surface-card px-4 py-3">
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nome da avaliação (ex: Avaliação Inicial)"
                            className="w-full bg-transparent text-base font-semibold text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none"
                        />
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Descrição opcional"
                            className="w-full bg-transparent text-xs text-k-text-tertiary placeholder:text-k-text-quaternary focus:outline-none"
                        />
                    </div>
                )}

                {restoredFromDraft && (
                    <div className="flex-shrink-0 rounded-control border border-k-border-subtle bg-surface-inset px-3 py-2 text-xs text-k-text-secondary">
                        Rascunho restaurado da última edição local. Salve para confirmar.
                    </div>
                )}
                {errorMsg && (
                    <div className="flex-shrink-0 rounded-control border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                        {errorMsg}
                    </div>
                )}

                {/* Three-column workspace */}
                <div
                    className={`grid min-h-0 flex-1 gap-3 ${
                        isCompact
                            ? 'grid-cols-[280px_1fr]'
                            : 'grid-cols-[280px_1fr_320px]'
                    }`}
                >
                    <TestLibraryColumn onAdd={entry => addTestFromCatalog(entry)} />

                    {/* Canvas */}
                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-panel border border-k-border-subtle bg-surface-card">
                        <div className="flex flex-shrink-0 items-center justify-between border-b border-k-border-subtle px-4 py-3">
                            <div>
                                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-tertiary">
                                    Estrutura
                                </div>
                                <div className="mt-0.5 font-mono text-xs tabular-nums text-k-text-tertiary">
                                    {schema.sections.length} {schema.sections.length === 1 ? 'seção' : 'seções'} ·{' '}
                                    {allTests.length} {allTests.length === 1 ? 'teste' : 'testes'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={addSection}
                                className="inline-flex items-center gap-1 rounded-control border border-k-border-primary bg-surface-card px-2.5 py-1 text-xs font-medium text-k-text-secondary transition-colors hover:bg-surface-inset hover:text-k-text-primary"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Nova seção
                            </button>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-4">
                            {schema.sections.length === 0 ? (
                                <CanvasEmptyState onAddSection={addSection} />
                            ) : (
                                schema.sections.map(section => (
                                    <SectionEditor
                                        key={section.id}
                                        section={section}
                                        selectedTestId={selectedTestId}
                                        duplicateMetricKeys={duplicateMetricKeys}
                                        onSelectTest={id => {
                                            setSelectedTestId(id)
                                            if (isCompact) setPropsPanelOpen(true)
                                        }}
                                        onRemoveTest={removeTest}
                                        onRenameSection={t => renameSection(section.id, t)}
                                        onRemoveSection={() => removeSection(section.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Properties panel — wide */}
                    {!isCompact && (
                        <TestPropertiesPanel
                            test={selectedTest}
                            duplicateKey={
                                !!selectedTest
                                && duplicateMetricKeys.has((selectedTest as { metric_key?: string }).metric_key ?? '')
                            }
                            onChange={next => selectedTest && updateTest(selectedTest.id, next)}
                        />
                    )}
                </div>
            </div>

            {/* Properties panel — compact (sheet) */}
            <AnimatePresence>
                {isCompact && propsPanelOpen && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-40 bg-black/30"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPropsPanelOpen(false)}
                        />
                        <motion.div
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm p-3"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        >
                            <TestPropertiesPanel
                                test={selectedTest}
                                duplicateKey={
                                    !!selectedTest
                                    && duplicateMetricKeys.has((selectedTest as { metric_key?: string }).metric_key ?? '')
                                }
                                onChange={next => selectedTest && updateTest(selectedTest.id, next)}
                                onClose={() => setPropsPanelOpen(false)}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Drag overlay — feedback while dragging from library */}
            <DragOverlay dropAnimation={null}>
                {draggingEntry ? (
                    <div className="flex items-center gap-2 rounded-control border border-k-border-primary bg-surface-card px-3 py-2 shadow-lg">
                        <div className="flex h-8 w-8 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset text-k-text-tertiary">
                            <draggingEntry.icon className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-medium text-k-text-primary">{draggingEntry.label}</div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

function CanvasEmptyState({ onAddSection }: { onAddSection: () => void }) {
    return (
        <div className="flex h-full flex-col items-center justify-center rounded-panel border-2 border-dashed border-k-border-subtle py-16 text-center">
            <div className="mb-3 rounded-full border border-k-border-subtle bg-surface-inset p-3">
                <Plus className="h-5 w-5 text-k-text-tertiary" />
            </div>
            <div className="text-sm font-medium text-k-text-primary">Comece criando uma seção</div>
            <p className="mt-1 max-w-[280px] text-xs text-k-text-tertiary">
                Agrupe testes em seções (ex: Antropometria, Pregas, Performance) e arraste itens da
                biblioteca para preencher.
            </p>
            <button
                type="button"
                onClick={onAddSection}
                className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
                <Plus className="h-3.5 w-3.5" />
                Nova seção
            </button>
        </div>
    )
}

