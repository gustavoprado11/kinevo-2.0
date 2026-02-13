import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ClipboardCheck, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FormTemplate {
    id: string
    title: string
    description: string | null
    category: 'anamnese' | 'checkin' | 'survey'
    version: number
    is_active: boolean
    created_source: 'manual' | 'ai_assisted'
    schema_json?: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

interface FormsLibraryProps {
    templates: FormTemplate[]
    selectedTemplateId: string | null
    onSelectTemplate: (id: string) => void
    onEditTemplate: (template: FormTemplate) => void
    onAssignTemplate: (template: FormTemplate) => void
    onCreateNew: () => void
}

function categoryInfo(category: FormTemplate['category']) {
    if (category === 'anamnese') {
        return {
            label: 'Anamnese',
            icon: ClipboardCheck,
            tint: 'bg-blue-500/10 text-blue-500',
        }
    }

    if (category === 'checkin') {
        return {
            label: 'Check-in',
            icon: CheckCircle2,
            tint: 'bg-emerald-500/10 text-emerald-500',
        }
    }

    return {
        label: 'Pesquisa',
        icon: MessageSquare,
        tint: 'bg-amber-500/10 text-amber-500',
    }
}

function formatDateTime(value?: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('pt-BR')
}

export function FormsLibrary({
    templates,
    selectedTemplateId,
    onSelectTemplate,
    onEditTemplate,
    onAssignTemplate,
    onCreateNew,
}: FormsLibraryProps) {
    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

    return (
        <section className="h-[calc(100vh-140px)]">
            <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
                {/* Templates List Panel */}
                <div className="flex h-full flex-col rounded-2xl border border-k-border-primary bg-surface-card shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between border-b border-k-border-subtle p-6">
                        <div>
                            <h2 className="text-lg font-bold text-k-text-primary">Templates</h2>
                            <p className="mt-1 text-sm text-k-text-secondary">
                                {templates.length} {templates.length === 1 ? 'item' : 'itens'}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-elevated">
                        {templates.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-center">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated border border-k-border-subtle">
                                    <ClipboardCheck className="h-6 w-6 text-k-text-quaternary opacity-50" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm font-semibold text-k-text-primary">Nenhum template criado</h3>
                                <p className="mt-1 text-xs text-k-text-tertiary max-w-[200px]">
                                    Crie seu primeiro formulário para começar.
                                </p>
                                <div className="mt-4">
                                    <Button
                                        onClick={onCreateNew}
                                        className="h-9 px-4 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 text-xs font-bold rounded-lg transition-all"
                                    >
                                        Criar Novo
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-k-border-subtle">
                                <AnimatePresence mode="popLayout">
                                    {templates.map((template, index) => {
                                        const info = categoryInfo(template.category)
                                        const Icon = info.icon
                                        const isSelected = selectedTemplateId === template.id

                                        return (
                                            <motion.button
                                                key={template.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                                onClick={() => onSelectTemplate(template.id)}
                                                className={`group flex w-full items-center justify-between px-5 py-4 text-left transition-all hover:bg-surface-elevated
                                                    ${isSelected ? 'bg-surface-elevated' : 'bg-transparent'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 ${info.tint}`}>
                                                        <Icon size={20} strokeWidth={2} />
                                                    </div>
                                                    <div>
                                                        <h3 className={`font-bold text-sm ${isSelected ? 'text-k-text-primary' : 'text-k-text-primary'}`}>
                                                            {template.title}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-k-text-secondary">
                                                                {info.label}
                                                            </span>
                                                            <span className="text-xs text-k-text-tertiary">•</span>
                                                            <span className="text-xs text-k-text-secondary">v{template.version}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {template.created_source === 'ai_assisted' && (
                                                    <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-500 uppercase tracking-wider border border-violet-500/20">
                                                        IA
                                                    </span>
                                                )}
                                            </motion.button>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Panel */}
                <aside className="flex h-full flex-col rounded-2xl border border-k-border-primary bg-surface-card shadow-xl overflow-hidden">
                    {!selectedTemplate ? (
                        <div className="flex h-full flex-col items-center justify-center text-center p-8">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated border border-k-border-subtle">
                                <ClipboardCheck className="h-8 w-8 text-k-text-quaternary opacity-50" strokeWidth={1} />
                            </div>
                            <h3 className="text-lg font-bold text-k-text-primary">Selecione um Template</h3>
                            <p className="mt-2 text-sm text-k-text-tertiary max-w-[240px]">
                                Visualize detalhes, edite ou envie para alunos diretamente por aqui.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between border-b border-k-border-subtle p-6">
                                <h2 className="text-lg font-bold text-k-text-primary">Detalhes</h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-surface-elevated">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-8"
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div
                                            className={`mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/5 ${categoryInfo(selectedTemplate.category).tint
                                                }`}
                                        >
                                            {(() => {
                                                const Icon = categoryInfo(selectedTemplate.category).icon
                                                return <Icon size={32} strokeWidth={1.5} />
                                            })()}
                                        </div>
                                        <h3 className="text-xl font-bold text-k-text-primary">{selectedTemplate.title}</h3>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-k-text-secondary ring-1 ring-inset ring-k-border-subtle">
                                                {categoryInfo(selectedTemplate.category).label}
                                            </span>
                                            <span className="text-xs text-k-text-tertiary">·</span>
                                            <span className="text-xs text-k-text-secondary">Versão {selectedTemplate.version}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-xl border border-k-border-subtle bg-surface-elevated/50 p-4">
                                                <span className="block text-[11px] font-bold uppercase tracking-wider text-k-text-tertiary mb-1.5">Origem</span>
                                                <span className="font-medium text-sm text-k-text-primary">
                                                    {selectedTemplate.created_source === 'ai_assisted' ? 'Inteligência Artificial' : 'Manual'}
                                                </span>
                                            </div>
                                            <div className="rounded-xl border border-k-border-subtle bg-surface-elevated/50 p-4">
                                                <span className="block text-[11px] font-bold uppercase tracking-wider text-k-text-tertiary mb-1.5">Atualização</span>
                                                <span className="font-medium text-sm text-k-text-primary">
                                                    {formatDateTime(selectedTemplate.updated_at).split(' ')[0]}
                                                </span>
                                            </div>
                                        </div>

                                        {selectedTemplate.description && (
                                            <div className="space-y-2">
                                                <span className="block text-[11px] font-bold uppercase tracking-wider text-k-text-tertiary px-1">Descrição</span>
                                                <div className="rounded-xl border border-k-border-subtle bg-surface-card p-4">
                                                    <p className="text-sm leading-relaxed text-k-text-secondary">{selectedTemplate.description}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 border-t border-k-border-subtle flex flex-col gap-3">
                                        <Button
                                            onClick={() => onAssignTemplate(selectedTemplate)}
                                            className="w-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 font-bold h-11 rounded-xl transition-all"
                                        >
                                            <Send size={16} strokeWidth={2} className="mr-2" />
                                            Enviar para Aluno
                                        </Button>
                                        <Button
                                            onClick={() => onEditTemplate(selectedTemplate)}
                                            variant="outline"
                                            className="w-full border-k-border-subtle bg-transparent hover:bg-surface-elevated text-k-text-secondary hover:text-k-text-primary font-bold h-11 rounded-xl transition-all"
                                        >
                                            Editar Template
                                        </Button>
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </aside>
            </div>
        </section>
    )
}
