'use client'

import { useState } from 'react'
import { X, Building2, Lock, Loader2 } from 'lucide-react'
import { classifyStudioStudents, type StudentDestination } from '@/actions/organizations/classify-studio-students'

export interface UnclassifiedStudent {
    id: string
    name: string
    avatar_url: string | null
}

interface Props {
    isOpen: boolean
    onClose: () => void
    students: UnclassifiedStudent[]
    /** Plano solo pago do coach — sem ele, "Particular" fica travado. */
    hasPaidSolo: boolean
    onDone: () => void
}

/**
 * Entrada no estúdio — o coach classifica a carteira pré-existente aluno a
 * aluno: Estúdio (compartilhado, entra na faixa) × Particular (só ele vê,
 * exige plano solo pago). Default: Estúdio.
 */
export function ClassifyStudentsModal({ isOpen, onClose, students, hasPaidSolo, onDone }: Props) {
    const [choices, setChoices] = useState<Record<string, StudentDestination>>({})
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    if (!isOpen) return null

    const destOf = (id: string): StudentDestination => choices[id] ?? 'studio'
    const privateCount = students.filter(s => destOf(s.id) === 'private').length
    const privateBlocked = privateCount > 0 && !hasPaidSolo

    async function submit() {
        setError(null)
        setLoading(true)
        const res = await classifyStudioStudents({
            assignments: students.map(s => ({ studentId: s.id, destination: destOf(s.id) })),
        })
        setLoading(false)
        if (!res.success) {
            setError(res.error ?? 'Erro ao classificar')
            return
        }
        onDone()
    }

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
            <div className="relative w-full max-w-lg rounded-2xl border border-k-border-subtle bg-white dark:bg-surface-card shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-k-border-subtle p-5">
                    <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#1D1D1F] dark:text-k-text-primary">Classifique seus alunos</h2>
                            <p className="mt-0.5 text-sm text-[#6E6E73] dark:text-k-text-tertiary">
                                Você entrou num estúdio — diga o que fazer com os alunos que já eram seus.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73]">
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[50vh] overflow-y-auto p-5 space-y-2">
                    {students.map(s => {
                        const dest = destOf(s.id)
                        return (
                            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-k-border-subtle px-3.5 py-2.5">
                                <span className="truncate text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">{s.name}</span>
                                <div className="flex shrink-0 gap-1 rounded-lg bg-[#F5F5F7] dark:bg-surface-inset p-0.5">
                                    {(['studio', 'private'] as const).map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setChoices(c => ({ ...c, [s.id]: opt }))}
                                            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all ${
                                                dest === opt
                                                    ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                                    : 'text-[#86868B] dark:text-k-text-tertiary'
                                            }`}
                                        >
                                            {opt === 'studio' ? 'Estúdio' : 'Particular'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="border-t border-k-border-subtle p-5">
                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">
                        <span className="font-semibold">Estúdio</span>: compartilhado com a equipe e conta na faixa.{' '}
                        <span className="font-semibold">Particular</span>: só você vê, no seu plano pessoal.
                    </p>
                    {privateBlocked && (
                        <p className="mt-2 flex items-start gap-1.5 text-xs text-[#FF9500] dark:text-yellow-400">
                            <Lock size={12} className="mt-0.5 shrink-0" />
                            <span>
                                Manter alunos particulares exige um plano pessoal pago —{' '}
                                <a href="/settings" className="underline underline-offset-2">assine em Configurações</a> ou marque todos como Estúdio.
                            </span>
                        </p>
                    )}
                    {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
                    <button
                        onClick={submit}
                        disabled={loading || privateBlocked}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
