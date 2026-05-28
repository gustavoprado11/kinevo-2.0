'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
    Check,
    Loader2,
    Sparkles,
    Globe,
    AlertCircle,
    Plus,
    X,
    RefreshCw,
    ExternalLink,
    Smartphone,
    Monitor,
    Trash2,
    Quote,
    ImageUp,
} from 'lucide-react'
import { updateTrainerLanding } from '@/actions/trainer/update-landing'
import { updateLandingHero } from '@/actions/trainer/update-landing-hero'
import type { LandingStats, Testimonial, FaqItem } from '@/lib/landing/defaults'

export interface EditorTrainer {
    id: string
    name: string
    email: string | null
    avatar_url: string | null
    public_slug: string | null
    landing_published: boolean | null
    landing_headline: string | null
    landing_subheadline: string | null
    landing_bio: string | null
    landing_city: string | null
    landing_cref: string | null
    landing_certifications: string[] | null
    landing_specializations: string[] | null
    landing_year_started: number | null
    landing_price_label: string | null
    landing_stats: LandingStats | null
    landing_testimonials: Testimonial[] | null
    landing_faq: FaqItem[] | null
    landing_hero_image_url: string | null
}

interface FormState {
    headline: string
    subheadline: string
    bio: string
    city: string
    cref: string
    certifications: string[]
    specializations: string[]
    yearStarted: string // string no input, number na hora de salvar
    priceLabel: string
    // Stats como string nos inputs; convertidos ao salvar.
    studentsCount: string
    rating: string
    reviewsCount: string
    testimonials: Testimonial[]
    faq: FaqItem[]
}

const CURRENT_YEAR = new Date().getFullYear()
const SPECIALIZATION_SUGGESTIONS = [
    'Hipertrofia',
    'Emagrecimento',
    'Mobilidade',
    'Força',
    'Performance',
    'Reabilitação',
    'Idosos',
    'Pós-parto',
]

function trainerToForm(t: EditorTrainer): FormState {
    const s = t.landing_stats ?? {}
    return {
        headline: t.landing_headline ?? '',
        subheadline: t.landing_subheadline ?? '',
        bio: t.landing_bio ?? '',
        city: t.landing_city ?? '',
        cref: t.landing_cref ?? '',
        certifications: t.landing_certifications ?? [],
        specializations: t.landing_specializations ?? [],
        yearStarted: t.landing_year_started ? String(t.landing_year_started) : '',
        priceLabel: t.landing_price_label ?? '',
        studentsCount: s.students_count != null ? String(s.students_count) : '',
        rating: s.rating != null ? String(s.rating) : '',
        reviewsCount: s.reviews_count != null ? String(s.reviews_count) : '',
        testimonials: t.landing_testimonials ?? [],
        faq: t.landing_faq ?? [],
    }
}

const TESTIMONIALS_MAX = 6
const FAQ_MAX = 10

export function LandingEditor({ trainer }: { trainer: EditorTrainer }) {
    const initial = trainerToForm(trainer)
    const [form, setForm] = useState<FormState>(initial)
    const [savedAt, setSavedAt] = useState<number | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [previewKey, setPreviewKey] = useState(0)
    const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    /* Foto do hero (sobe por ação própria, fora do dirty form) */
    const [heroUrl, setHeroUrl] = useState<string | null>(trainer.landing_hero_image_url)
    const [heroBusy, setHeroBusy] = useState(false)
    const heroInputRef = useRef<HTMLInputElement | null>(null)

    /* dirty tracking */
    const dirty = JSON.stringify(form) !== JSON.stringify(initial)

    const publicUrl = trainer.public_slug
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/com/${trainer.public_slug}`
        : null
    const previewUrl = publicUrl // a landing já carrega rascunho? Não — só renderiza se published. Usamos param.
    // ↑ ISR cacheia 60s; pra ver mudanças imediato, bumpamos `?ts=` no iframe ao salvar.

    /* helpers de form */
    const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const addChip = (key: 'certifications' | 'specializations', value: string) => {
        const v = value.trim()
        if (!v) return
        if (form[key].includes(v)) return
        if (form[key].length >= 8) return
        patch(key, [...form[key], v])
    }
    const removeChip = (key: 'certifications' | 'specializations', idx: number) => {
        patch(key, form[key].filter((_, i) => i !== idx))
    }

    /* Testimonials */
    const addTestimonial = () => {
        if (form.testimonials.length >= TESTIMONIALS_MAX) return
        patch('testimonials', [...form.testimonials, { name: '', quote: '', role: '', goal: '' }])
    }
    const updateTestimonial = (idx: number, field: keyof Testimonial, value: string) => {
        patch('testimonials', form.testimonials.map((t, i) => i === idx ? { ...t, [field]: value } : t))
    }
    const removeTestimonial = (idx: number) => {
        patch('testimonials', form.testimonials.filter((_, i) => i !== idx))
    }

    /* FAQ */
    const addFaq = () => {
        if (form.faq.length >= FAQ_MAX) return
        patch('faq', [...form.faq, { question: '', answer: '' }])
    }
    const updateFaq = (idx: number, field: keyof FaqItem, value: string) => {
        patch('faq', form.faq.map((f, i) => i === idx ? { ...f, [field]: value } : f))
    }
    const removeFaq = (idx: number) => {
        patch('faq', form.faq.filter((_, i) => i !== idx))
    }

    /* Hero photo upload */
    const handleHeroFile = (file: File | undefined) => {
        if (!file) return
        setErrorMsg(null)
        setHeroBusy(true)
        const fd = new FormData()
        fd.append('hero_image', file)
        startTransition(async () => {
            const result = await updateLandingHero(fd)
            setHeroBusy(false)
            if (!result.success) {
                setErrorMsg(result.message ?? 'Falha no upload.')
                return
            }
            setHeroUrl(result.heroImageUrl ?? null)
            setPreviewKey((k) => k + 1)
        })
    }
    const handleHeroRemove = () => {
        setHeroBusy(true)
        const fd = new FormData()
        fd.append('remove', 'true')
        startTransition(async () => {
            const result = await updateLandingHero(fd)
            setHeroBusy(false)
            if (result.success) {
                setHeroUrl(null)
                setPreviewKey((k) => k + 1)
            }
        })
    }

    /* save */
    const handleSave = () => {
        setErrorMsg(null)
        const yearNum = form.yearStarted ? parseInt(form.yearStarted, 10) : null
        if (yearNum !== null && (Number.isNaN(yearNum) || yearNum < 1970 || yearNum > CURRENT_YEAR)) {
            setErrorMsg(`Ano de início deve estar entre 1970 e ${CURRENT_YEAR}.`)
            return
        }
        const ratingNum = form.rating ? parseFloat(form.rating.replace(',', '.')) : null
        if (ratingNum !== null && (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5)) {
            setErrorMsg('A avaliação deve estar entre 0 e 5.')
            return
        }
        const studentsNum = form.studentsCount ? parseInt(form.studentsCount, 10) : null
        const reviewsNum = form.reviewsCount ? parseInt(form.reviewsCount, 10) : null

        // Limpa testimonials/faq incompletos antes de enviar.
        const testimonials = form.testimonials
            .map((t) => ({ ...t, name: t.name.trim(), quote: t.quote.trim() }))
            .filter((t) => t.name.length > 0 && t.quote.length > 0)
        const faq = form.faq
            .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
            .filter((f) => f.question.length > 0 && f.answer.length > 0)

        startTransition(async () => {
            const result = await updateTrainerLanding({
                headline: form.headline,
                subheadline: form.subheadline,
                bio: form.bio,
                city: form.city,
                cref: form.cref,
                certifications: form.certifications,
                specializations: form.specializations,
                yearStarted: yearNum,
                priceLabel: form.priceLabel,
                stats: {
                    students_count: studentsNum,
                    rating: ratingNum,
                    reviews_count: reviewsNum,
                },
                testimonials,
                faq,
            })
            if (!result.success) {
                setErrorMsg(result.message ?? 'Falha ao salvar.')
                return
            }
            setSavedAt(Date.now())
            /* Force reload do iframe pra ver mudanças (sem esperar ISR) */
            setPreviewKey((k) => k + 1)
        })
    }

    /* shortcut Cmd/Ctrl+S */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                if (dirty && !isPending) handleSave()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [dirty, isPending, form]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            {/* Header de seção (o card de URL+publish vive acima neste mesmo
                hub; este editor é só do conteúdo). */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-k-text-primary">Conteúdo da landing</h2>
                    <p className="text-sm text-k-text-tertiary mt-0.5">
                        Personalize headline, bio, credenciais e mais.
                    </p>
                </div>
                {publicUrl && trainer.landing_published && (
                    <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
                    >
                        <ExternalLink size={12} /> Abrir landing
                    </a>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
                {/* ── COLUNA ESQ — FORM ── */}
                <div className="space-y-5">
                    {/* Cabeçalho */}
                    <Section title="Cabeçalho" subtitle="O que o lead vê primeiro.">
                        <Field label="Headline" hint="Frase de impacto. Aparece grande no topo.">
                            <input
                                value={form.headline}
                                onChange={(e) => patch('headline', e.target.value)}
                                placeholder="Treine com método. Sem desculpa."
                                maxLength={200}
                                className={inputCls}
                            />
                            <Counter value={form.headline} max={200} />
                        </Field>
                        <Field label="Subheadline" hint="Reforça o argumento. Aparece logo abaixo.">
                            <textarea
                                value={form.subheadline}
                                onChange={(e) => patch('subheadline', e.target.value)}
                                placeholder="Programas pensados pra quem leva o corpo a sério."
                                maxLength={280}
                                rows={2}
                                className={inputCls}
                            />
                            <Counter value={form.subheadline} max={280} />
                        </Field>
                    </Section>

                    {/* Sobre você */}
                    <Section title="Sobre você" subtitle="Sua bio + onde você atua.">
                        <Field label="Bio" hint="Parágrafo curto sobre seu trabalho.">
                            <textarea
                                value={form.bio}
                                onChange={(e) => patch('bio', e.target.value)}
                                placeholder="Há 8 anos transformo o treino em parte da rotina de gente que..."
                                maxLength={800}
                                rows={5}
                                className={inputCls}
                            />
                            <Counter value={form.bio} max={800} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Cidade" hint="">
                                <input
                                    value={form.city}
                                    onChange={(e) => patch('city', e.target.value)}
                                    placeholder="Belo Horizonte"
                                    maxLength={80}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Ano que começou" hint="Aparece como 'X anos de prática'.">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={form.yearStarted}
                                    onChange={(e) => patch('yearStarted', e.target.value)}
                                    placeholder={String(CURRENT_YEAR - 5)}
                                    min={1970}
                                    max={CURRENT_YEAR}
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* Foto de destaque */}
                    <Section title="Foto de destaque" subtitle="A imagem grande do topo. Sem foto, usamos seu avatar.">
                        <div className="flex items-center gap-4">
                            <div className="h-20 w-20 flex-none overflow-hidden rounded-xl border border-k-border-subtle bg-glass-bg">
                                {(heroUrl ?? trainer.avatar_url) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={heroUrl ?? trainer.avatar_url ?? ''}
                                        alt="Foto do hero"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-k-text-quaternary">
                                        <ImageUp size={22} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <input
                                    ref={heroInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => handleHeroFile(e.target.files?.[0])}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => heroInputRef.current?.click()}
                                        disabled={heroBusy}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-k-border-subtle bg-surface-card px-3 py-2 text-xs font-bold text-k-text-secondary hover:bg-glass-bg-active disabled:opacity-50"
                                    >
                                        {heroBusy ? <Loader2 size={13} className="animate-spin" /> : <ImageUp size={13} />}
                                        {heroUrl ? 'Trocar foto' : 'Enviar foto'}
                                    </button>
                                    {heroUrl && (
                                        <button
                                            type="button"
                                            onClick={handleHeroRemove}
                                            disabled={heroBusy}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-k-border-subtle bg-surface-card px-3 py-2 text-xs font-bold text-k-text-tertiary hover:bg-glass-bg-active disabled:opacity-50"
                                        >
                                            <Trash2 size={13} /> Remover
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-k-text-quaternary">
                                    JPG, PNG ou WebP até 6MB. Salva na hora — não precisa clicar em Salvar.
                                </p>
                            </div>
                        </div>
                    </Section>

                    {/* Credenciais */}
                    <Section title="Credenciais" subtitle="O que prova sua autoridade.">
                        <Field label="CREF" hint="Aparece como 'CREF XXXXX-G/UF'.">
                            <input
                                value={form.cref}
                                onChange={(e) => patch('cref', e.target.value)}
                                placeholder="123456-G/MG"
                                maxLength={40}
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Certificações" hint="Cursos, pós, especializações. Até 8.">
                            <ChipsInput
                                values={form.certifications}
                                onAdd={(v) => addChip('certifications', v)}
                                onRemove={(i) => removeChip('certifications', i)}
                                placeholder="Ex: Pós em Fisiologia do Exercício"
                                max={80}
                            />
                        </Field>
                    </Section>

                    {/* Números */}
                    <Section title="Números" subtitle="Prova de tração. Deixe em branco o que não quiser mostrar.">
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="Alunos" hint="">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={form.studentsCount}
                                    onChange={(e) => patch('studentsCount', e.target.value)}
                                    placeholder="200"
                                    min={0}
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Avaliação" hint="0 a 5">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={form.rating}
                                    onChange={(e) => patch('rating', e.target.value)}
                                    placeholder="4.9"
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Nº reviews" hint="">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={form.reviewsCount}
                                    onChange={(e) => patch('reviewsCount', e.target.value)}
                                    placeholder="48"
                                    min={0}
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* Especializações */}
                    <Section title="Especializações" subtitle="O que você faz de melhor.">
                        <ChipsInput
                            values={form.specializations}
                            onAdd={(v) => addChip('specializations', v)}
                            onRemove={(i) => removeChip('specializations', i)}
                            placeholder="Adicione uma especialização"
                            max={40}
                            suggestions={SPECIALIZATION_SUGGESTIONS.filter(
                                (s) => !form.specializations.includes(s),
                            )}
                        />
                    </Section>

                    {/* Depoimentos */}
                    <Section
                        title="Depoimentos"
                        subtitle={`Prova social de alunos. Até ${TESTIMONIALS_MAX}.`}
                    >
                        <div className="space-y-3">
                            {form.testimonials.map((t, i) => (
                                <div key={i} className="rounded-xl border border-k-border-subtle bg-glass-bg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                            <Quote size={12} /> Depoimento {i + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeTestimonial(i)}
                                            className="rounded-lg p-1 text-k-text-quaternary hover:bg-glass-bg-active hover:text-red-500"
                                            aria-label="Remover depoimento"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <textarea
                                        value={t.quote}
                                        onChange={(e) => updateTestimonial(i, 'quote', e.target.value)}
                                        placeholder="O que o aluno falou sobre treinar com você…"
                                        maxLength={500}
                                        rows={2}
                                        className={inputCls}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            value={t.name}
                                            onChange={(e) => updateTestimonial(i, 'name', e.target.value)}
                                            placeholder="Nome do aluno"
                                            maxLength={80}
                                            className={inputCls}
                                        />
                                        <input
                                            value={t.goal ?? ''}
                                            onChange={(e) => updateTestimonial(i, 'goal', e.target.value)}
                                            placeholder="Objetivo (ex: -12kg)"
                                            maxLength={80}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            ))}
                            {form.testimonials.length < TESTIMONIALS_MAX && (
                                <button
                                    type="button"
                                    onClick={addTestimonial}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-k-border-primary bg-transparent px-3 py-2 text-xs font-bold text-k-text-secondary hover:bg-glass-bg-active"
                                >
                                    <Plus size={13} /> Adicionar depoimento
                                </button>
                            )}
                        </div>
                    </Section>

                    {/* FAQ */}
                    <Section
                        title="Perguntas frequentes"
                        subtitle={`Antecipe dúvidas comuns. Vazio usa um FAQ padrão. Até ${FAQ_MAX}.`}
                    >
                        <div className="space-y-3">
                            {form.faq.map((f, i) => (
                                <div key={i} className="rounded-xl border border-k-border-subtle bg-glass-bg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                                            Pergunta {i + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeFaq(i)}
                                            className="rounded-lg p-1 text-k-text-quaternary hover:bg-glass-bg-active hover:text-red-500"
                                            aria-label="Remover pergunta"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <input
                                        value={f.question}
                                        onChange={(e) => updateFaq(i, 'question', e.target.value)}
                                        placeholder="Pergunta"
                                        maxLength={200}
                                        className={inputCls}
                                    />
                                    <textarea
                                        value={f.answer}
                                        onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                                        placeholder="Resposta"
                                        maxLength={800}
                                        rows={2}
                                        className={inputCls}
                                    />
                                </div>
                            ))}
                            {form.faq.length < FAQ_MAX && (
                                <button
                                    type="button"
                                    onClick={addFaq}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-k-border-primary bg-transparent px-3 py-2 text-xs font-bold text-k-text-secondary hover:bg-glass-bg-active"
                                >
                                    <Plus size={13} /> Adicionar pergunta
                                </button>
                            )}
                        </div>
                    </Section>

                    {/* Plano */}
                    <Section title="Plano" subtitle="Como você descreve seu preço/oferta (opcional).">
                        <Field label="Label de plano" hint="Texto livre — não é checkout.">
                            <input
                                value={form.priceLabel}
                                onChange={(e) => patch('priceLabel', e.target.value)}
                                placeholder="A partir de R$ 350/mês · 3 treinos/semana"
                                maxLength={80}
                                className={inputCls}
                            />
                        </Field>
                    </Section>

                    {/* Error inline */}
                    {errorMsg && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                            <AlertCircle size={14} className="mt-0.5 flex-none" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Save bar (sticky no fim do form, em mobile vira footer) */}
                    <div className="sticky bottom-0 -mx-1 mt-4 flex items-center gap-3 rounded-2xl border border-k-border-primary bg-surface-card/95 px-4 py-3 backdrop-blur-md shadow-lg">
                        <div className="flex-1 text-xs">
                            {dirty ? (
                                <span className="font-semibold text-amber-700 dark:text-amber-300">
                                    Alterações não salvas
                                </span>
                            ) : savedAt && Date.now() - savedAt < 4000 ? (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Check size={12} /> Salvo
                                </span>
                            ) : (
                                <span className="text-k-text-quaternary">Tudo sincronizado.</span>
                            )}
                            <span className="ml-2 text-k-text-quaternary">⌘S</span>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!dirty || isPending}
                            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            {isPending ? 'Salvando…' : 'Salvar'}
                        </button>
                    </div>
                </div>

                {/* ── COLUNA DIR — PREVIEW ── */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-k-border-subtle bg-surface-card p-1">
                            <DeviceTab
                                icon={<Smartphone size={12} />}
                                label="Mobile"
                                active={device === 'mobile'}
                                onClick={() => setDevice('mobile')}
                            />
                            <DeviceTab
                                icon={<Monitor size={12} />}
                                label="Desktop"
                                active={device === 'desktop'}
                                onClick={() => setDevice('desktop')}
                            />
                        </div>
                        <button
                            onClick={() => setPreviewKey((k) => k + 1)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
                            title="Atualizar preview"
                        >
                            <RefreshCw size={12} /> Atualizar
                        </button>
                    </div>

                    {previewUrl ? (
                        <div className="rounded-2xl border border-k-border-primary bg-k-border-subtle p-4 min-h-[calc(100vh-220px)]">
                            <div
                                className="mx-auto overflow-hidden rounded-xl shadow-xl transition-all"
                                style={{
                                    width: device === 'mobile' ? 390 : '100%',
                                    maxWidth: '100%',
                                    height: 'calc(100vh - 260px)',
                                    minHeight: 600,
                                    background: '#FAF7F2',
                                }}
                            >
                                {trainer.landing_published ? (
                                    <iframe
                                        ref={iframeRef}
                                        key={previewKey}
                                        src={`${previewUrl}?preview=${previewKey}`}
                                        title="Preview da landing"
                                        className="h-full w-full border-0"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center px-6 text-center">
                                        <div>
                                            <Globe size={28} className="mx-auto mb-3 text-k-text-quaternary" />
                                            <h3 className="text-base font-bold text-k-text-primary mb-1.5">
                                                Landing como rascunho
                                            </h3>
                                            <p className="mx-auto max-w-xs text-sm text-k-text-tertiary">
                                                Use o botão <b className="text-k-text-secondary">Publicar landing</b> no
                                                card acima pra ativar a página e ver a preview ao vivo aqui.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-k-border-primary bg-glass-bg p-10 text-center">
                            <div>
                                <Globe size={28} className="mx-auto mb-3 text-k-text-quaternary" />
                                <p className="mx-auto max-w-xs text-sm text-k-text-tertiary">
                                    Defina sua <b className="text-k-text-secondary">URL pública</b> no card
                                    acima pra ver o preview aqui.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ───────── Building blocks ───────── */

const inputCls =
    'w-full rounded-xl border border-k-border-subtle bg-glass-bg px-3 py-2.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:border-violet-500/50 focus:outline-none resize-none'

function Section({
    title,
    subtitle,
    children,
}: {
    title: string
    subtitle?: string
    children: React.ReactNode
}) {
    return (
        <section className="rounded-2xl border border-k-border-primary bg-surface-card p-5 shadow-sm space-y-4">
            <div>
                <h2 className="text-sm font-bold text-k-text-primary">{title}</h2>
                {subtitle && <p className="text-xs text-k-text-tertiary mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </section>
    )
}

function Field({
    label,
    hint,
    children,
}: {
    label: string
    hint?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                {label}
            </label>
            {children}
            {hint && <p className="text-[11px] text-k-text-quaternary">{hint}</p>}
        </div>
    )
}

function Counter({ value, max }: { value: string; max: number }) {
    const pct = value.length / max
    const tone = pct > 0.9 ? 'text-amber-600 dark:text-amber-400' : 'text-k-text-quaternary'
    return (
        <p className={`text-right text-[10px] tabular-nums ${tone}`}>
            {value.length} / {max}
        </p>
    )
}

function ChipsInput({
    values,
    onAdd,
    onRemove,
    placeholder,
    max,
    suggestions,
}: {
    values: string[]
    onAdd: (v: string) => void
    onRemove: (i: number) => void
    placeholder: string
    max: number
    suggestions?: string[]
}) {
    const [input, setInput] = useState('')
    const submit = () => {
        if (!input.trim()) return
        onAdd(input)
        setInput('')
    }
    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); submit() }
                    }}
                    placeholder={placeholder}
                    maxLength={max}
                    className={inputCls}
                />
                <button
                    type="button"
                    onClick={submit}
                    disabled={!input.trim() || values.length >= 8}
                    className="flex-none inline-flex items-center gap-1 rounded-xl border border-k-border-subtle bg-surface-card px-3 py-2 text-xs font-bold text-k-text-secondary hover:bg-glass-bg-active disabled:opacity-50"
                >
                    <Plus size={12} /> Adicionar
                </button>
            </div>
            {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {values.map((v, i) => (
                        <span
                            key={`${v}-${i}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/12 px-2.5 py-1 text-xs font-bold text-violet-700 dark:text-violet-300"
                        >
                            {v}
                            <button
                                onClick={() => onRemove(i)}
                                className="rounded p-0.5 hover:bg-violet-500/20"
                                aria-label={`Remover ${v}`}
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            {suggestions && suggestions.length > 0 && values.length < 8 && (
                <div className="pt-1">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-k-text-quaternary">
                        Sugestões
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {suggestions.slice(0, 6).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => onAdd(s)}
                                className="inline-flex items-center gap-1 rounded-md border border-dashed border-k-border-subtle bg-transparent px-2.5 py-1 text-xs font-semibold text-k-text-tertiary hover:bg-glass-bg-active hover:text-k-text-secondary"
                            >
                                + {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function DeviceTab({
    icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={
                active
                    ? 'inline-flex items-center gap-1.5 rounded-md bg-k-text-primary px-3 py-1.5 text-xs font-bold text-surface-card'
                    : 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-k-text-tertiary hover:text-k-text-secondary'
            }
        >
            {icon}
            {label}
        </button>
    )
}
