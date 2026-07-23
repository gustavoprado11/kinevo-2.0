'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronRight,
    GripVertical,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react'
import type {
    AssessmentSection,
    AssessmentTest,
} from '@kinevo/shared/types/assessments'

interface SectionEditorProps {
    section: AssessmentSection
    selectedTestId: string | null
    duplicateMetricKeys: Set<string>
    onSelectTest: (testId: string) => void
    onRemoveTest: (testId: string) => void
    onRenameSection: (title: string) => void
    onRemoveSection: () => void
}

export function SectionEditor({
    section,
    selectedTestId,
    duplicateMetricKeys,
    onSelectTest,
    onRemoveTest,
    onRenameSection,
    onRemoveSection,
}: SectionEditorProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [editingTitle, setEditingTitle] = useState(false)
    const [titleDraft, setTitleDraft] = useState(section.title)

    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: `section:${section.id}`,
        data: { source: 'canvas-section', sectionId: section.id },
    })

    const commitTitle = () => {
        const next = titleDraft.trim()
        if (next && next !== section.title) onRenameSection(next)
        else setTitleDraft(section.title)
        setEditingTitle(false)
    }

    return (
        <section className="rounded-panel border border-k-border-subtle bg-surface-card">
            {/* Section header */}
            <header className="flex items-center gap-2 px-4 py-3">
                <button
                    type="button"
                    onClick={() => setCollapsed(c => !c)}
                    className="text-k-text-tertiary hover:text-k-text-primary"
                    aria-label={collapsed ? 'Expandir seção' : 'Recolher seção'}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {editingTitle ? (
                    <input
                        autoFocus
                        type="text"
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={e => {
                            if (e.key === 'Enter') commitTitle()
                            if (e.key === 'Escape') {
                                setTitleDraft(section.title)
                                setEditingTitle(false)
                            }
                        }}
                        className="flex-1 rounded-control border border-k-border-primary bg-transparent px-2 py-1 text-sm font-semibold text-k-text-primary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setEditingTitle(true)}
                        className="group flex flex-1 items-center gap-2 text-left"
                    >
                        <span className="text-sm font-semibold text-k-text-primary">{section.title}</span>
                        <Pencil className="h-3 w-3 text-k-text-quaternary opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                )}
                <span className="text-[11px] text-k-text-tertiary">
                    {section.tests.length} {section.tests.length === 1 ? 'teste' : 'testes'}
                </span>
                <button
                    type="button"
                    onClick={onRemoveSection}
                    aria-label="Remover seção"
                    className="rounded-md p-1.5 text-k-text-quaternary transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </header>

            {/* Tests list / drop zone */}
            {!collapsed && (
                <div
                    ref={setDropRef}
                    className={`mx-3 mb-3 rounded-control border-2 border-dashed transition-colors ${
                        isOver
                            ? 'border-k-border-primary bg-surface-inset'
                            : section.tests.length === 0
                                ? 'border-k-border-subtle'
                                : 'border-transparent'
                    }`}
                >
                    {section.tests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
                            <Plus className="h-4 w-4 text-k-text-quaternary" />
                            <p className="text-xs text-k-text-tertiary">Arraste testes para esta seção</p>
                        </div>
                    ) : (
                        <SortableContext
                            items={section.tests.map(t => `test:${t.id}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="space-y-1.5 p-2">
                                {section.tests.map(test => (
                                    <SortableTestRow
                                        key={test.id}
                                        test={test}
                                        sectionId={section.id}
                                        selected={selectedTestId === test.id}
                                        hasDuplicateKey={duplicateMetricKeys.has((test as { metric_key?: string }).metric_key ?? '')}
                                        onSelect={() => onSelectTest(test.id)}
                                        onRemove={() => onRemoveTest(test.id)}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    )}
                </div>
            )}
        </section>
    )
}

interface SortableTestRowProps {
    test: AssessmentTest
    sectionId: string
    selected: boolean
    hasDuplicateKey: boolean
    onSelect: () => void
    onRemove: () => void
}

function SortableTestRow({
    test,
    sectionId,
    selected,
    hasDuplicateKey,
    onSelect,
    onRemove,
}: SortableTestRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `test:${test.id}`,
        data: { source: 'canvas-test', testId: test.id, sectionId },
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    const required = (test as { required?: boolean }).required === true
    const metricKey = (test as { metric_key?: string }).metric_key ?? ''

    const typeLabel = TEST_TYPE_LABELS[test.type]

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                selected
                    ? 'border-k-border-primary bg-surface-inset'
                    : 'border-transparent hover:bg-surface-inset'
            }`}
        >
            <button
                type="button"
                {...listeners}
                {...attributes}
                aria-label="Reordenar teste"
                className="cursor-grab text-k-text-quaternary hover:text-k-text-secondary active:cursor-grabbing"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={onSelect}
                className="min-w-0 flex-1 text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium leading-snug text-k-text-primary line-clamp-2">{test.label}</span>
                    {required && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-k-text-tertiary">
                            obrigatório
                        </span>
                    )}
                    {hasDuplicateKey && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                            <AlertCircle className="h-2.5 w-2.5" />
                            chave duplicada
                        </span>
                    )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-k-text-tertiary">
                    <span>{typeLabel}</span>
                    {metricKey && (
                        <>
                            <span>·</span>
                            <code className="rounded bg-surface-inset px-1 font-mono">{metricKey}</code>
                        </>
                    )}
                </div>
            </button>
            {selected && (
                <Check className="h-4 w-4 flex-shrink-0 text-k-text-tertiary" />
            )}
            <button
                type="button"
                onClick={onRemove}
                aria-label="Remover teste"
                className="rounded-md p-1.5 text-k-text-quaternary opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </li>
    )
}

const TEST_TYPE_LABELS: Record<AssessmentTest['type'], string> = {
    numeric_unit: 'Numérico',
    bilateral_numeric: 'Bilateral',
    multi_attempt_numeric: 'Múltiplas tentativas',
    computed: 'Calculado',
    protocol: 'Protocolo',
}
