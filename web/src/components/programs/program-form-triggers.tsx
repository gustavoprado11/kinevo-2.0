'use client'

import { ClipboardCheck, Clock, PlayCircle, CheckCircle2, X, ChevronDown, FileText } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { FormTemplateOption } from '@/actions/programs/get-form-templates-for-triggers'

export interface TriggerSelection {
    preWorkout: string | null
    postWorkout: string | null
}

export interface InitialTrigger {
    formTemplateId: string
    formTitle: string
    formCategory: string
}

interface ProgramFormTriggersProps {
    initialTriggers: {
        preWorkout: InitialTrigger | null
        postWorkout: InitialTrigger | null
    }
    availableTemplates: FormTemplateOption[]
    onChange: (triggers: TriggerSelection) => void
    readOnly?: boolean
    /** When true, parent controls expansion; trigger is rendered externally */
    expanded?: boolean
    /** Called when trigger is clicked (only used when parent controls expansion) */
    onToggle?: () => void
    /** When true, only renders the content (no trigger/wrapper) */
    renderContentOnly?: boolean
}

const categoryLabel: Record<string, string> = {
    checkin: 'Check-in',
    survey: 'Pesquisa',
}

function TriggerSlot({
    label,
    icon: Icon,
    selectedId,
    selectedTitle,
    templates,
    onSelect,
    onClear,
    readOnly,
}: {
    label: string
    icon: typeof PlayCircle
    selectedId: string | null
    selectedTitle: string | null
    templates: FormTemplateOption[]
    onSelect: (id: string) => void
    onClear: () => void
    readOnly?: boolean
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    if (readOnly) {
        return (
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="w-3.5 h-3.5 text-[#AEAEB2] dark:text-k-text-quaternary" />
                    <span className="text-xs font-medium text-[#6E6E73] dark:text-k-text-quaternary tracking-tight">{label}</span>
                </div>
                {selectedTitle ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[#F5F5F7]/60 dark:bg-glass-bg border border-transparent">
                        <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-sm text-[#6E6E73] dark:text-k-text-secondary truncate">{selectedTitle}</span>
                    </div>
                ) : (
                    <div className="px-3 py-2 rounded-[10px] bg-[#F5F5F7]/40 dark:bg-glass-bg/50 border border-transparent">
                        <span className="text-sm text-[#AEAEB2] dark:text-k-text-quaternary">Nenhum</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex-1 min-w-0" ref={ref}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-[#AEAEB2] dark:text-k-text-quaternary" />
                <span className="text-xs font-medium text-[#6E6E73] dark:text-k-text-quaternary tracking-tight">{label}</span>
            </div>

            {selectedId && selectedTitle ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-violet-500/[0.06] dark:bg-violet-500/8 border border-violet-500/15 dark:border-violet-500/20 group">
                    <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-sm text-[#1D1D1F] dark:text-k-text-primary truncate flex-1">{selectedTitle}</span>
                    <button
                        onClick={onClear}
                        className="p-0.5 rounded text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#FF3B30] dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remover"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <button
                        onClick={() => templates.length > 0 && setOpen(!open)}
                        disabled={templates.length === 0}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] bg-[#F5F5F7]/60 dark:bg-glass-bg border border-transparent text-sm text-[#AEAEB2] dark:text-k-text-quaternary hover:border-[#007AFF]/20 dark:hover:border-violet-500/30 hover:text-[#6E6E73] dark:hover:text-k-text-tertiary transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:border-[#007AFF]/40 dark:focus:border-violet-500/50 focus:ring-2 focus:ring-[#007AFF]/10 dark:focus:ring-0 focus:bg-white dark:focus:bg-surface-card outline-none"
                    >
                        <span>{templates.length === 0 ? 'Nenhum template disponível' : 'Selecionar formulário...'}</span>
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    </button>

                    {open && (
                        <div className="absolute z-modal top-full left-0 right-0 mt-1 bg-white dark:bg-surface-primary border border-[#E8E8ED] dark:border-k-border-subtle rounded-xl shadow-lg dark:shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="max-h-48 overflow-y-auto py-1">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { onSelect(t.id); setOpen(false) }}
                                        className="w-full text-left px-3 py-2 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors flex items-center gap-2"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-[#AEAEB2] dark:text-k-text-quaternary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm text-[#1D1D1F] dark:text-k-text-primary truncate block">{t.title}</span>
                                            <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary">
                                                {categoryLabel[t.category] || t.category} · {t.questionCount} {t.questionCount === 1 ? 'campo' : 'campos'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function ProgramFormTriggers({
    initialTriggers,
    availableTemplates,
    onChange,
    readOnly = false,
    expanded: controlledExpanded,
    onToggle,
    renderContentOnly = false,
}: ProgramFormTriggersProps) {
    const [preWorkout, setPreWorkout] = useState<string | null>(initialTriggers.preWorkout?.formTemplateId ?? null)
    const [postWorkout, setPostWorkout] = useState<string | null>(initialTriggers.postWorkout?.formTemplateId ?? null)
    const [internalExpanded, setInternalExpanded] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)
    const [contentHeight, setContentHeight] = useState(0)

    const expanded = controlledExpanded ?? internalExpanded
    const selectedCount = (preWorkout ? 1 : 0) + (postWorkout ? 1 : 0)

    useEffect(() => {
        if (contentRef.current) {
            setContentHeight(contentRef.current.scrollHeight)
        }
    }, [expanded, preWorkout, postWorkout, availableTemplates])

    const getTitle = (id: string | null, initial: InitialTrigger | null): string | null => {
        if (!id) return null
        if (initial && initial.formTemplateId === id) return initial.formTitle
        return availableTemplates.find(t => t.id === id)?.title ?? null
    }

    const handleChange = useCallback((pre: string | null, post: string | null) => {
        setPreWorkout(pre)
        setPostWorkout(post)
        onChange({ preWorkout: pre, postWorkout: post })
    }, [onChange])

    const handleToggle = () => {
        if (onToggle) {
            onToggle()
        } else {
            setInternalExpanded(!internalExpanded)
        }
    }

    // Content-only mode: just render the expandable content panel (no trigger, no wrapper)
    if (renderContentOnly) {
        return (
            <div
                className="transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{
                    maxHeight: expanded ? `${contentHeight}px` : '0px',
                    opacity: expanded ? 1 : 0,
                    overflow: expanded ? 'visible' : 'hidden',
                }}
                aria-hidden={!expanded}
            >
                <div ref={contentRef} className="px-6 py-3 pb-4 bg-[#F5F5F7] dark:bg-[#1a1a2e] border-b border-[#E8E8ED] dark:border-k-border-subtle relative z-dropdown">
                    {readOnly && (
                        <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mb-3 italic">
                            Edite no template original para alterar os check-ins
                        </p>
                    )}

                    <div className="flex gap-4 items-start">
                        <TriggerSlot
                            label="Antes do treino"
                            icon={PlayCircle}
                            selectedId={preWorkout}
                            selectedTitle={getTitle(preWorkout, initialTriggers.preWorkout)}
                            templates={availableTemplates}
                            onSelect={(id) => handleChange(id, postWorkout)}
                            onClear={() => handleChange(null, postWorkout)}
                            readOnly={readOnly}
                        />
                        <div className="w-px h-12 bg-[#E8E8ED]/60 dark:bg-k-border-subtle/40 shrink-0 self-center" />
                        <TriggerSlot
                            label="Após o treino"
                            icon={CheckCircle2}
                            selectedId={postWorkout}
                            selectedTitle={getTitle(postWorkout, initialTriggers.postWorkout)}
                            templates={availableTemplates}
                            onSelect={(id) => handleChange(preWorkout, id)}
                            onClear={() => handleChange(preWorkout, null)}
                            readOnly={readOnly}
                        />
                    </div>

                    {!readOnly && availableTemplates.length === 0 && (
                        <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mt-3">
                            Crie um formulário de check-in em{' '}
                            <a href="/forms" className="text-[#007AFF] dark:text-violet-400 hover:underline">Avaliações</a>
                            {' '}para poder vinculá-lo aqui.
                        </p>
                    )}
                </div>
            </div>
        )
    }

    // Standalone mode (used in edit-assigned-program-client): self-contained accordion with card wrapper
    return (
        <div className="px-6 py-1.5">
            <div className={`rounded-xl border transition-colors duration-200 ${
                expanded
                    ? 'border-[#E8E8ED]/80 dark:border-k-border-subtle/80 bg-[#F5F5F7]/30 dark:bg-glass-bg/20'
                    : 'border-[#E8E8ED]/60 dark:border-k-border-subtle/60 bg-transparent hover:bg-[#F5F5F7]/30 dark:hover:bg-glass-bg/15'
            }`}>
                <button
                    onClick={handleToggle}
                    className="w-full flex items-center gap-2.5 px-4 py-3 cursor-pointer"
                    aria-expanded={expanded}
                >
                    <ClipboardCheck className="w-[18px] h-[18px] text-[#AEAEB2] dark:text-k-text-quaternary shrink-0" />
                    <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">Check-in do Programa</span>

                    {selectedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10">
                            <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            {selectedCount} formulário{selectedCount > 1 ? 's' : ''}
                        </span>
                    ) : (
                        <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">
                            Formulários antes ou após cada treino
                        </span>
                    )}

                    <ChevronDown
                        className={`w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary ml-auto shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                            expanded ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                <div
                    className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                        maxHeight: expanded ? `${contentHeight}px` : '0px',
                        opacity: expanded ? 1 : 0,
                    }}
                    aria-hidden={!expanded}
                >
                    <div ref={contentRef} className="px-4 pb-4 pt-0">
                        <div className="h-px bg-[#E8E8ED]/60 dark:bg-k-border-subtle/40 mb-3" />

                        {readOnly && (
                            <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mb-3 italic">
                                Edite no template original para alterar os check-ins
                            </p>
                        )}

                        <div className="flex gap-4 items-start">
                            <TriggerSlot
                                label="Antes do treino"
                                icon={PlayCircle}
                                selectedId={preWorkout}
                                selectedTitle={getTitle(preWorkout, initialTriggers.preWorkout)}
                                templates={availableTemplates}
                                onSelect={(id) => handleChange(id, postWorkout)}
                                onClear={() => handleChange(null, postWorkout)}
                                readOnly={readOnly}
                            />
                            <div className="w-px h-14 bg-[#E8E8ED]/60 dark:bg-k-border-subtle/40 shrink-0 mt-5" />
                            <TriggerSlot
                                label="Após o treino"
                                icon={CheckCircle2}
                                selectedId={postWorkout}
                                selectedTitle={getTitle(postWorkout, initialTriggers.postWorkout)}
                                templates={availableTemplates}
                                onSelect={(id) => handleChange(preWorkout, id)}
                                onClear={() => handleChange(preWorkout, null)}
                                readOnly={readOnly}
                            />
                        </div>

                        {!readOnly && availableTemplates.length === 0 && (
                            <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mt-3">
                                Crie um formulário de check-in em{' '}
                                <a href="/forms" className="text-[#007AFF] dark:text-violet-400 hover:underline">Avaliações</a>
                                {' '}para poder vinculá-lo aqui.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * Returns the selected count for use in external trigger rendering.
 * Use this hook when rendering the trigger externally (renderContentOnly mode).
 */
export function useFormTriggerCount(preWorkout: string | null, postWorkout: string | null): number {
    return (preWorkout ? 1 : 0) + (postWorkout ? 1 : 0)
}
