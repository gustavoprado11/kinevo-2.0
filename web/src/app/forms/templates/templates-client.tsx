'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { deleteFormTemplate } from '@/actions/forms/delete-form-template'
import {
    Plus,
    Search,
    Trash2,
    Loader2,
    Pencil,
    Send,
    ClipboardCheck,
    CheckCircle2,
    MessageSquare,
    ArrowLeft,
} from 'lucide-react'

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
}

interface TemplatesClientProps {
    trainer: Trainer
    templates: FormTemplate[]
}

function categoryInfo(category: string) {
    if (category === 'anamnese') {
        return { label: 'Anamnese', icon: ClipboardCheck, classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    }
    if (category === 'checkin') {
        return { label: 'Check-in', icon: CheckCircle2, classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    }
    return { label: 'Pesquisa', icon: MessageSquare, classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
}

export function TemplatesClient({ trainer, templates: initialTemplates }: TemplatesClientProps) {
    const router = useRouter()
    const [templates, setTemplates] = useState(initialTemplates)
    const [searchQuery, setSearchQuery] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)

    const handleDelete = async (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation()
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
            <div className="min-h-screen bg-surface-primary p-8 font-sans">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <Link
                                href="/forms"
                                className="inline-flex items-center gap-1.5 text-xs text-k-text-secondary hover:text-violet-400 transition-colors mb-3"
                            >
                                <ArrowLeft size={14} />
                                Voltar para Avaliações
                            </Link>
                            <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                                Meus Templates
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Crie e gerencie seus formulários de avaliação
                            </p>
                        </div>
                        <Link
                            href="/forms/templates/new"
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center gap-2 w-fit"
                        >
                            <Plus size={18} strokeWidth={2} />
                            Criar Template
                        </Link>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-[18px] h-[18px] text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-glass-bg border border-k-border-primary rounded-2xl py-3.5 pl-11 pr-4 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 backdrop-blur-md transition-all"
                        />
                    </div>

                    {/* Content Grid */}
                    {filteredTemplates.length === 0 ? (
                        <div className="bg-surface-card rounded-2xl border border-k-border-subtle border-dashed">
                            {searchQuery ? (
                                <div className="flex flex-col items-center justify-center py-24 px-4">
                                    <p className="text-muted-foreground/50 font-medium">
                                        Nenhum template encontrado para &quot;{searchQuery}&quot;
                                    </p>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={ClipboardCheck}
                                    title="Nenhum template criado"
                                    description="Crie seu primeiro formulário de avaliação para começar."
                                    action={{
                                        label: 'Criar Template',
                                        onClick: () => router.push('/forms/templates/new'),
                                    }}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTemplates.map((template) => {
                                const info = categoryInfo(template.category)
                                const Icon = info.icon
                                const questionsCount = (template.schema_json as any)?.questions?.length || 0

                                return (
                                    <div
                                        key={template.id}
                                        onClick={() => router.push(`/forms/templates/new?edit=${template.id}`)}
                                        className="group relative bg-surface-card border border-k-border-primary rounded-2xl p-5 shadow-xl hover:border-k-border-primary hover:bg-glass-bg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                                    >
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-3 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 ${info.classes.split(' ').slice(0, 2).join(' ')}`}>
                                                    <Icon size={20} strokeWidth={2} />
                                                </div>
                                                <h3 className="text-lg font-bold text-k-text-primary tracking-tight leading-snug group-hover:text-violet-200 transition-colors line-clamp-2">
                                                    {template.title}
                                                </h3>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        router.push(`/forms/templates/new?edit=${template.id}`)
                                                    }}
                                                    className="text-k-text-quaternary hover:text-violet-400 hover:bg-glass-bg p-2 rounded-lg transition-all"
                                                >
                                                    <Pencil className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        router.push(`/forms/inbox?assign=${template.id}`)
                                                    }}
                                                    className="text-k-text-quaternary hover:text-emerald-400 hover:bg-glass-bg p-2 rounded-lg transition-all"
                                                >
                                                    <Send className="w-4 h-4" strokeWidth={1.5} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(template.id, e)}
                                                    disabled={deleting === template.id}
                                                    className="text-k-text-quaternary hover:text-red-400 hover:bg-glass-bg p-2 rounded-lg transition-all"
                                                >
                                                    {deleting === template.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {template.description && (
                                            <p className="text-sm text-muted-foreground/60 mb-4 line-clamp-2">
                                                {template.description}
                                            </p>
                                        )}

                                        {/* Questions count */}
                                        {questionsCount > 0 && (
                                            <p className="text-xs text-k-text-secondary mb-4">
                                                {questionsCount} {questionsCount === 1 ? 'pergunta' : 'perguntas'}
                                            </p>
                                        )}

                                        {/* Badges Footer */}
                                        <div className="flex items-center gap-2 mt-auto flex-wrap">
                                            <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${info.classes}`}>
                                                {info.label}
                                            </span>
                                            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border bg-gray-500/10 text-gray-400 border-gray-500/20">
                                                v{template.version}
                                            </span>
                                            {template.created_source === 'ai_assisted' && (
                                                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md border bg-violet-500/10 text-violet-400 border-violet-500/20">
                                                    IA
                                                </span>
                                            )}
                                            <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                                                template.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                            }`}>
                                                {template.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </div>

                                        {/* Hover Glow Effect */}
                                        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-k-border-subtle group-hover:ring-k-border-primary pointer-events-none" />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    )
}
