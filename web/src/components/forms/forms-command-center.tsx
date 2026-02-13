import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronRight, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Student {
    id: string
    name: string
    email: string
    status: 'active' | 'inactive' | 'pending'
}

interface FormTemplate {
    id: string
    title: string
    category: 'anamnese' | 'checkin' | 'survey'
    version: number
}

interface Submission {
    id: string
    form_template_id: string
    student_id: string
    status: 'draft' | 'submitted' | 'reviewed'
    submitted_at: string | null
    feedback_sent_at: string | null
    created_at: string
}

interface FormsCommandCenterProps {
    templates: FormTemplate[]
    activeStudents: Student[]
    submissions: Submission[]

    // Assign State
    assignmentTemplateId: string
    setAssignmentTemplateId: (id: string) => void
    assignmentDueAt: string
    setAssignmentDueAt: (date: string) => void
    assignmentMessage: string
    setAssignmentMessage: (msg: string) => void
    selectedStudentIds: string[]
    toggleStudent: (id: string) => void
    onAssign: () => void
    isAssigning: boolean
    assignResult: string | null

    // Inbox State
    submissionSearch: string
    setSubmissionSearch: (term: string) => void
    activeSubmissionId: string | null
    onSelectSubmission: (id: string) => void

    // Helpers
    getStudent: (id: string) => Student | undefined
    getTemplate: (id: string) => FormTemplate | undefined
    formatDateTime: (date: string | null) => string
    getInitials: (name?: string) => string
}

function submissionStatus(submission: Submission) {
    if (submission.status === 'reviewed' || submission.feedback_sent_at) {
        return {
            label: 'Feedback Enviado',
            className: 'bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20',
        }
    }

    if (submission.status === 'submitted' || submission.submitted_at) {
        return {
            label: 'Concluído',
            className: 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20',
        }
    }

    return {
        label: 'Pendente',
        className: 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20',
    }
}

export function FormsCommandCenter({
    templates,
    activeStudents,
    submissions,
    assignmentTemplateId,
    setAssignmentTemplateId,
    assignmentDueAt,
    setAssignmentDueAt,
    assignmentMessage,
    setAssignmentMessage,
    selectedStudentIds,
    toggleStudent,
    onAssign,
    isAssigning,
    assignResult,
    submissionSearch,
    setSubmissionSearch,
    activeSubmissionId,
    onSelectSubmission,
    getStudent,
    getTemplate,
    formatDateTime,
    getInitials,
}: FormsCommandCenterProps) {
    return (
        <section className="h-[calc(100vh-140px)]">
            <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1.8fr]">

                {/* Quick Assign Panel (Active Control) */}
                <div className="flex flex-col gap-4 overflow-y-auto">
                    <div className="rounded-2xl border border-k-border-subtle bg-surface-card px-5 py-5 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated border border-k-border-subtle">
                                <Send size={14} className="text-k-text-primary" strokeWidth={2} />
                            </div>
                            <h2 className="text-sm font-bold text-k-text-primary uppercase tracking-wide">Envio Rápido</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                                    Template
                                </label>
                                <select
                                    value={assignmentTemplateId}
                                    onChange={(e) => setAssignmentTemplateId(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                                >
                                    <option value="">Selecione um template...</option>
                                    {templates.map((template) => (
                                        <option key={template.id} value={template.id}>
                                            {template.title} (v{template.version})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                                    Data de Vencimento
                                </label>
                                <input
                                    type="datetime-local"
                                    value={assignmentDueAt}
                                    onChange={(e) => setAssignmentDueAt(e.target.value)}
                                    className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                                    Mensagem Opcional
                                </label>
                                <textarea
                                    placeholder="Adicione uma nota pessoal para os alunos..."
                                    value={assignmentMessage}
                                    onChange={(e) => setAssignmentMessage(e.target.value)}
                                    className="min-h-[80px] w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-k-text-tertiary uppercase tracking-widest mb-1.5">
                                    Selecionar Alunos (Ativos)
                                </label>
                                <div className="max-h-48 overflow-y-auto rounded-xl border border-k-border-subtle bg-glass-bg p-2 scrollbar-thin scrollbar-thumb-surface-elevated">
                                    {activeStudents.length === 0 ? (
                                        <p className="px-2 py-4 text-center text-xs text-k-text-secondary">Nenhum aluno ativo encontrado.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {activeStudents.map((student) => (
                                                <label
                                                    key={student.id}
                                                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all ${selectedStudentIds.includes(student.id) ? 'bg-violet-500/10' : 'hover:bg-surface-elevated'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudentIds.includes(student.id)}
                                                        onChange={() => toggleStudent(student.id)}
                                                        className="h-4 w-4 rounded border-k-border-subtle text-violet-600 focus:ring-violet-500 accent-violet-600"
                                                    />
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-inset border border-white/5 text-[10px] font-bold text-k-text-secondary">
                                                        {getInitials(student.name)}
                                                    </div>
                                                    <span className={`text-sm font-medium ${selectedStudentIds.includes(student.id) ? 'text-violet-400' : 'text-k-text-primary'}`}>
                                                        {student.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button
                                onClick={onAssign}
                                disabled={isAssigning || !assignmentTemplateId || selectedStudentIds.length === 0}
                                className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 font-bold rounded-xl transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                {isAssigning ? 'Enviando...' : `Enviar para ${selectedStudentIds.length} alunos`}
                            </Button>

                            {assignResult && (
                                <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 size={14} className="mt-0.5" />
                                    <p>{assignResult}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Inbox List */}
                <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card shadow-sm">
                    <div className="flex items-center justify-between border-b border-k-border-subtle px-5 py-4 min-h-[56px]">
                        <div>
                            <h2 className="text-sm font-bold text-k-text-primary uppercase tracking-wide">Inbox de Submissões</h2>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={submissionSearch}
                                onChange={(e) => setSubmissionSearch(e.target.value)}
                                className="w-48 rounded-lg border border-k-border-subtle bg-surface-elevated px-3 py-1.5 text-xs text-k-text-primary outline-none transition focus:border-k-border-primary focus:ring-1 focus:ring-k-border-primary/20"
                            />
                        </div>
                    </div>

                    <div className="border-b border-k-border-subtle bg-surface-elevated/30 px-5 py-2">
                        <div className="grid grid-cols-[1.5fr_1.2fr_1fr_1fr_24px] gap-4 text-[10px] font-bold uppercase tracking-widest text-k-text-tertiary">
                            <span>Aluno</span>
                            <span>Template</span>
                            <span>Data</span>
                            <span>Status</span>
                            <span />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {submissions.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-k-text-secondary">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated border border-k-border-subtle">
                                    <MessageSquare size={20} className="text-k-text-quaternary" />
                                </div>
                                <p className="text-sm font-medium">Nenhuma submissão encontrada</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-k-border-subtle">
                                <AnimatePresence initial={false}>
                                    {submissions.map((submission) => {
                                        const student = getStudent(submission.student_id)
                                        const template = getTemplate(submission.form_template_id)
                                        const status = submissionStatus(submission)
                                        const isActive = activeSubmissionId === submission.id

                                        return (
                                            <motion.button
                                                key={submission.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                onClick={() => onSelectSubmission(submission.id)}
                                                className={`grid w-full cursor-pointer grid-cols-[1.5fr_1.2fr_1fr_1fr_24px] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-elevated ${isActive ? 'bg-violet-500/5' : ''
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated border border-white/5 text-xs font-bold text-k-text-secondary">
                                                        {getInitials(student?.name)}
                                                    </div>
                                                    <span className={`truncate text-sm font-medium ${isActive ? 'text-violet-400' : 'text-k-text-primary'}`}>
                                                        {student?.name || 'Aluno Desconhecido'}
                                                    </span>
                                                </div>

                                                <span className="truncate text-sm text-k-text-secondary">
                                                    {template?.title || 'Template Removido'}
                                                </span>

                                                <span className="text-xs text-k-text-tertiary font-medium">
                                                    {formatDateTime(submission.submitted_at || submission.created_at)}
                                                </span>

                                                <div>
                                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${status.className.replace('ring-1', 'border')}`}>
                                                        {status.label}
                                                    </span>
                                                </div>

                                                <ChevronRight size={14} className="text-k-text-tertiary opacity-50" />
                                            </motion.button>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
