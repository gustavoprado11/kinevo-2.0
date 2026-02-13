import { AlertTriangle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BuilderSchema {
    questions: {
        id: string
        type: string
        label: string
        required?: boolean
        options?: { value: string; label: string }[]
        scale?: { min: number; max: number }
    }[]
}

interface QualityReport {
    risk_flags: string[]
}

interface FormsBuilderProps {
    templateTitle: string
    setTemplateTitle: (value: string) => void
    templateDescription: string
    setTemplateDescription: (value: string) => void
    templateCategory: 'anamnese' | 'checkin' | 'survey'
    setTemplateCategory: (value: 'anamnese' | 'checkin' | 'survey') => void
    schemaJson: string
    setSchemaJson: (value: string) => void
    onSave: () => void
    isSaving: boolean
    draftSource: 'manual' | 'ai_assisted'

    // AI Props
    aiGoal: string
    setAiGoal: (value: string) => void
    aiStudentContext: string
    setAiStudentContext: (value: string) => void
    aiMaxMinutes: number
    setAiMaxMinutes: (value: number) => void
    onGenerateAI: () => void
    isGeneratingAI: boolean
    onAuditAI: () => void
    isAuditingAI: boolean
    aiProviderSource: 'llm' | 'heuristic' | null
    aiModelUsed: string | null
    aiRuntimeNote: string | null
    aiQualityReport: QualityReport | null
    aiChecklist: string[]

    parsedSchema: BuilderSchema | null
}

function renderPreviewByType(question: any) {
    if (question.type === 'single_choice') {
        return (
            <div className="space-y-2">
                {(question.options || []).slice(0, 3).map((option: any) => (
                    <div
                        key={`${question.id}-${option.value}`}
                        className="rounded-lg border border-k-border-subtle bg-surface-inset px-3 py-2 text-xs text-k-text-secondary"
                    >
                        {option.label}
                    </div>
                ))}
            </div>
        )
    }

    if (question.type === 'scale') {
        const min = question.scale?.min ?? 1
        const max = question.scale?.max ?? 5
        const values = Array.from({ length: Math.max(1, max - min + 1) }, (_, idx) => min + idx)
        return (
            <div className="flex gap-1.5">
                {values.map((value) => (
                    <div
                        key={`${question.id}-${value}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-k-border-subtle bg-surface-inset text-xs text-k-text-secondary"
                    >
                        {value}
                    </div>
                ))}
            </div>
        )
    }

    if (question.type === 'photo') {
        return (
            <div className="rounded-lg border border-dashed border-k-border-primary bg-surface-inset px-3 py-4 text-xs text-k-text-secondary">
                Upload de foto
            </div>
        )
    }

    if (question.type === 'long_text') {
        return <div className="h-20 rounded-lg border border-k-border-subtle bg-surface-inset" />
    }

    return <div className="h-10 rounded-lg border border-k-border-subtle bg-surface-inset" />
}

export function FormsBuilder({
    templateTitle,
    setTemplateTitle,
    templateDescription,
    setTemplateDescription,
    templateCategory,
    setTemplateCategory,
    schemaJson,
    setSchemaJson,
    onSave,
    isSaving,
    draftSource,
    aiGoal,
    setAiGoal,
    aiStudentContext,
    setAiStudentContext,
    aiMaxMinutes,
    setAiMaxMinutes,
    onGenerateAI,
    isGeneratingAI,
    onAuditAI,
    isAuditingAI,
    aiProviderSource,
    aiModelUsed,
    aiRuntimeNote,
    aiQualityReport,
    aiChecklist,
    parsedSchema,
}: FormsBuilderProps) {
    return (
        <section className="rounded-2xl border border-k-border-subtle bg-surface-card p-4 shadow-sm md:p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-k-text-primary">The Canvas</h2>
                    <p className="text-sm text-k-text-secondary">Builder de formulário com preview mobile em tempo real.</p>
                </div>
                {draftSource === 'ai_assisted' && (
                    <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-500">
                        <Sparkles size={12} strokeWidth={2} />
                        Draft por IA
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <div className="space-y-6">
                    {/* AI Assistant Card */}
                    <div className="rounded-xl border border-k-border-subtle bg-surface-elevated p-5 transition-shadow hover:shadow-md">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-k-text-secondary">
                                <Sparkles size={14} className="text-violet-500" />
                                Assistente Inteligente
                            </p>
                            {aiProviderSource && (
                                <span className="text-[10px] text-k-text-secondary">
                                    {aiProviderSource === 'llm' ? 'LLM Output' : 'Heurística'}
                                </span>
                            )}
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Descreva o objetivo (ex: anamnese para iniciantes)"
                                value={aiGoal}
                                onChange={(e) => setAiGoal(e.target.value)}
                                className="w-full rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2 text-sm text-k-text-primary shadow-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                            />

                            <textarea
                                placeholder="Contexto extra (opcional)"
                                value={aiStudentContext}
                                onChange={(e) => setAiStudentContext(e.target.value)}
                                className="min-h-20 w-full rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2 text-sm text-k-text-primary shadow-sm outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                            />

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-medium text-k-text-secondary">Duração estimada</label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={20}
                                        value={aiMaxMinutes}
                                        onChange={(e) => setAiMaxMinutes(Number(e.target.value || 6))}
                                        className="w-16 rounded-lg border border-k-border-subtle bg-surface-card px-2 py-1 text-center text-sm text-k-text-primary outline-none focus:border-violet-500"
                                    />
                                    <span className="text-xs text-k-text-secondary">minutos</span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={onGenerateAI}
                                    disabled={isGeneratingAI}
                                    className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
                                >
                                    <Sparkles size={14} strokeWidth={2} className="mr-2" />
                                    {isGeneratingAI ? 'Gerando...' : 'Gerar Draft'}
                                </Button>
                                <Button
                                    onClick={onAuditAI}
                                    disabled={isAuditingAI}
                                    variant="outline"
                                    className="flex-1 border-k-border-subtle bg-transparent hover:bg-surface-card"
                                >
                                    {isAuditingAI ? 'Auditando...' : 'Auditar Qualidade'}
                                </Button>
                            </div>
                        </div>

                        {(aiModelUsed || aiRuntimeNote) && (
                            <div className="mt-4 rounded-lg bg-surface-inset px-3 py-2 text-[11px] text-k-text-secondary">
                                {aiModelUsed && <span className="block">Modelo: {aiModelUsed}</span>}
                                {aiRuntimeNote && <span className="block opacity-75">{aiRuntimeNote}</span>}
                            </div>
                        )}
                    </div>

                    {/* Quality Audit Alerts */}
                    {aiQualityReport?.risk_flags?.length ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                            <div className="mb-2 flex items-center gap-2 text-amber-600">
                                <AlertTriangle size={16} strokeWidth={2} />
                                <p className="text-xs font-bold uppercase tracking-wide">Atenção de Qualidade</p>
                            </div>
                            <ul className="space-y-1.5 pl-1">
                                {aiQualityReport.risk_flags.map((risk) => (
                                    <li key={risk} className="flex items-start gap-2 text-xs text-k-text-secondary">
                                        <span className="mt-1 block h-1 w-1 rounded-full bg-amber-400" />
                                        {risk}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {/* Manual Config */}
                    <div className="space-y-4 rounded-xl border border-k-border-subtle bg-surface-elevated p-5">
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Título do Formulário"
                                value={templateTitle}
                                onChange={(e) => setTemplateTitle(e.target.value)}
                                className="w-full rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2 text-sm font-medium text-k-text-primary outline-none focus:border-k-border-primary"
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    value={templateCategory}
                                    onChange={(e) => setTemplateCategory(e.target.value as any)}
                                    className="w-full rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2 text-sm text-k-text-primary outline-none focus:border-k-border-primary"
                                >
                                    <option value="anamnese">Anamnese</option>
                                    <option value="checkin">Check-in Regular</option>
                                    <option value="survey">Pesquisa de Satisfação</option>
                                </select>
                            </div>

                            <textarea
                                placeholder="Descrição breve para o aluno"
                                value={templateDescription}
                                onChange={(e) => setTemplateDescription(e.target.value)}
                                className="min-h-20 w-full rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2 text-sm text-k-text-primary outline-none focus:border-k-border-primary"
                            />
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase tracking-wide text-k-text-secondary">Schema JSON</label>
                                <span className="text-[10px] text-k-text-tertiary">Edite para customizar campos</span>
                            </div>
                            <textarea
                                value={schemaJson}
                                onChange={(e) => setSchemaJson(e.target.value)}
                                className="h-64 w-full rounded-lg border border-k-border-subtle bg-surface-card px-3 py-2 font-mono text-xs text-k-text-primary outline-none focus:border-k-border-primary"
                                spellCheck={false}
                            />
                        </div>

                        <Button
                            onClick={onSave}
                            disabled={isSaving}
                            className="w-full bg-k-text-primary text-surface-card hover:bg-k-text-primary/90"
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Template'}
                        </Button>
                    </div>

                    {/* AI Checklist */}
                    {aiChecklist.length > 0 && (
                        <div className="rounded-xl border border-k-border-subtle bg-surface-card p-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-k-text-secondary">Sugestões de Revisão</p>
                            <ul className="space-y-1">
                                {aiChecklist.map((item) => (
                                    <li key={item} className="flex items-start gap-2 text-xs text-k-text-secondary">
                                        <span className="mt-1.5 block h-1 w-1 rounded-full bg-violet-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Live Preview */}
                <div className="sticky top-6 h-[calc(100vh-120px)] overflow-hidden rounded-[2.5rem] border-[8px] border-surface-elevated bg-surface-card shadow-2xl ring-1 ring-black/5">
                    <div className="absolute top-0 flex w-full justify-center pt-4">
                        <div className="h-6 w-24 rounded-full bg-surface-elevated" />
                    </div>

                    <div className="h-full overflow-y-auto bg-surface-elevated px-6 pb-8 pt-16">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-k-text-primary">{templateTitle || 'Novo Formulário'}</h3>
                            {templateDescription && <p className="mt-2 text-sm text-k-text-secondary">{templateDescription}</p>}
                        </div>

                        {!parsedSchema ? (
                            <div className="rounded-xl border border-dashed border-k-border-subtle p-8 text-center">
                                <p className="text-sm text-k-text-secondary">Schema inválido ou vazio.</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {parsedSchema.questions?.map((question) => (
                                    <div key={question.id} className="rounded-2xl bg-surface-card p-4 shadow-sm">
                                        <div className="mb-3">
                                            <p className="font-medium text-k-text-primary">{question.label}</p>
                                            {question.required && (
                                                <span className="mt-1 block text-[10px] text-k-text-tertiary uppercase tracking-wider">Obrigatório</span>
                                            )}
                                        </div>
                                        {renderPreviewByType(question)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
