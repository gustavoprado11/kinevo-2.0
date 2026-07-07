'use client'

// Consultoria IA — client da fila de validação.
//
// O treinador é o VALIDADOR: revisa o rascunho da IA (triagem + racional +
// programa), edita no builder se quiser, e aprova (carimbo CREF) ou rejeita.
// Padrões copiados de forms/inbox-client.tsx (tabela + badges) e
// submission-detail-sheet.tsx (drawer lateral).

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Loader2,
    OctagonAlert, Pencil, ShieldCheck, Sparkles, Stethoscope, X,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { generateConsultoriaDraft } from '@/actions/consultoria/generate-consultoria'
import {
    getConsultoriaDetail,
    type ConsultoriaDetail,
} from '@/actions/consultoria/get-consultoria-detail'
import {
    approveConsultoria,
    rejectConsultoria,
    startConsultoriaReview,
} from '@/actions/consultoria/validate-consultoria'
import { updateTrainerCref } from '@/actions/trainer/update-cref'

// ── Tipos ──

export interface ConsultoriaListItem {
    id: string
    studentId: string
    studentName: string
    status: string
    triageLevel: string | null
    errorMessage: string | null
    createdAt: string
    updatedAt: string
}

interface ConsultoriaClientProps {
    items: ConsultoriaListItem[]
    hasCref: boolean
    aiEnabled: boolean
}

// ── Badges (padrão inbox-client: objetos {label, classes} inline) ──

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
    awaiting_anamnese: { label: 'Aguardando anamnese', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    ready_to_generate: { label: 'Pronta para gerar', classes: 'bg-blue-500/10 text-[#007AFF] dark:text-blue-400 border-blue-500/20' },
    generating: { label: 'Gerando rascunho…', classes: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
    blocked: { label: 'Bloqueada na triagem', classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
    pending_validation: { label: 'Aguardando sua validação', classes: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
    approved: { label: 'Aprovada', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    rejected: { label: 'Rejeitada', classes: 'bg-black/5 text-[#6E6E73] dark:bg-white/5 dark:text-white/50 border-black/10 dark:border-white/10' },
}

const TRIAGE_BADGE: Record<string, { label: string; dot: string }> = {
    green: { label: 'Verde', dot: 'bg-emerald-500' },
    yellow: { label: 'Amarela', dot: 'bg-amber-500' },
    red: { label: 'Vermelha', dot: 'bg-red-500' },
}

const OPEN_STATUSES = ['pending_validation', 'ready_to_generate', 'generating', 'blocked', 'awaiting_anamnese']
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function StatusBadge({ status }: { status: string }) {
    const badge = STATUS_BADGE[status] ?? { label: status, classes: 'bg-black/5 text-[#6E6E73] border-black/10' }
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.classes}`}>
            {status === 'generating' && <Loader2 size={11} className="animate-spin" />}
            {badge.label}
        </span>
    )
}

function TriageBadge({ level }: { level: string | null }) {
    if (!level) return <span className="text-xs text-k-text-quaternary">—</span>
    const badge = TRIAGE_BADGE[level]
    if (!badge) return <span className="text-xs text-k-text-quaternary">—</span>
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-k-text-secondary">
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
        </span>
    )
}

// ── Componente principal ──

export function ConsultoriaClient({ items, hasCref, aiEnabled }: ConsultoriaClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [, startTransition] = useTransition()

    const [generatingId, setGeneratingId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ConsultoriaDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [approving, setApproving] = useState(false)
    const [acknowledged, setAcknowledged] = useState(false)
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [rejecting, setRejecting] = useState(false)
    const [crefDraft, setCrefDraft] = useState('')
    const [savingCref, setSavingCref] = useState(false)
    const [crefSaved, setCrefSaved] = useState(false)

    const open = useMemo(
        () => items.filter(i => OPEN_STATUSES.includes(i.status)),
        [items],
    )
    const history = useMemo(
        () => items.filter(i => !OPEN_STATUSES.includes(i.status)),
        [items],
    )

    const refresh = () => startTransition(() => router.refresh())

    // ── Ações ──

    const handleGenerate = async (id: string) => {
        setGeneratingId(id)
        try {
            const result = await generateConsultoriaDraft(id)
            if (result.success) {
                toast({ message: 'Rascunho gerado! Revise e valide.', type: 'success' })
            } else {
                toast({ message: result.error ?? 'Erro ao gerar.', type: 'error' })
            }
        } finally {
            setGeneratingId(null)
            refresh()
        }
    }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        setAcknowledged(false)
        setRejectMode(false)
        setRejectReason('')
        // Telemetria: marca o início da revisão (fire-and-forget).
        void startConsultoriaReview(id)
        const result = await getConsultoriaDetail(id)
        setDetailLoading(false)
        if (result.success && result.detail) {
            setDetail(result.detail)
        } else {
            toast({ message: result.error ?? 'Erro ao abrir a consultoria.', type: 'error' })
        }
    }

    const closeDetail = () => {
        setDetail(null)
        setRejectMode(false)
    }

    const handleApprove = async () => {
        if (!detail) return
        setApproving(true)
        const result = await approveConsultoria(detail.id, { acknowledgeFlags: acknowledged })
        setApproving(false)
        if (result.success) {
            toast({ message: 'Programa validado e publicado para o aluno!', type: 'success' })
            closeDetail()
            refresh()
        } else {
            toast({ message: result.error ?? 'Erro ao aprovar.', type: 'error' })
        }
    }

    const handleReject = async () => {
        if (!detail) return
        setRejecting(true)
        const result = await rejectConsultoria(detail.id, rejectReason)
        setRejecting(false)
        if (result.success) {
            toast({ message: 'Consultoria rejeitada.', type: 'success' })
            closeDetail()
            refresh()
        } else {
            toast({ message: result.error ?? 'Erro ao rejeitar.', type: 'error' })
        }
    }

    const handleSaveCref = async () => {
        setSavingCref(true)
        const result = await updateTrainerCref(crefDraft)
        setSavingCref(false)
        if (result.success) {
            setCrefSaved(true)
            toast({ message: 'CREF salvo!', type: 'success' })
            refresh()
        } else {
            toast({ message: result.error ?? 'Erro ao salvar CREF.', type: 'error' })
        }
    }

    // ── Render ──

    return (
        <div className="mx-auto max-w-5xl">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2.5 text-2xl font-bold text-k-text-primary">
                        <Stethoscope size={24} className="text-violet-600 dark:text-violet-400" />
                        Consultoria IA
                    </h1>
                    <p className="mt-1 text-sm text-k-text-tertiary">
                        A IA analisa a anamnese e rascunha o programa. Você revisa, ajusta e valida — nada chega ao aluno sem a sua aprovação.
                    </p>
                </div>
            </div>

            {/* Aviso: módulo de prescrição IA desabilitado */}
            {!aiEnabled && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <AlertTriangle size={18} className="mt-0.5 flex-none text-amber-600 dark:text-amber-400" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                        O módulo de prescrição IA não está habilitado para sua conta — a geração de rascunhos não vai funcionar.
                    </p>
                </div>
            )}

            {/* Banner CREF: pré-requisito legal da validação */}
            {!hasCref && !crefSaved && (
                <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <div className="flex items-start gap-3">
                        <ShieldCheck size={18} className="mt-0.5 flex-none text-violet-600 dark:text-violet-400" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-k-text-primary">Cadastre seu CREF para validar prescrições</p>
                            <p className="mt-0.5 text-xs text-k-text-tertiary">
                                Ao aprovar uma consultoria, o programa é publicado com seu nome e CREF — o carimbo de responsabilidade técnica.
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={crefDraft}
                                    onChange={e => setCrefDraft(e.target.value)}
                                    maxLength={40}
                                    placeholder="Ex: 012345-G/SP"
                                    className="w-44 rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-1.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:border-violet-500/50 focus:outline-none"
                                />
                                <button
                                    onClick={handleSaveCref}
                                    disabled={savingCref || crefDraft.trim().length < 3}
                                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                                >
                                    {savingCref ? 'Salvando…' : 'Salvar CREF'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fila aberta */}
            {open.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-k-border-primary bg-surface-card p-10 text-center">
                    <ClipboardList size={32} className="mx-auto text-k-text-quaternary" />
                    <h2 className="mt-3 text-base font-semibold text-k-text-primary">Nenhuma consultoria em andamento</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-k-text-tertiary">
                        Abra o perfil de um aluno e use a ação <span className="font-semibold">Consultoria IA</span> no menu.
                        O aluno responde a anamnese pelo app, a IA rascunha o programa e ele aparece aqui para você validar.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-k-border-primary bg-surface-card">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-k-border-subtle text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                <th className="px-5 py-3">Aluno</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Triagem</th>
                                <th className="px-5 py-3">Atualizada</th>
                                <th className="px-5 py-3 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {open.map(item => (
                                <tr key={item.id} className="border-b border-k-border-subtle/50 last:border-0">
                                    <td className="px-5 py-3.5">
                                        <Link
                                            href={`/students/${item.studentId}`}
                                            className="text-sm font-semibold text-k-text-primary hover:text-violet-600 dark:hover:text-violet-400"
                                        >
                                            {item.studentName}
                                        </Link>
                                        {item.errorMessage && (
                                            <p className="mt-0.5 max-w-xs truncate text-[11px] text-red-500" title={item.errorMessage}>
                                                {item.errorMessage}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5"><StatusBadge status={item.status} /></td>
                                    <td className="px-5 py-3.5"><TriageBadge level={item.triageLevel} /></td>
                                    <td className="px-5 py-3.5 text-xs text-k-text-tertiary">{formatDate(item.updatedAt)}</td>
                                    <td className="px-5 py-3.5 text-right">
                                        {item.status === 'ready_to_generate' && (
                                            <button
                                                onClick={() => handleGenerate(item.id)}
                                                disabled={generatingId !== null}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                                            >
                                                {generatingId === item.id
                                                    ? <><Loader2 size={12} className="animate-spin" /> Gerando…</>
                                                    : <><Sparkles size={12} /> Gerar rascunho IA</>}
                                            </button>
                                        )}
                                        {(item.status === 'pending_validation' || item.status === 'blocked') && (
                                            <button
                                                onClick={() => openDetail(item.id)}
                                                disabled={detailLoading}
                                                className="inline-flex items-center gap-1 rounded-lg border border-k-border-primary px-3 py-1.5 text-xs font-bold text-k-text-primary transition-colors hover:border-violet-500/50 hover:text-violet-600 dark:hover:text-violet-400"
                                            >
                                                {item.status === 'blocked' ? 'Ver triagem' : 'Revisar e validar'}
                                                <ChevronRight size={12} />
                                            </button>
                                        )}
                                        {item.status === 'awaiting_anamnese' && (
                                            <button
                                                onClick={() => openDetail(item.id)}
                                                className="text-xs font-medium text-k-text-quaternary hover:text-k-text-secondary"
                                            >
                                                Detalhes
                                            </button>
                                        )}
                                        {item.status === 'generating' && (
                                            <span className="text-xs text-k-text-quaternary">aguarde…</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Histórico */}
            {history.length > 0 && (
                <div className="mt-8">
                    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">Histórico</h2>
                    <div className="overflow-hidden rounded-2xl border border-k-border-primary bg-surface-card">
                        <table className="w-full text-left">
                            <tbody>
                                {history.map(item => (
                                    <tr key={item.id} className="border-b border-k-border-subtle/50 last:border-0">
                                        <td className="px-5 py-3 text-sm text-k-text-secondary">{item.studentName}</td>
                                        <td className="px-5 py-3"><StatusBadge status={item.status} /></td>
                                        <td className="px-5 py-3"><TriageBadge level={item.triageLevel} /></td>
                                        <td className="px-5 py-3 text-right text-xs text-k-text-tertiary">{formatDate(item.updatedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Drawer de revisão (padrão submission-detail-sheet) ── */}
            {detail && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        onClick={closeDetail}
                    />
                    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto border-l border-k-border-primary bg-surface-card shadow-2xl">
                        {/* Header do drawer */}
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-k-border-subtle bg-surface-card px-6 py-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">Validação da consultoria</p>
                                <h2 className="text-lg font-bold text-k-text-primary">{detail.studentName}</h2>
                                <div className="mt-1 flex items-center gap-2">
                                    <StatusBadge status={detail.status} />
                                    {detail.anamneseSubmittedAt && (
                                        <span className="text-[11px] text-k-text-quaternary">
                                            Anamnese respondida em {formatDate(detail.anamneseSubmittedAt)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={closeDetail}
                                className="rounded-lg p-1.5 text-k-text-tertiary transition-colors hover:bg-black/5 hover:text-k-text-primary dark:hover:bg-white/10"
                                aria-label="Fechar"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 space-y-6 px-6 py-5">
                            {/* Triagem */}
                            <section>
                                <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                    Triagem de risco <TriageBadge level={detail.triageLevel} />
                                </h3>
                                {detail.triageFlags.length === 0 ? (
                                    <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 size={15} /> Nenhum sinal de alerta na anamnese.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {detail.triageFlags.map(flag => (
                                            <li
                                                key={flag.key}
                                                className={`rounded-lg border p-3 text-sm ${flag.severity === 'red'
                                                    ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                                    }`}
                                            >
                                                <span className="flex items-center gap-2 font-semibold">
                                                    {flag.severity === 'red' ? <OctagonAlert size={14} /> : <AlertTriangle size={14} />}
                                                    {flag.label}
                                                </span>
                                                {flag.detail && <p className="mt-1 text-xs opacity-80">{flag.detail}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {detail.status === 'blocked' && (
                                    <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
                                        Triagem vermelha: o rascunho <span className="font-bold">não foi gerado</span>. Converse com o aluno e
                                        oriente avaliação/liberação médica antes de prescrever. Você pode encerrar esta consultoria abaixo.
                                    </p>
                                )}
                            </section>

                            {/* Racional da IA */}
                            {detail.reasoning && (
                                <section>
                                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                        Racional da IA
                                        {typeof detail.reasoning.confidence_score === 'number' && (
                                            <span className="ml-2 font-medium normal-case text-k-text-quaternary">
                                                confiança {Math.round(detail.reasoning.confidence_score * 100)}%
                                            </span>
                                        )}
                                    </h3>
                                    <div className="space-y-2 text-sm text-k-text-secondary">
                                        {detail.reasoning.structure_rationale && <p>{detail.reasoning.structure_rationale}</p>}
                                        {detail.reasoning.volume_rationale && <p>{detail.reasoning.volume_rationale}</p>}
                                        {detail.reasoning.exercise_choices && <p>{detail.reasoning.exercise_choices}</p>}
                                        {detail.reasoning.form_data_used && (
                                            <p className="text-xs text-k-text-tertiary">{detail.reasoning.form_data_used}</p>
                                        )}
                                    </div>
                                    {detail.reasoning.attention_flags && detail.reasoning.attention_flags.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                            {detail.reasoning.attention_flags.map((flag, i) => (
                                                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                                                    <AlertTriangle size={12} className="mt-0.5 flex-none" /> {flag}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            )}

                            {/* Programa */}
                            {detail.program && (
                                <section>
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                            Programa rascunhado
                                        </h3>
                                        <Link
                                            href={`/students/${detail.studentId}/program/${detail.program.id}/edit`}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-500 dark:text-violet-400"
                                        >
                                            <Pencil size={11} /> Editar no builder
                                        </Link>
                                    </div>
                                    <p className="text-sm font-semibold text-k-text-primary">
                                        {detail.program.name}
                                        {detail.program.durationWeeks && (
                                            <span className="ml-2 text-xs font-normal text-k-text-tertiary">
                                                {detail.program.durationWeeks} semanas
                                            </span>
                                        )}
                                    </p>
                                    <div className="mt-2 space-y-3">
                                        {detail.program.workouts.map((workout, wi) => (
                                            <div key={wi} className="rounded-lg border border-k-border-subtle p-3">
                                                <p className="text-sm font-semibold text-k-text-primary">
                                                    {workout.name}
                                                    {workout.scheduledDays.length > 0 && (
                                                        <span className="ml-2 text-[11px] font-normal text-k-text-tertiary">
                                                            {workout.scheduledDays.map(d => DAY_LABELS[d] ?? d).join(' · ')}
                                                        </span>
                                                    )}
                                                </p>
                                                <ul className="mt-1.5 space-y-0.5">
                                                    {workout.items.map((item, ii) => (
                                                        <li key={ii} className="text-xs text-k-text-secondary">
                                                            {item.sets && item.reps
                                                                ? <span className="font-medium tabular-nums">{item.sets}× {item.reps}</span>
                                                                : <span className="font-medium">{item.itemType === 'warmup' ? 'Aquecimento' : item.itemType === 'cardio' ? 'Cardio' : ''}</span>}
                                                            {' '}{item.label}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Rodapé de ações — o portão */}
                        {(detail.status === 'pending_validation' || detail.status === 'blocked') && (
                            <div className="sticky bottom-0 border-t border-k-border-subtle bg-surface-card px-6 py-4">
                                {detail.status === 'pending_validation' && (
                                    <>
                                        {detail.triageLevel === 'yellow' && (
                                            <label className="mb-3 flex items-start gap-2 text-xs text-k-text-secondary">
                                                <input
                                                    type="checkbox"
                                                    checked={acknowledged}
                                                    onChange={e => setAcknowledged(e.target.checked)}
                                                    className="mt-0.5 h-4 w-4 rounded border-k-border-primary accent-violet-600"
                                                />
                                                <span>
                                                    Revisei os <span className="font-semibold">sinais de alerta da triagem</span> e considero o
                                                    programa adequado para este aluno.
                                                </span>
                                            </label>
                                        )}
                                        {!rejectMode ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <button
                                                    onClick={() => setRejectMode(true)}
                                                    className="text-xs font-semibold text-red-500 hover:text-red-400"
                                                >
                                                    Rejeitar rascunho
                                                </button>
                                                <button
                                                    onClick={handleApprove}
                                                    disabled={approving || (detail.triageLevel === 'yellow' && !acknowledged)}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {approving
                                                        ? <><Loader2 size={14} className="animate-spin" /> Publicando…</>
                                                        : <><ShieldCheck size={14} /> Validar e publicar</>}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={rejectReason}
                                                    onChange={e => setRejectReason(e.target.value)}
                                                    rows={2}
                                                    placeholder="Motivo da rejeição (obrigatório)…"
                                                    className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:border-red-500/50 focus:outline-none"
                                                />
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setRejectMode(false)}
                                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-k-text-tertiary hover:text-k-text-primary"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={handleReject}
                                                        disabled={rejecting || rejectReason.trim().length === 0}
                                                        className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                                                    >
                                                        {rejecting ? 'Rejeitando…' : 'Confirmar rejeição'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {detail.status === 'blocked' && (
                                    !rejectMode ? (
                                        <button
                                            onClick={() => { setRejectMode(true); setRejectReason('Triagem vermelha — encaminhado para liberação médica.') }}
                                            className="w-full rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                                        >
                                            Encerrar consultoria
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <textarea
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                rows={2}
                                                className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary focus:border-red-500/50 focus:outline-none"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setRejectMode(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-k-text-tertiary hover:text-k-text-primary">
                                                    Voltar
                                                </button>
                                                <button
                                                    onClick={handleReject}
                                                    disabled={rejecting || rejectReason.trim().length === 0}
                                                    className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                                                >
                                                    {rejecting ? 'Encerrando…' : 'Confirmar'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
