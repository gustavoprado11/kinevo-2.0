'use client'

import { ClipboardCheck, PlayCircle, CheckCircle2, X, ChevronDown, FileText } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
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
                <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3.5 h-3.5 text-k-text-quaternary" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-k-text-quaternary">{label}</span>
                </div>
                {selectedTitle ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-bg border border-k-border-subtle">
                        <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-sm text-k-text-secondary truncate">{selectedTitle}</span>
                    </div>
                ) : (
                    <div className="px-3 py-2 rounded-lg bg-glass-bg/50 border border-k-border-subtle/50">
                        <span className="text-sm text-k-text-quaternary">Nenhum</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex-1 min-w-0" ref={ref}>
            <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5 text-k-text-quaternary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-k-text-quaternary">{label}</span>
            </div>

            {selectedId && selectedTitle ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/8 border border-violet-500/20 group">
                    <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-sm text-k-text-primary truncate flex-1">{selectedTitle}</span>
                    <button
                        onClick={onClear}
                        className="p-0.5 rounded text-k-text-quaternary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-glass-bg border border-k-border-subtle text-sm text-k-text-quaternary hover:border-violet-500/30 hover:text-k-text-tertiary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>{templates.length === 0 ? 'Nenhum template disponível' : 'Selecionar formulário...'}</span>
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    </button>

                    {open && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-primary border border-k-border-subtle rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="max-h-48 overflow-y-auto py-1">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { onSelect(t.id); setOpen(false) }}
                                        className="w-full text-left px-3 py-2 hover:bg-glass-bg transition-colors flex items-center gap-2"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-k-text-quaternary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm text-k-text-primary truncate block">{t.title}</span>
                                            <span className="text-[10px] text-k-text-quaternary">
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
}: ProgramFormTriggersProps) {
    const [preWorkout, setPreWorkout] = useState<string | null>(initialTriggers.preWorkout?.formTemplateId ?? null)
    const [postWorkout, setPostWorkout] = useState<string | null>(initialTriggers.postWorkout?.formTemplateId ?? null)

    const getTitle = (id: string | null, initial: InitialTrigger | null): string | null => {
        if (!id) return null
        if (initial && initial.formTemplateId === id) return initial.formTitle
        return availableTemplates.find(t => t.id === id)?.title ?? null
    }

    const handleChange = (pre: string | null, post: string | null) => {
        setPreWorkout(pre)
        setPostWorkout(post)
        onChange({ preWorkout: pre, postWorkout: post })
    }

    return (
        <div className="px-6 py-3">
            <div className="rounded-xl border border-k-border-subtle bg-surface-primary/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <ClipboardCheck className="w-4 h-4 text-violet-400" />
                    <h3 className="text-xs font-semibold text-k-text-secondary">Check-in do Programa</h3>
                    <span className="text-[10px] text-k-text-quaternary ml-1">Formulários exibidos automaticamente antes ou após cada treino</span>
                </div>

                {readOnly && (
                    <p className="text-[10px] text-k-text-quaternary mb-3 italic">
                        Edite no template original para alterar os check-ins
                    </p>
                )}

                <div className="flex gap-4">
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
                    <p className="text-[10px] text-k-text-quaternary mt-3">
                        Crie um formulário de check-in em{' '}
                        <a href="/forms" className="text-violet-400 hover:underline">Avaliações</a>
                        {' '}para poder vinculá-lo aqui.
                    </p>
                )}
            </div>
        </div>
    )
}
