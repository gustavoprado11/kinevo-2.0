'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, Loader2, KeyRound, X, ShieldCheck } from 'lucide-react'
import { addCoach } from '@/actions/organizations/add-coach'
import { updateOrgVisibility } from '@/actions/organizations/update-org-visibility'
import { updateCoachStatus } from '@/actions/organizations/update-coach-status'

interface Coach { trainerId: string; role: string; status: string; name: string; email: string }
interface Props {
    organization: { id: string; name: string; visibility: 'open' | 'restricted' }
    isManager: boolean
    currentTrainerId: string
    coaches: Coach[]
}
interface Credential { name: string; email: string; password: string | null }

export function EquipeSection({ organization, isManager, currentTrainerId, coaches }: Props) {
    const router = useRouter()
    const [showForm, setShowForm] = useState(false)
    const [credential, setCredential] = useState<Credential | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function toggleVisibility() {
        if (!isManager) return
        const next = organization.visibility === 'open' ? 'restricted' : 'open'
        startTransition(async () => {
            const res = await updateOrgVisibility({ visibility: next })
            if (res.success) router.refresh()
        })
    }

    function runCoachAction(input: Parameters<typeof updateCoachStatus>[0]) {
        if (!isManager) return
        setActionError(null)
        startTransition(async () => {
            const res = await updateCoachStatus(input)
            if (res.success) router.refresh()
            else setActionError(res.error ?? 'Erro ao atualizar o coach')
        })
    }

    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-violet-500/10 p-2.5">
                        <Users size={18} className="text-violet-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-k-text-primary">Equipe da academia</h2>
                        <p className="text-xs text-k-text-quaternary">{organization.name}</p>
                    </div>
                </div>
                {isManager && (
                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white"
                    >
                        <UserPlus size={15} /> Adicionar coach
                    </button>
                )}
            </div>

            {/* Visibilidade cruzada */}
            <div className="mb-5 flex items-center justify-between rounded-xl border border-k-border-primary p-3.5">
                <div className="flex items-start gap-2.5">
                    <ShieldCheck size={16} className="mt-0.5 text-k-text-quaternary" />
                    <div>
                        <p className="text-sm font-medium text-k-text-primary">Visibilidade entre coaches</p>
                        <p className="text-xs text-k-text-quaternary">
                            {organization.visibility === 'open'
                                ? 'Aberta — todo coach vê e atua nos atletas da academia.'
                                : 'Restrita — coaches veem todos, mas atuam só nos próprios (gestor atua em todos).'}
                        </p>
                    </div>
                </div>
                {isManager && (
                    <button
                        onClick={toggleVisibility}
                        disabled={isPending}
                        className="shrink-0 rounded-lg border border-k-border-primary px-3 py-1.5 text-xs font-medium text-k-text-secondary disabled:opacity-50"
                    >
                        {organization.visibility === 'open' ? 'Tornar restrita' : 'Tornar aberta'}
                    </button>
                )}
            </div>

            {credential && <CredentialBanner credential={credential} onClose={() => setCredential(null)} />}

            {showForm && (
                <AddCoachInline onDone={(cred) => { setShowForm(false); if (cred) setCredential(cred); router.refresh() }} />
            )}

            {actionError && <p className="mb-3 text-sm text-red-500">{actionError}</p>}

            <ul className="divide-y divide-k-border-primary">
                {coaches.map((c) => {
                    const isOwner = c.role === 'owner'
                    const isSelf = c.trainerId === currentTrainerId
                    const canManage = isManager && !isOwner && !isSelf
                    const inactive = c.status === 'inactive'
                    return (
                        <li key={c.trainerId} className={`flex items-center justify-between gap-3 py-3 ${inactive ? 'opacity-60' : ''}`}>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-k-text-primary">
                                    {c.name}{isSelf && ' (você)'}
                                    {inactive && <span className="ml-2 text-xs font-normal text-k-text-quaternary">· inativo</span>}
                                </p>
                                <p className="truncate text-xs text-k-text-quaternary">{c.email}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {canManage && !inactive && (
                                    <button
                                        onClick={() => runCoachAction({ trainerId: c.trainerId, action: 'set_role', role: c.role === 'admin' ? 'coach' : 'admin' })}
                                        disabled={isPending}
                                        className="rounded-lg border border-k-border-primary px-2.5 py-1 text-xs font-medium text-k-text-secondary disabled:opacity-50"
                                    >
                                        {c.role === 'admin' ? 'Tornar coach' : 'Tornar admin'}
                                    </button>
                                )}
                                {canManage && (
                                    <button
                                        onClick={() => runCoachAction({ trainerId: c.trainerId, action: inactive ? 'reactivate' : 'deactivate' })}
                                        disabled={isPending}
                                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${inactive ? 'border-violet-500/40 text-violet-500' : 'border-red-500/40 text-red-500'}`}
                                    >
                                        {inactive ? 'Reativar' : 'Desativar'}
                                    </button>
                                )}
                                <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium capitalize text-violet-500">
                                    {c.role}
                                </span>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function AddCoachInline({ onDone }: { onDone: (cred: Credential | null) => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function submit() {
        setError(null)
        startTransition(async () => {
            const res = await addCoach({ name, email })
            if (!res.success) { setError(res.error ?? 'Erro'); return }
            onDone(res.password ? { name, email, password: res.password } : null)
        })
    }

    return (
        <div className="mb-4 rounded-xl border border-k-border-primary p-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do coach"
                    className="rounded-lg border border-k-border-primary bg-transparent px-3 py-2 text-sm text-k-text-primary outline-none" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
                    className="rounded-lg border border-k-border-primary bg-transparent px-3 py-2 text-sm text-k-text-primary outline-none" />
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button onClick={submit} disabled={isPending || !name.trim() || !email.trim()}
                className="mt-3 flex items-center gap-2 rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {isPending && <Loader2 size={16} className="animate-spin" />} Adicionar
            </button>
        </div>
    )
}

function CredentialBanner({ credential, onClose }: { credential: Credential; onClose: () => void }) {
    return (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-300/50 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex gap-3">
                <KeyRound size={18} className="mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                    <p className="font-medium text-k-text-primary">Acesso criado para {credential.name}</p>
                    <p className="text-k-text-tertiary">Email: <span className="font-mono">{credential.email}</span></p>
                    {credential.password && <p className="text-k-text-tertiary">Senha: <span className="font-mono">{credential.password}</span></p>}
                    <p className="mt-1 text-xs text-k-text-quaternary">Anote e repasse — não será exibida de novo.</p>
                </div>
            </div>
            <button onClick={onClose} className="text-k-text-quaternary"><X size={18} /></button>
        </div>
    )
}
