'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { deleteFormTemplate } from '@/actions/forms/delete-form-template'
import {
    Plus,
    Search,
    Trash2,
    Loader2,
    Pencil,
    Send,
    Copy,
    MoreVertical,
    ArrowLeft,
    ClipboardCheck,
    CheckCircle2,
    MessageSquare,
    FileText,
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
}

interface FormTemplate {
    id: string
    title: string
    description: string | null
    category: string
    version: number
    is_active: boolean
    created_source: string
    schema_json?: Record<string, unknown> | null
    created_at: string
    updated_at: string
    responseCount: number
}

interface TemplatesClientProps {
    trainer: Trainer
    templates: FormTemplate[]
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string; bgColor: string }> = {
    anamnese: { label: 'Anamnese', icon: ClipboardCheck, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    checkin: { label: 'Check-in', icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    survey: { label: 'Pesquisa', icon: MessageSquare, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
}

// --- Actions Menu ---

function ActionsMenu({ template, onDelete }: { template: FormTemplate; onDelete: (id: string) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const router = useRouter()

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
                className="p-1.5 rounded-lg text-k-text-quaternary hover:text-k-text-secondary hover:bg-glass-bg transition-all opacity-0 group-hover:opacity-100"
            >
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-k-border-primary bg-surface-card shadow-xl py-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/forms/templates/new?edit=${template.id}`) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-k-text-secondary hover:bg-glass-bg transition-colors"
                    >
                        <Pencil size={14} /> Editar
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setOpen(false); router.push(`/forms?assign=${template.id}`) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-k-text-secondary hover:bg-glass-bg transition-colors"
                    >
                        <Send size={14} /> Enviar para aluno
                    </button>
                    <div className="my-1 border-t border-k-border-subtle" />
                    <button
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(template.id) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-glass-bg transition-colors"
                    >
                        <Trash2 size={14} /> Excluir
                    </button>
                </div>
            )}
        </div>
    )
}

// --- Component ---

export function TemplatesClient({ trainer, templates: initialTemplates }: TemplatesClientProps) {
    const router = useRouter()
    const [templates, setTemplates] = useState(initialTemplates)
    const [searchQuery, setSearchQuery] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)

    const handleDelete = async (templateId: string) => {
        if (!confirm('Tem certeza que deseja excluir este template?')) return

        setDeleting(templateId)
        const result = await deleteFormTemplate({ templateId })

        if (result.success) {
            setTemplates(templates.filter(t => t.id !== templateId))
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
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/forms')}
                        className="p-1.5 rounded-lg text-k-text-quaternary hover:text-k-text-secondary hover:bg-glass-bg transition-all"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Templates</h1>
                    {templates.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-glass-bg text-xs font-bold text-k-text-tertiary border border-k-border-subtle">
                            {templates.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => router.push('/forms/templates/new')}
                    className="flex items-center gap-2 rounded-full border border-k-border-primary bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary px-4 py-2 text-sm font-medium transition-all"
                >
                    <Plus size={14} />
                    Criar Template
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
                        className="w-full rounded-xl border border-k-border-subtle bg-glass-bg pl-10 pr-4 py-2.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 transition-all"
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
                        <p className="text-sm font-semibold text-white mb-1">Nenhum template criado</p>
                        <p className="text-xs text-k-text-quaternary max-w-sm mx-auto mb-5">
                            Templates são formulários para coletar informações dos alunos: anamnese, check-ins semanais, avaliações físicas.
                        </p>
                        <button
                            onClick={() => router.push('/forms/templates/new')}
                            className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Criar primeiro template
                        </button>
                    </div>
                )
            ) : (
                <div className="space-y-3">
                    {filteredTemplates.map((template) => {
                        const config = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.survey
                        const Icon = config.icon
                        const questions = (template.schema_json as any)?.questions || []
                        const questionsCount = questions.length

                        return (
                            <div
                                key={template.id}
                                onClick={() => router.push(`/forms/templates/new?edit=${template.id}`)}
                                className="group relative bg-surface-card border border-k-border-subtle rounded-xl p-4 hover:border-k-border-primary hover:bg-glass-bg transition-all cursor-pointer"
                            >
                                {deleting === template.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-surface-card/80 rounded-xl z-10">
                                        <Loader2 size={20} className="animate-spin text-k-text-quaternary" />
                                    </div>
                                )}

                                {/* Top row: icon + title + badges + menu */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                                            <Icon size={16} className={config.color} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-k-text-primary group-hover:text-white transition-colors truncate">
                                                {cleanTemplateName(template.title)}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-k-text-quaternary">
                                                    {questionsCount} {questionsCount === 1 ? 'pergunta' : 'perguntas'} · {config.label}
                                                </span>
                                                {template.created_source === 'ai_assisted' && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                        IA
                                                    </span>
                                                )}
                                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                    template.is_active
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : 'bg-surface-elevated text-k-text-quaternary border border-k-border-subtle'
                                                }`}>
                                                    {template.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ActionsMenu template={template} onDelete={handleDelete} />
                                </div>

                                {/* Question preview */}
                                {questions.length > 0 && (
                                    <div className="ml-11 space-y-1 mb-3">
                                        {questions.slice(0, 3).map((q: any, i: number) => (
                                            <div key={q.id || i} className="flex items-center gap-2 text-xs">
                                                <span className="text-k-text-quaternary w-4 shrink-0">{i + 1}.</span>
                                                <span className="text-k-text-tertiary truncate">{q.label || q.title}</span>
                                                <span className="text-k-text-quaternary shrink-0 text-[10px]">({getTypeLabel(q.type)})</span>
                                            </div>
                                        ))}
                                        {questions.length > 3 && (
                                            <span className="text-[10px] text-k-text-quaternary pl-6">
                                                +{questions.length - 3} mais...
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="ml-11 flex items-center justify-between pt-2 border-t border-k-border-subtle/50 text-[11px]">
                                    <span className="text-k-text-quaternary">
                                        {template.responseCount} {template.responseCount === 1 ? 'resposta' : 'respostas'}
                                        {' · '}v{template.version}
                                        {' · '}{timeAgo(template.created_at)}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            router.push(`/forms?assign=${template.id}`)
                                        }}
                                        className="text-violet-400 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-all font-medium"
                                    >
                                        Enviar para aluno →
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </AppLayout>
    )
}
