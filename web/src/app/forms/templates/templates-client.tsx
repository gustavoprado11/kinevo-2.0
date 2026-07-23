'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Json } from '@kinevo/shared/types/database'
import { AppLayout } from '@/components/layout'
import { deleteFormTemplate } from '@/actions/forms/delete-form-template'
import { useToast } from '@/components/ui/toast'
import { ModalShell } from '@/components/shared/modal-shell'
import {
    Plus,
    Search,
    Trash2,
    Loader2,
    Pencil,
    Send,
    MoreVertical,
    ArrowLeft,
    ChevronRight,
    ClipboardCheck,
    CheckCircle2,
    MessageSquare,
    FileText,
    Activity,
} from 'lucide-react'

// --- Helpers ---

const TIMEZONE = 'America/Sao_Paulo'

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const dateStr2 = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const today = new Date(todayStr)
    const target = new Date(dateStr2)
    const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffHours < 1) return 'Agora mesmo'
    if (diffHours < 24 && diffDays === 0) return `há ${diffHours}h`
    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    const weeks = Math.floor(diffDays / 7)
    if (diffDays < 30) return `há ${weeks} sem.`
    const months = Math.floor(diffDays / 30)
    if (diffDays < 365) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
    return `há ${Math.floor(diffDays / 365)} anos`
}

function cleanTemplateName(name: string): string {
    const parts = name.split(' - ')
    if (parts.length === 2 && parts[1].toLowerCase().includes(parts[0].toLowerCase())) {
        return parts[1]
    }
    return name
}

function getTypeLabel(type: string): string {
    switch (type) {
        case 'long_text': return 'Texto longo'
        case 'short_text': return 'Texto'
        case 'single_choice': return 'Escolha'
        case 'scale': return 'Escala'
        case 'photo': return 'Foto'
        default: return 'Resposta'
    }
}

// --- Types ---

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
    onboarding_state?: import('@kinevo/shared/types/onboarding').OnboardingState | null
}

interface FormTemplate {
    id: string
    title: string
    description: string | null
    category: string
    version: number
    is_active: boolean
    created_source: string
    schema_json?: Json
    created_at: string
    updated_at: string
    responseCount: number
    sessionCount?: number
    trainer_id: string | null
}

interface TemplatesClientProps {
    trainer: Trainer
    templates: FormTemplate[]
    /**
     * M8/B2 — variantes:
     *  - 'forms' (default): /forms/templates, lista forms, edit→ /forms/templates/new
     *  - 'assessments': /avaliacoes/templates, edit→ /avaliacoes/templates/new
     * O server filtra por categoria; o client só ajusta header/links.
     */
    mode?: 'forms' | 'assessments'
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText }> = {
    anamnese: { label: 'Anamnese', icon: ClipboardCheck },
    checkin: { label: 'Check-in', icon: CheckCircle2 },
    survey: { label: 'Pesquisa', icon: MessageSquare },
    assessment: { label: 'Avaliação Presencial', icon: Activity },
    feedback: { label: 'Feedback do programa', icon: MessageSquare },
}

// --- Actions Menu ---

function ActionsMenu({ template, onDelete, mode = 'forms' }: { template: FormTemplate; onDelete: (id: string) => void; mode?: 'forms' | 'assessments' }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const isSystem = template.trainer_id === null
    const isAssessment = template.category === 'assessment'
    const editBase = mode === 'assessments' ? '/avaliacoes/templates/new' : '/forms/templates/new'

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
                className="p-1.5 rounded-control text-k-text-quaternary hover:text-k-text-secondary hover:bg-surface-inset transition-colors opacity-0 group-hover:opacity-100"
            >
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="absolute right-0 top-8 z-header w-44 rounded-control border border-k-border-subtle bg-surface-card shadow-lg py-1">
                    {!isSystem && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`${editBase}?edit=${template.id}`) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-k-text-secondary hover:bg-surface-inset transition-colors"
                        >
                            <Pencil size={14} /> Editar
                        </button>
                    )}
                    {!isAssessment && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/forms?assign=${template.id}`) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-k-text-secondary hover:bg-surface-inset transition-colors"
                        >
                            <Send size={14} /> Enviar para aluno
                        </button>
                    )}
                    {!isSystem && (
                        <>
                            <div className="my-1 border-t border-k-border-subtle" />
                            <button
                                onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(template.id) }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-surface-inset transition-colors dark:text-red-400"
                            >
                                <Trash2 size={14} /> Excluir
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// --- Component ---

export function TemplatesClient({ trainer, templates: initialTemplates, mode = 'forms' }: TemplatesClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [templates, setTemplates] = useState(initialTemplates)
    const [searchQuery, setSearchQuery] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const isAssessmentsMode = mode === 'assessments'
    const backHref = isAssessmentsMode ? '/avaliacoes' : '/forms'
    const builderHref = isAssessmentsMode ? '/avaliacoes/templates/new' : '/forms/templates/new'
    const headerLabel = isAssessmentsMode ? 'Templates de avaliação' : 'Templates'

    const handleConfirmDelete = async () => {
        const templateId = confirmDeleteId
        if (!templateId) return
        setConfirmDeleteId(null)

        setDeleting(templateId)
        const result = await deleteFormTemplate({ templateId })

        if (result.success) {
            setTemplates(templates.filter(t => t.id !== templateId))
        } else {
            // Antes o erro era engolido: o spinner sumia e nada acontecia.
            toast({ message: result.error || 'Não foi possível excluir o template.', type: 'error' })
        }

        setDeleting(null)
    }

    const filteredTemplates = templates.filter(
        (t) =>
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={trainer.onboarding_state ?? null}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(backHref)}
                        className="p-1.5 rounded-control text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">{headerLabel}</h1>
                    {templates.length > 0 && (
                        <span className="font-mono text-sm tabular-nums text-k-text-tertiary">
                            {templates.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => router.push(builderHref)}
                    className="flex items-center gap-2 rounded-control border border-k-border-primary bg-surface-card hover:bg-surface-inset text-k-text-secondary hover:text-k-text-primary px-4 py-2 text-sm font-medium transition-colors"
                >
                    <Plus size={14} />
                    {isAssessmentsMode ? 'Criar Template de avaliação' : 'Criar Template'}
                </button>
            </div>

            {/* Search */}
            {templates.length > 0 && (
                <div className="relative mb-6">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-k-text-quaternary" />
                    <input
                        type="text"
                        placeholder="Buscar templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-control border border-k-border-primary bg-surface-card pl-10 pr-4 py-2.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 transition-all"
                    />
                </div>
            )}

            {/* Content */}
            {filteredTemplates.length === 0 ? (
                searchQuery ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-k-text-quaternary">
                            Nenhum template encontrado para &quot;{searchQuery}&quot;
                        </p>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <FileText className="w-10 h-10 text-k-text-quaternary mx-auto mb-3" strokeWidth={1} />
                        <p className="text-sm font-semibold text-k-text-primary mb-1">Nenhum template criado</p>
                        <p className="text-xs text-k-text-quaternary max-w-sm mx-auto mb-5">
                            Templates são formulários para coletar informações dos alunos: anamnese, check-ins semanais, avaliações físicas.
                        </p>
                        <button
                            onClick={() => router.push(builderHref)}
                            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                        >
                            <Plus size={13} />
                            Criar primeiro template
                        </button>
                    </div>
                )
            ) : (
                <div className="space-y-3">
                    {filteredTemplates.map((template) => {
                        const config = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.survey
                        const Icon = config.icon
                        const isAssessment = template.category === 'assessment'
                        const questions = (template.schema_json as any)?.questions || []
                        const questionsCount = questions.length
                        const sections = (template.schema_json as any)?.sections || []
                        const sectionsCount = sections.length
                        const sessionsCount = template.sessionCount ?? 0
                        const isSystem = template.trainer_id === null

                        return (
                            <div
                                key={template.id}
                                onClick={() => router.push(`${builderHref}?edit=${template.id}`)}
                                className="group relative rounded-panel border border-k-border-subtle bg-surface-card p-4 hover:bg-surface-inset transition-colors cursor-pointer"
                            >
                                {deleting === template.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-surface-card/80 rounded-panel z-sticky">
                                        <Loader2 size={20} className="animate-spin text-k-text-quaternary" />
                                    </div>
                                )}

                                {/* Top row: icon + title + badges + menu */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset">
                                            <Icon size={16} className="text-k-text-tertiary" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-k-text-primary truncate">
                                                {cleanTemplateName(template.title)}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-k-text-tertiary">
                                                    <span className="font-mono tabular-nums">
                                                        {isAssessment ? sectionsCount : questionsCount}
                                                    </span>
                                                    {' '}
                                                    {isAssessment
                                                        ? (sectionsCount === 1 ? 'seção' : 'seções')
                                                        : (questionsCount === 1 ? 'pergunta' : 'perguntas')} · {config.label}
                                                </span>
                                                {isSystem && (
                                                    <span className="rounded border border-k-border-subtle bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-k-text-tertiary">
                                                        Kinevo
                                                    </span>
                                                )}
                                                {template.created_source === 'ai_assisted' && (
                                                    <span className="rounded border border-k-border-subtle bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-k-text-tertiary">
                                                        IA
                                                    </span>
                                                )}
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                    template.is_active
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-surface-inset text-k-text-quaternary border border-k-border-subtle'
                                                }`}>
                                                    {template.is_active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                                                    {template.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ActionsMenu template={template} onDelete={setConfirmDeleteId} mode={mode} />
                                </div>

                                {/* Preview: questions for forms, sections for assessments */}
                                {isAssessment ? (
                                    sections.length > 0 && (
                                        <div className="ml-11 space-y-1 mb-3">
                                            {sections.slice(0, 3).map((sec: any, i: number) => (
                                                <div key={sec.id || i} className="flex items-center gap-2 text-xs">
                                                    <span className="font-mono tabular-nums text-k-text-quaternary w-4 shrink-0">{i + 1}.</span>
                                                    <span className="text-k-text-secondary truncate">{sec.title || sec.label || sec.id}</span>
                                                </div>
                                            ))}
                                            {sections.length > 3 && (
                                                <span className="block pl-6 text-[10px] text-k-text-quaternary">
                                                    +<span className="font-mono tabular-nums">{sections.length - 3}</span> mais...
                                                </span>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    questions.length > 0 && (
                                        <div className="ml-11 space-y-1 mb-3">
                                            {questions.slice(0, 3).map((q: any, i: number) => (
                                                <div key={q.id || i} className="flex items-center gap-2 text-xs">
                                                    <span className="font-mono tabular-nums text-k-text-quaternary w-4 shrink-0">{i + 1}.</span>
                                                    <span className="text-k-text-secondary truncate">{q.label || q.title}</span>
                                                    <span className="text-k-text-quaternary shrink-0 text-[10px]">({getTypeLabel(q.type)})</span>
                                                </div>
                                            ))}
                                            {questions.length > 3 && (
                                                <span className="block pl-6 text-[10px] text-k-text-quaternary">
                                                    +<span className="font-mono tabular-nums">{questions.length - 3}</span> mais...
                                                </span>
                                            )}
                                        </div>
                                    )
                                )}

                                {/* Footer */}
                                <div className="ml-11 flex items-center justify-between pt-2 border-t border-k-border-subtle text-[11px]">
                                    <span className="font-mono tabular-nums text-k-text-tertiary">
                                        {isAssessment
                                            ? `${sessionsCount} ${sessionsCount === 1 ? 'sessão' : 'sessões'}`
                                            : `${template.responseCount} ${template.responseCount === 1 ? 'resposta' : 'respostas'}`}
                                        {' · '}v{template.version}
                                        {' · '}{timeAgo(template.created_at)}
                                    </span>
                                    {!isAssessment && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                router.push(`/forms?assign=${template.id}`)
                                            }}
                                            className="flex items-center gap-0.5 text-k-text-secondary hover:text-k-text-primary opacity-0 group-hover:opacity-100 transition-all font-medium"
                                        >
                                            Enviar para aluno
                                            <ChevronRight size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Confirmação de exclusão */}
            <ModalShell
                open={confirmDeleteId !== null}
                onClose={() => setConfirmDeleteId(null)}
                title="Excluir template?"
                size="sm"
                footer={
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-4 py-2 rounded-control text-sm font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmDelete}
                            className="px-4 py-2 rounded-control bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                        >
                            Excluir
                        </button>
                    </div>
                }
            >
                <div className="px-5 py-4">
                    <p className="text-sm text-k-text-secondary">
                        Tem certeza que deseja excluir este template? Essa ação não pode ser desfeita.
                    </p>
                </div>
            </ModalShell>
        </AppLayout>
    )
}
