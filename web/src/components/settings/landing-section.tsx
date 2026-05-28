'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
    Globe,
    Sparkles,
    Check,
    Copy,
    AlertTriangle,
    Loader2,
    ExternalLink,
    Pencil,
} from 'lucide-react'
import { slugify, validateSlug } from '@/lib/landing/slug'
import { checkSlugAvailability, type SlugAvailability } from '@/actions/trainer/check-slug-availability'
import { updateTrainerSlug } from '@/actions/trainer/update-slug'
import { updateLandingPublished } from '@/actions/trainer/update-landing-published'
import { useOnboardingStore } from '@/stores/onboarding-store'

const PUBLIC_HOST = 'www.kinevoapp.com'
const URL_PREFIX = `${PUBLIC_HOST}/com/`

interface LandingSectionProps {
    initialSlug: string | null
    landingPublished: boolean
    /** Fallback p/ sugestão inicial quando trainer ainda não tem slug. */
    trainerName: string
}

/**
 * Card em /settings que dá entrada ao mundo da landing pública.
 *
 * M1 (esta versão): só configura o `public_slug` + mostra status.
 * M4 trará o botão "Editar landing" levando ao editor dedicado em /landing.
 */
export function LandingSection({ initialSlug, landingPublished, trainerName }: LandingSectionProps) {
    const [savedSlug, setSavedSlug] = useState(initialSlug ?? '')
    const [published, setPublished] = useState(landingPublished)
    const [editing, setEditing] = useState(false)
    const [input, setInput] = useState(initialSlug ?? '')
    const [availability, setAvailability] = useState<SlugAvailability | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [publishError, setPublishError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)
    const [copied, setCopied] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [isPublishing, startPublishing] = useTransition()
    const [isChecking, setIsChecking] = useState(false)

    const handleTogglePublish = () => {
        if (!savedSlug && !published) {
            setPublishError('Defina uma URL pública antes de publicar.')
            return
        }
        setPublishError(null)
        startPublishing(async () => {
            const next = !published
            const result = await updateLandingPublished(next)
            if (!result.success) {
                setPublishError(result.message)
                return
            }
            setPublished(result.published)
            // Onboarding: publicar a landing fecha o milestone.
            if (result.published) {
                useOnboardingStore.getState().completeMilestone('landing_published')
            }
        })
    }

    const normalized = input.trim().toLowerCase()
    const localValidation = useMemo(() => validateSlug(normalized), [normalized])
    const isSameAsSaved = normalized === savedSlug
    const localValidLabel: string | null = useMemo(() => {
        if (!normalized) return null
        if (localValidation.valid) return null
        switch (localValidation.reason) {
            case 'too_short': return 'Mínimo 3 caracteres.'
            case 'too_long': return 'Máximo 40 caracteres.'
            case 'invalid_format': return 'Use apenas letras, números e hífens.'
            case 'reserved': return 'Esse slug é reservado pelo sistema.'
        }
    }, [normalized, localValidation])

    /* Debounced server check de disponibilidade (apenas se formato local for ok
       e diferente do salvo). */
    useEffect(() => {
        if (!editing) return
        if (!normalized || isSameAsSaved) {
            setAvailability(null)
            setIsChecking(false)
            return
        }
        if (!localValidation.valid) {
            setAvailability({ status: 'invalid', reason: localValidation.reason })
            setIsChecking(false)
            return
        }
        setIsChecking(true)
        const t = setTimeout(async () => {
            const res = await checkSlugAvailability(normalized)
            setAvailability(res)
            setIsChecking(false)
        }, 400)
        return () => { clearTimeout(t); setIsChecking(false) }
    }, [normalized, editing, isSameAsSaved, localValidation])

    const canSave =
        editing &&
        !isPending &&
        normalized !== savedSlug &&
        (normalized === '' || (localValidation.valid && availability?.status === 'available'))

    const handleSuggest = () => {
        const suggestion = slugify(trainerName)
        if (suggestion) setInput(suggestion)
    }

    const handleSave = () => {
        setSaveError(null)
        startTransition(async () => {
            const result = await updateTrainerSlug(normalized || null)
            if (!result.success) {
                setSaveError(result.message)
                return
            }
            setSavedSlug(result.slug)
            setSavedAt(Date.now())
            setEditing(false)
            setAvailability(null)
        })
    }

    const handleCancel = () => {
        setEditing(false)
        setInput(savedSlug)
        setAvailability(null)
        setSaveError(null)
    }

    const handleCopy = async () => {
        if (!savedSlug) return
        try {
            await navigator.clipboard.writeText(`https://${URL_PREFIX}${savedSlug}`)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
        } catch { /* ignore */ }
    }

    /* ── Status visual do badge ── */
    const statusBadge = !savedSlug
        ? { label: 'Sem URL', tone: 'neutral' as const }
        : published
            ? { label: 'Publicada', tone: 'positive' as const }
            : { label: 'Rascunho', tone: 'draft' as const }

    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-k-text-primary">
                        Sua landing pública
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.tone === 'positive'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : statusBadge.tone === 'draft'
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                    : 'bg-k-border-subtle text-k-text-tertiary'
                                }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${statusBadge.tone === 'positive'
                                    ? 'bg-emerald-500'
                                    : statusBadge.tone === 'draft'
                                        ? 'bg-amber-500'
                                        : 'bg-k-text-quaternary'
                                    }`}
                            />
                            {statusBadge.label}
                        </span>
                    </h2>
                    <p className="mt-1 text-sm text-k-text-tertiary">
                        Compartilhe o link na bio do Instagram e capture novos alunos com a sua marca.
                    </p>
                </div>
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Globe size={18} strokeWidth={1.5} />
                </div>
            </div>

            {/* Status / URL line */}
            {!editing && (
                <div className="space-y-3">
                    {savedSlug ? (
                        <div className="flex items-center gap-3 rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3">
                            <span className="text-sm font-mono text-k-text-secondary truncate">
                                <span className="text-k-text-quaternary">{URL_PREFIX}</span>
                                <span className="font-semibold text-k-text-primary">{savedSlug}</span>
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-2.5 py-1.5 text-xs font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
                                    title="Copiar link"
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                                {published && (
                                    <a
                                        href={`https://${URL_PREFIX}${savedSlug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-2.5 py-1.5 text-xs font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
                                        title="Abrir landing"
                                    >
                                        <ExternalLink size={12} />
                                        Abrir
                                    </a>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-k-border-primary bg-glass-bg px-4 py-5 text-center">
                            <p className="text-sm text-k-text-tertiary">
                                Você ainda não tem uma URL pública. Defina um <b>slug</b> pra começar.
                            </p>
                        </div>
                    )}

                    {savedAt && Date.now() - savedAt < 4000 && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check size={13} /> Slug salvo.
                        </div>
                    )}

                    {publishError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                            <AlertTriangle size={14} className="mt-0.5 flex-none" />
                            <span>{publishError}</span>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {savedSlug && (
                            <button
                                type="button"
                                onClick={handleTogglePublish}
                                disabled={isPublishing}
                                className={
                                    published
                                        ? 'inline-flex items-center gap-2 rounded-xl border border-k-border-subtle bg-surface-card px-4 py-2 text-sm font-semibold text-k-text-secondary transition-colors hover:bg-glass-bg-active disabled:opacity-60'
                                        : 'inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:opacity-60'
                                }
                            >
                                {isPublishing ? <Loader2 size={13} className="animate-spin" /> : published ? <Pencil size={13} /> : <Globe size={13} />}
                                {isPublishing ? (published ? 'Despublicando…' : 'Publicando…') : published ? 'Despublicar' : 'Publicar landing'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { setEditing(true); if (!savedSlug && trainerName) setInput(slugify(trainerName)) }}
                            className={
                                savedSlug
                                    ? 'inline-flex items-center gap-2 rounded-xl border border-k-border-subtle bg-surface-card px-4 py-2 text-sm font-semibold text-k-text-secondary transition-colors hover:bg-glass-bg-active'
                                    : 'inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500'
                            }
                        >
                            <Pencil size={13} />
                            {savedSlug ? 'Alterar slug' : 'Definir URL pública'}
                        </button>
                        {savedSlug && (
                            <p className="text-xs text-k-text-quaternary ml-1">
                                Editor completo da landing chega em breve.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Editing form */}
            {editing && (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="slug" className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                            URL pública
                        </label>
                        <div className="flex items-stretch gap-0">
                            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-k-border-subtle bg-glass-bg px-3 text-sm text-k-text-quaternary font-mono">
                                {URL_PREFIX}
                            </span>
                            <input
                                id="slug"
                                value={input}
                                onChange={(e) => setInput(e.target.value.toLowerCase())}
                                placeholder="gustavo-prado"
                                maxLength={40}
                                autoFocus
                                className="flex-1 rounded-r-xl border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-sm font-semibold font-mono text-k-text-primary placeholder:font-normal placeholder:text-k-text-quaternary transition-all focus:border-violet-500/50 focus:outline-none"
                            />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 min-h-[18px]">
                            <SlugFeedback
                                input={normalized}
                                isSameAsSaved={isSameAsSaved}
                                localLabel={localValidLabel}
                                checking={isChecking}
                                availability={availability}
                            />
                            {trainerName && !input && (
                                <button
                                    type="button"
                                    onClick={handleSuggest}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                                >
                                    <Sparkles size={11} /> Sugerir
                                </button>
                            )}
                        </div>
                    </div>

                    {saveError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                            <AlertTriangle size={14} className="mt-0.5 flex-none" />
                            <span>{saveError}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 border-t border-k-border-subtle pt-4">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!canSave}
                            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            {isPending ? 'Salvando…' : normalized === '' ? 'Remover slug' : 'Salvar slug'}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isPending}
                            className="inline-flex items-center rounded-xl border border-k-border-subtle bg-surface-card px-4 py-2 text-sm font-semibold text-k-text-secondary transition-colors hover:bg-glass-bg-active disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                    </div>

                    <p className="text-xs text-k-text-quaternary">
                        Apenas letras minúsculas, números e hífens. Mínimo 3 caracteres.
                    </p>
                </div>
            )}
        </div>
    )
}

/* ── Feedback de validação ── */
function SlugFeedback({
    input,
    isSameAsSaved,
    localLabel,
    checking,
    availability,
}: {
    input: string
    isSameAsSaved: boolean
    localLabel: string | null
    checking: boolean
    availability: SlugAvailability | null
}) {
    if (!input) return null
    if (isSameAsSaved) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-k-text-quaternary">
                Esse é o slug atual.
            </span>
        )
    }
    if (localLabel) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle size={11} /> {localLabel}
            </span>
        )
    }
    if (checking) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-k-text-tertiary">
                <Loader2 size={11} className="animate-spin" /> Verificando…
            </span>
        )
    }
    if (!availability) return null
    if (availability.status === 'available') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check size={11} /> Disponível
            </span>
        )
    }
    if (availability.status === 'taken') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle size={11} /> Em uso por outro treinador.
            </span>
        )
    }
    if (availability.status === 'error') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-k-text-tertiary">
                {availability.message}
            </span>
        )
    }
    return null
}
