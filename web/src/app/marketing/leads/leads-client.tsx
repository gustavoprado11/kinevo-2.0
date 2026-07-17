'use client'

import { useMemo, useState, useTransition } from 'react'
import { Inbox, Search, MessageCircle, Mail, Phone, Copy, Check, Clock, Archive, UserPlus, UserCheck, ChevronRight, X, ExternalLink, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateLeadStatus } from '@/actions/leads/update-lead-status'
import { convertLeadToStudent } from '@/actions/leads/convert-lead-to-student'
import { relativeTime, whatsappLink } from '@/lib/leads/format'
import { StudentAccessDialog } from '@/components/students'
import { matchesSearch } from '@kinevo/shared/utils/search-text'
import { AssistantMark } from '@/components/assistant/assistant-mark'

export interface LeadRow {
    id: string
    name: string
    email: string
    whatsapp: string
    goal: string | null
    level: string | null
    message: string | null
    status: 'new' | 'read' | 'contacted' | 'converted' | 'archived'
    source: string | null
    source_slug: string | null
    created_at: string
    converted_to_student_id: string | null
}

type FilterTab = 'all' | 'new' | 'contacted' | 'converted' | 'archived'

interface LeadsClientProps {
    leads: LeadRow[]
    hasLanding: boolean
    landingPublished: boolean
    publicSlug: string | null
}

const TAB_LABELS: Record<FilterTab, string> = {
    all: 'Todos',
    new: 'Novos',
    contacted: 'Contatados',
    converted: 'Convertidos',
    archived: 'Arquivados',
}

const STATUS_META: Record<LeadRow['status'], { label: string; tone: 'new' | 'neutral' | 'positive' | 'muted' }> = {
    new: { label: 'Novo', tone: 'new' },
    read: { label: 'Lido', tone: 'neutral' },
    contacted: { label: 'Contatado', tone: 'neutral' },
    converted: { label: 'Convertido', tone: 'positive' },
    archived: { label: 'Arquivado', tone: 'muted' },
}

function statusBadge(status: LeadRow['status']) {
    const meta = STATUS_META[status]
    const tone = meta.tone
    const styles =
        tone === 'new'
            ? 'bg-violet-500/12 text-violet-700 dark:text-violet-300'
            : tone === 'positive'
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : tone === 'muted'
                    ? 'bg-k-border-subtle text-k-text-quaternary'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone === 'new' ? 'bg-violet-500' : tone === 'positive' ? 'bg-emerald-500' : tone === 'muted' ? 'bg-k-text-quaternary' : 'bg-amber-500'}`} />
            {meta.label}
        </span>
    )
}

export function LeadsClient({ leads, hasLanding, landingPublished, publicSlug }: LeadsClientProps) {
    const [tab, setTab] = useState<FilterTab>('all')
    const [query, setQuery] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [optimistic, setOptimistic] = useState<Record<string, LeadRow['status']>>({})
    const [convertedOptimistic, setConvertedOptimistic] = useState<Record<string, string>>({})

    const enriched: LeadRow[] = useMemo(() => {
        return leads.map((l) => {
            const status = optimistic[l.id] ?? l.status
            const convertedId = convertedOptimistic[l.id] ?? l.converted_to_student_id
            if (status === l.status && convertedId === l.converted_to_student_id) return l
            return { ...l, status, converted_to_student_id: convertedId }
        })
    }, [leads, optimistic, convertedOptimistic])

    const counts = useMemo(() => {
        const c = { all: enriched.length, new: 0, contacted: 0, converted: 0, archived: 0 }
        for (const l of enriched) {
            if (l.status === 'new') c.new++
            else if (l.status === 'contacted') c.contacted++
            else if (l.status === 'converted') c.converted++
            else if (l.status === 'archived') c.archived++
        }
        return c
    }, [enriched])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return enriched.filter((l) => {
            if (tab === 'new' && l.status !== 'new') return false
            if (tab === 'contacted' && l.status !== 'contacted' && l.status !== 'read') return false
            if (tab === 'converted' && l.status !== 'converted') return false
            if (tab === 'archived' && l.status !== 'archived') return false
            if (tab === 'all' && l.status === 'archived') return false
            if (!q) return true
            return (
                matchesSearch(l.name, q) ||
                matchesSearch(l.email, q) ||
                matchesSearch(l.whatsapp, q) ||
                (!!l.message && matchesSearch(l.message, q))
            )
        })
    }, [enriched, tab, query])

    const selected = selectedId ? enriched.find((l) => l.id === selectedId) ?? null : null

    const handleStatusChange = (id: string, status: LeadRow['status']) => {
        setOptimistic((prev) => ({ ...prev, [id]: status }))
        void updateLeadStatus(id, status)
    }

    const handleConverted = (id: string, studentId: string) => {
        setOptimistic((prev) => ({ ...prev, [id]: 'converted' }))
        setConvertedOptimistic((prev) => ({ ...prev, [id]: studentId }))
    }

    /* ── Empty states ── */
    if (leads.length === 0) {
        return (
            <div className="mx-auto max-w-5xl px-4 py-6">
                <div className="rounded-2xl border border-dashed border-k-border-primary bg-glass-bg p-12 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                        <Inbox size={26} strokeWidth={1.6} />
                    </div>
                    <h2 className="text-lg font-semibold text-k-text-primary mb-2">
                        Nenhum lead ainda
                    </h2>
                    <p className="mx-auto max-w-md text-sm text-k-text-tertiary mb-6">
                        {!hasLanding
                            ? 'Crie sua landing pública e comece a captar alunos.'
                            : !landingPublished
                                ? 'Sua landing ainda está como rascunho. Publique pra começar a receber leads.'
                                : 'Compartilhe sua URL na bio do Instagram e nas suas redes. O primeiro lead chega logo.'}
                    </p>
                    {!hasLanding || !landingPublished ? (
                        <Link
                            href="/marketing/landing"
                            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-colors hover:bg-violet-500"
                        >
                            <AssistantMark size={14} />
                            {!hasLanding ? 'Criar landing' : 'Publicar landing'}
                        </Link>
                    ) : (
                        publicSlug && (
                            <CopyUrlButton url={`https://www.kinevoapp.com/com/${publicSlug}`} />
                        )
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-k-text-tertiary">
                    <span className="font-bold text-k-text-primary">
                        {enriched.filter(l => l.status !== 'archived').length}
                    </span>{' '}
                    {enriched.filter(l => l.status !== 'archived').length === 1 ? 'lead ativo' : 'leads ativos'} · captados pela sua landing
                </p>
                {publicSlug && landingPublished && (
                    <a
                        href={`https://www.kinevoapp.com/com/${publicSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
                    >
                        <ExternalLink size={12} /> Ver landing
                    </a>
                )}
            </div>

            {/* Banner se landing não publicada */}
            {hasLanding && !landingPublished && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertCircle size={16} className="mt-0.5 flex-none" />
                    <span>
                        Sua landing está como rascunho — novos leads não conseguem te encontrar. {' '}
                        <Link href="/marketing/landing" className="underline font-semibold">Publicar agora</Link>.
                    </span>
                </div>
            )}

            {/* Tabs + Search */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {(Object.keys(TAB_LABELS) as FilterTab[]).map((t) => {
                        const count = counts[t === 'all' ? 'all' : (t as Exclude<FilterTab, 'all'>)]
                        const active = tab === t
                        return (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={
                                    active
                                        ? 'inline-flex items-center gap-1.5 rounded-lg bg-k-text-primary px-3 py-1.5 text-xs font-bold text-surface-card'
                                        : 'inline-flex items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-semibold text-k-text-secondary hover:bg-glass-bg-active'
                                }
                            >
                                {TAB_LABELS[t]}
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-k-border-subtle text-k-text-tertiary'}`}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>
                <div className="ml-auto relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-k-text-quaternary" />
                    <input
                        type="search"
                        placeholder="Buscar nome, e-mail ou mensagem…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-64 rounded-lg border border-k-border-subtle bg-surface-card pl-8 pr-3 py-1.5 text-xs text-k-text-primary placeholder:text-k-text-quaternary focus:border-violet-500/50 focus:outline-none"
                    />
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-k-border-primary bg-glass-bg p-10 text-center text-sm text-k-text-tertiary">
                    Nenhum lead nessa categoria{query ? ' que case com a busca' : ''}.
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-k-border-primary bg-surface-card divide-y divide-k-border-subtle">
                    {filtered.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => {
                                setSelectedId(l.id)
                                if (l.status === 'new') handleStatusChange(l.id, 'read')
                            }}
                            className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-glass-bg-active"
                        >
                            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-violet-500/12 text-sm font-bold text-violet-700 dark:text-violet-300">
                                {l.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`truncate text-sm ${l.status === 'new' ? 'font-bold text-k-text-primary' : 'font-semibold text-k-text-primary'}`}>
                                        {l.name}
                                    </span>
                                    {statusBadge(l.status)}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-k-text-tertiary">
                                    {l.goal ? <><span className="font-semibold text-k-text-secondary">{l.goal}</span>{' · '}</> : null}
                                    {l.level ? <>{l.level}{' · '}</> : null}
                                    {l.message?.slice(0, 80) || l.email}
                                </div>
                            </div>
                            <div className="flex flex-none items-center gap-3">
                                <span className="text-xs text-k-text-quaternary tabular-nums whitespace-nowrap">
                                    <Clock size={11} className="inline mr-1 -mt-0.5" />
                                    {relativeTime(l.created_at)}
                                </span>
                                <ChevronRight size={14} className="text-k-text-quaternary transition-transform group-hover:translate-x-0.5" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Drawer */}
            {selected && (
                <LeadDrawer
                    lead={selected}
                    onClose={() => setSelectedId(null)}
                    onStatusChange={(s) => handleStatusChange(selected.id, s)}
                    onConverted={(studentId) => handleConverted(selected.id, studentId)}
                />
            )}
        </div>
    )
}

/* ───────── Drawer ───────── */
function LeadDrawer({
    lead,
    onClose,
    onStatusChange,
    onConverted,
}: {
    lead: LeadRow
    onClose: () => void
    onStatusChange: (status: LeadRow['status']) => void
    onConverted: (studentId: string) => void
}) {
    const router = useRouter()
    const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null)
    const [isPending, startTransition] = useTransition()

    /* Conversão */
    const [showConvert, setShowConvert] = useState(false)
    const [modality, setModality] = useState<'online' | 'presential'>('online')
    const [converting, setConverting] = useState(false)
    const [convertError, setConvertError] = useState<string | null>(null)
    const [credentials, setCredentials] = useState<{
        name: string; email: string; password: string; whatsapp: string | null
    } | null>(null)

    const isConverted = lead.status === 'converted' && !!lead.converted_to_student_id

    const handleConvert = async () => {
        setConvertError(null)
        setConverting(true)
        const result = await convertLeadToStudent(lead.id, { modality })
        setConverting(false)
        if (!result.success || !result.studentId) {
            setConvertError(result.message ?? 'Falha ao converter.')
            return
        }
        onConverted(result.studentId)
        setShowConvert(false)
        if (result.credentials && result.credentials.password) {
            // Conta nova → mostra credenciais pro trainer repassar.
            setCredentials(result.credentials)
        } else {
            // Vínculo a aluno existente → vai direto pro perfil.
            router.push(`/students/${result.studentId}`)
        }
    }

    const copy = async (text: string, field: 'email' | 'phone') => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedField(field)
            setTimeout(() => setCopiedField(null), 1600)
        } catch { /* ignore */ }
    }

    const firstName = lead.name.split(' ')[0] ?? lead.name

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in"
            />
            {/* Panel */}
            <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-k-border-primary bg-surface-card shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-k-border-subtle bg-surface-card/95 backdrop-blur px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-violet-500/12 text-sm font-bold text-violet-700 dark:text-violet-300">
                            {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-bold text-k-text-primary">{lead.name}</h2>
                            <p className="text-xs text-k-text-quaternary">
                                {new Date(lead.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-k-text-tertiary hover:bg-glass-bg-active"
                        aria-label="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 px-5 py-5 space-y-5">
                    <div className="flex items-center justify-between">
                        {statusBadge(lead.status)}
                        {lead.source_slug && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">
                                Via /com/{lead.source_slug}
                            </span>
                        )}
                    </div>

                    {/* CTA principal: WhatsApp */}
                    <a
                        href={whatsappLink(lead.whatsapp, firstName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { if (lead.status === 'new' || lead.status === 'read') onStatusChange('contacted') }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-colors hover:bg-emerald-500"
                    >
                        <MessageCircle size={16} />
                        Abrir conversa no WhatsApp
                    </a>

                    {/* Contato */}
                    <section className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">Contato</h3>
                        <button
                            onClick={() => copy(lead.email, 'email')}
                            className="flex w-full items-center gap-3 rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-left transition-colors hover:bg-glass-bg-active"
                        >
                            <Mail size={14} className="text-k-text-tertiary flex-none" />
                            <span className="flex-1 truncate text-sm font-mono text-k-text-primary">{lead.email}</span>
                            {copiedField === 'email' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-k-text-quaternary" />}
                        </button>
                        <button
                            onClick={() => copy(lead.whatsapp, 'phone')}
                            className="flex w-full items-center gap-3 rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-left transition-colors hover:bg-glass-bg-active"
                        >
                            <Phone size={14} className="text-k-text-tertiary flex-none" />
                            <span className="flex-1 truncate text-sm font-mono text-k-text-primary">{lead.whatsapp}</span>
                            {copiedField === 'phone' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-k-text-quaternary" />}
                        </button>
                    </section>

                    {/* Objetivo / Nível */}
                    {(lead.goal || lead.level) && (
                        <section className="space-y-2">
                            <h3 className="text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">Sobre o lead</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {lead.goal && (
                                    <span className="inline-flex items-center rounded-md bg-violet-500/12 px-2.5 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                                        {lead.goal}
                                    </span>
                                )}
                                {lead.level && (
                                    <span className="inline-flex items-center rounded-md bg-k-border-subtle px-2.5 py-1 text-xs font-bold text-k-text-secondary">
                                        {lead.level}
                                    </span>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Mensagem */}
                    {lead.message && (
                        <section className="space-y-2">
                            <h3 className="text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">Mensagem</h3>
                            <div className="rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm leading-relaxed text-k-text-secondary whitespace-pre-wrap">
                                {lead.message}
                            </div>
                        </section>
                    )}

                    {/* Conversão */}
                    <section className="space-y-2 pt-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">Conversão</h3>
                        {isConverted ? (
                            <Link
                                href={`/students/${lead.converted_to_student_id}`}
                                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20"
                            >
                                <UserCheck size={15} />
                                Ver aluno
                            </Link>
                        ) : (
                            <button
                                onClick={() => { setShowConvert(true); setConvertError(null) }}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-colors hover:bg-emerald-500"
                            >
                                <UserPlus size={15} />
                                Converter em aluno
                            </button>
                        )}
                        <p className="text-[11px] text-k-text-quaternary">
                            {isConverted
                                ? 'Lead já virou aluno. Vincule um contrato no perfil dele, se quiser.'
                                : 'Cria o aluno como cortesia (sem contrato). Você vincula o plano depois.'}
                        </p>
                    </section>

                    {/* Status secundário */}
                    <section className="space-y-2 pt-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">Status</h3>
                        <StatusButton
                            active={lead.status === 'contacted'}
                            disabled={isPending || isConverted}
                            onClick={() => startTransition(() => onStatusChange('contacted'))}
                            icon={<MessageCircle size={13} />}
                            label="Marcar como contatado"
                        />
                        <button
                            onClick={() => startTransition(() => onStatusChange('archived'))}
                            disabled={isPending || lead.status === 'archived'}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-k-border-subtle bg-surface-card px-4 py-2 text-xs font-bold text-k-text-tertiary transition-colors hover:bg-glass-bg-active disabled:opacity-50"
                        >
                            <Archive size={13} />
                            {lead.status === 'archived' ? 'Arquivado' : 'Arquivar'}
                        </button>
                    </section>
                </div>
            </aside>

            {/* Modal de confirmação da conversão */}
            {showConvert && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !converting && setShowConvert(false)} />
                    <div className="relative w-full max-w-sm rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-2xl">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                            <UserPlus size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-k-text-primary">Converter em aluno</h3>
                        <p className="mt-1 text-sm text-k-text-tertiary">
                            <b className="text-k-text-secondary">{lead.name}</b> vai entrar como aluno cortesia.
                            Uma conta é criada com o e-mail e WhatsApp do lead.
                        </p>

                        <div className="mt-4 space-y-1.5">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                Modalidade
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                {(['online', 'presential'] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setModality(m)}
                                        className={
                                            modality === m
                                                ? 'rounded-xl bg-k-text-primary px-3 py-2 text-xs font-bold text-surface-card'
                                                : 'rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2 text-xs font-semibold text-k-text-secondary hover:bg-glass-bg-active'
                                        }
                                    >
                                        {m === 'online' ? 'Online' : 'Presencial'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {convertError && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                                <AlertCircle size={14} className="mt-0.5 flex-none" />
                                <span>{convertError}</span>
                            </div>
                        )}

                        <div className="mt-5 flex items-center gap-2">
                            <button
                                onClick={handleConvert}
                                disabled={converting}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-colors hover:bg-emerald-500 disabled:opacity-60"
                            >
                                {converting ? 'Criando…' : 'Criar aluno'}
                            </button>
                            <button
                                onClick={() => setShowConvert(false)}
                                disabled={converting}
                                className="rounded-xl border border-k-border-subtle bg-surface-card px-4 py-2.5 text-sm font-semibold text-k-text-secondary transition-colors hover:bg-glass-bg-active disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Credenciais do aluno recém-criado */}
            <StudentAccessDialog
                isOpen={!!credentials}
                onClose={() => {
                    const id = lead.converted_to_student_id
                    setCredentials(null)
                    if (id) router.push(`/students/${id}`)
                }}
                studentData={credentials}
            />
        </>
    )
}

function StatusButton({
    active,
    disabled,
    onClick,
    icon,
    label,
    tone = 'neutral',
}: {
    active: boolean
    disabled: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    tone?: 'neutral' | 'positive'
}) {
    const activeStyles = tone === 'positive'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
        : 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={
                active
                    ? `flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${activeStyles} disabled:opacity-60`
                    : 'flex items-center justify-center gap-1.5 rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2 text-xs font-bold text-k-text-secondary hover:bg-glass-bg-active disabled:opacity-50'
            }
        >
            {icon}
            {label}
        </button>
    )
}

function CopyUrlButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false)
    const onClick = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
        } catch { /* ignore */ }
    }
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-2 rounded-xl border border-k-border-subtle bg-surface-card px-4 py-2 text-sm font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar URL da landing'}
        </button>
    )
}
