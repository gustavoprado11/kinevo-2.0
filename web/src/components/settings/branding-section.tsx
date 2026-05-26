'use client'

import Image from 'next/image'
import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import {
    Sparkles,
    Upload,
    AlertTriangle,
    Dumbbell,
    Play,
    ChevronDown,
    Home,
    MessageCircle,
    Heart,
    Clock,
    User,
    Flame,
    Award,
} from 'lucide-react'
import { updateTrainerBranding } from '@/actions/trainer/update-branding'

type TrainerBranding = {
    name: string
    brand_name?: string | null
    brand_color?: string | null
    brand_logo_url?: string | null
}

interface BrandingSectionProps {
    trainer: TrainerBranding
    /** true quando a conta é de academia (estúdio); muda os rótulos. */
    isStudio?: boolean
}

const KINEVO_PURPLE = '#7C3AED'
const PALETTE = ['#7C3AED', '#F97316', '#0D9488', '#EC4899', '#4F46E5', '#16A34A', '#DC2626', '#0EA5E9']

// ── Utilidades de cor (espelham o app: derivam dark/deep e checam contraste) ──
function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '')
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]
}
function mix(hex: string, target: string, t: number): string {
    const a = hexToRgb(hex)
    const b = hexToRgb(target)
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
function rgba(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r},${g},${b},${alpha})`
}
function luminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex).map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function getInitials(name: string) {
    return (
        name
            .split(' ')
            .filter(Boolean)
            .map((p) => p[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'K'
    )
}

function SaveButton({ label }: { label: string }) {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-500 shadow-lg shadow-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {pending ? 'Salvando...' : label}
        </button>
    )
}

export function BrandingSection({ trainer, isStudio = false }: BrandingSectionProps) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [brandName, setBrandName] = useState(trainer.brand_name ?? '')
    const [brandColor, setBrandColor] = useState(trainer.brand_color ?? KINEVO_PURPLE)
    const [logoPreview, setLogoPreview] = useState<string | null>(trainer.brand_logo_url ?? null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Rótulos por contexto: treinador solo vs academia (estúdio).
    // (Título da seção fica no SettingsSection acima — não duplicamos aqui.)
    const nameLabel = isStudio ? 'Nome do estúdio' : 'Nome da marca'
    const saveLabel = 'Salvar marca'

    const displayName = brandName.trim() || trainer.name
    const initials = getInitials(displayName)
    const lowContrast = luminance(brandColor) > 0.6
    const brandDark = mix(brandColor, '#000000', 0.32)
    const brandDeep = mix(brandColor, '#000000', 0.62)

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Selecione um arquivo de imagem válido.' })
            event.target.value = ''
            return
        }
        setLogoPreview(URL.createObjectURL(file))
    }

    const weekDays = [
        { l: 'seg', n: 19, dot: true },
        { l: 'ter', n: 20, dot: false },
        { l: 'qua', n: 21, dot: true },
        { l: 'qui', n: 22, dot: true, sel: true },
        { l: 'sex', n: 23, dot: false },
        { l: 'sáb', n: 24, dot: true },
        { l: 'dom', n: 25, dot: false },
    ]

    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-sm">
            {/* Intro slim — o título da seção já vem do SettingsSection acima.
                Aqui só a descrição + selo Pro. */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <p className="max-w-xl text-sm text-k-text-tertiary">
                    Seu logo e sua cor aplicados no app dos seus alunos. O selo{' '}
                    <span className="font-semibold text-k-text-secondary">&ldquo;powered by Kinevo&rdquo;</span>{' '}
                    aparece na tela de abertura.
                </p>
                <span className="inline-flex flex-none items-center gap-1 rounded-md bg-gradient-to-br from-violet-600 to-violet-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    <Sparkles size={10} /> Pro
                </span>
            </div>

            <form
                action={async (formData: FormData) => {
                    setMessage(null)
                    formData.set('brand_name', brandName)
                    formData.set('brand_color', brandColor === KINEVO_PURPLE && !trainer.brand_color ? '' : brandColor)
                    const result = await updateTrainerBranding(formData)
                    if (!result.success) {
                        setMessage({ type: 'error', text: result.message })
                        return
                    }
                    if (typeof result.brandLogoUrl !== 'undefined') setLogoPreview(result.brandLogoUrl)
                    setMessage({ type: 'success', text: result.message })
                    router.refresh()
                }}
                className="mx-auto grid w-full max-w-4xl gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12"
            >
                {/* ── Coluna de controles ── */}
                <div className="space-y-5">
                    {/* Logo */}
                    <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">Logo</label>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white shadow-lg"
                                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandDark})` }}
                            >
                                {logoPreview ? (
                                    <Image src={logoPreview} alt="Logo da marca" width={72} height={72} className="h-full w-full object-cover" unoptimized />
                                ) : (
                                    <span>{initials}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-1 items-center gap-3 rounded-xl border border-dashed border-k-border-primary px-4 py-3 text-left transition-all hover:border-violet-500/60 hover:bg-violet-500/5"
                            >
                                <Upload size={18} className="flex-none text-k-text-quaternary" />
                                <span className="flex flex-col">
                                    <span className="text-[13px] font-bold text-k-text-primary">Arraste seu logo ou clique</span>
                                    <span className="text-[11px] text-k-text-quaternary">PNG ou SVG · fundo transparente · mín. 512px</span>
                                </span>
                            </button>
                            <input ref={fileInputRef} name="brand_logo" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </div>
                    </div>

                    {/* Nome */}
                    <div>
                        <label htmlFor="brand_name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                            {nameLabel}
                        </label>
                        <input
                            id="brand_name"
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            maxLength={40}
                            placeholder={trainer.name}
                            className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-2.5 text-sm font-semibold text-k-text-primary placeholder:font-normal placeholder:text-k-text-quaternary transition-all focus:border-violet-500/50 focus:outline-none"
                        />
                    </div>

                    {/* Cor da marca */}
                    <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">Cor da marca</label>
                        <div className="flex flex-wrap items-center gap-2.5">
                            {PALETTE.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setBrandColor(c)}
                                    aria-label={`Cor ${c}`}
                                    className={`h-8 w-8 rounded-lg transition-transform hover:scale-110 ${brandColor.toUpperCase() === c ? 'ring-2 ring-offset-2 ring-offset-surface-card' : ''}`}
                                    style={{ background: c, boxShadow: brandColor.toUpperCase() === c ? `0 0 0 2px ${c}` : undefined }}
                                />
                            ))}
                            <label
                                className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-k-border-primary"
                                title="Cor personalizada"
                            >
                                <Sparkles size={14} className="pointer-events-none absolute text-k-text-quaternary" />
                                <input
                                    type="color"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                                    className="h-11 w-11 cursor-pointer border-0 bg-transparent p-0 opacity-0"
                                />
                            </label>
                        </div>
                        {lowContrast && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                <AlertTriangle size={14} className="flex-none" />
                                Cor muito clara — ajustamos o texto automaticamente para manter a legibilidade.
                            </div>
                        )}
                    </div>

                    {message && (
                        <div
                            className={`rounded-xl border px-3 py-2 text-sm ${message.type === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <div className="border-t border-k-border-subtle pt-4">
                        <SaveButton label={saveLabel} />
                    </div>
                </div>

                {/* ── Preview ao vivo (fiel à home real do app do aluno) ── */}
                <div className="flex flex-col items-center gap-3">
                    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" /> Preview ao vivo
                    </span>
                    <div className="w-[280px] rounded-[34px] bg-black p-2.5 shadow-2xl">
                        <div className="overflow-hidden rounded-[26px] bg-[#F4F5F8] px-3 pt-4 pb-2">
                            {/* header */}
                            <div className="mb-3 flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg text-[13px] font-bold text-white"
                                        style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandDark})` }}
                                    >
                                        {logoPreview ? <Image src={logoPreview} alt="" width={32} height={32} className="h-full w-full object-cover" unoptimized /> : initials}
                                    </div>
                                    <div className="leading-tight">
                                        <div className="text-[9px] font-medium text-zinc-500">Boa noite,</div>
                                        <div className="text-[15px] font-extrabold tracking-tight text-zinc-900">Ana</div>
                                        <div className="text-[9px] font-bold" style={{ color: brandColor }}>{displayName}</div>
                                    </div>
                                </div>
                                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
                                    <User size={16} />
                                </div>
                            </div>

                            {/* week */}
                            <div className="mb-3 flex justify-between gap-1">
                                {weekDays.map((d) => (
                                    <div key={d.l} className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-1.5" style={d.sel ? { background: rgba(brandColor, 0.08) } : undefined}>
                                        <span className="text-[8px] font-bold uppercase" style={{ color: d.sel ? brandColor : '#A1A1AA' }}>{d.l}</span>
                                        <span
                                            className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                                            style={d.sel ? { background: brandColor, color: '#fff' } : { color: '#3F3F46' }}
                                        >
                                            {d.n}
                                        </span>
                                        <span className="h-1 w-1 rounded-full" style={{ background: d.dot ? brandColor : 'transparent' }} />
                                    </div>
                                ))}
                            </div>

                            {/* hero */}
                            <div
                                className="mb-3 rounded-2xl p-3.5"
                                style={{ background: `linear-gradient(135deg,#18181B 0%,#27272A 35%,${brandDeep} 75%,${brandDark} 100%)`, boxShadow: `0 12px 26px -14px ${brandColor}` }}
                            >
                                <div className="mb-2.5 flex items-center justify-between">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10" style={{ background: rgba(brandColor, 0.3) }}>
                                        <Dumbbell size={15} className="text-white" />
                                    </div>
                                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-widest text-white/85">Agendado</span>
                                </div>
                                <div className="text-[8px] font-extrabold uppercase tracking-[1.5px] text-white/55">Treino de hoje</div>
                                <div className="text-[19px] font-extrabold leading-tight tracking-tight text-white">Peito &amp; Tríceps</div>
                                <div className="mt-0.5 text-[10px] text-white/60">Foco em hipertrofia · cadência controlada</div>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-[10px] text-white/70">7 exercícios</span>
                                    <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[11px] font-extrabold shadow" style={{ color: brandDark }}>
                                        <Play size={11} fill="currentColor" /> Iniciar
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-white/10 pt-2.5 text-[8px] font-bold uppercase tracking-wide text-white/60">
                                    Ver progresso do programa <ChevronDown size={11} />
                                </div>
                            </div>

                            {/* readiness (semântico — NÃO recolore) */}
                            <div className="mb-3 rounded-2xl border border-zinc-200 border-l-[3px] border-l-emerald-500 bg-white px-3 py-2.5">
                                <div className="mb-1.5 text-[8px] font-bold uppercase tracking-wide text-zinc-500">Sua prontidão para hoje</div>
                                <div className="flex items-center gap-2.5">
                                    <div className="relative h-[42px] w-[66px] flex-none">
                                        <svg width="66" height="42" viewBox="0 0 92 56">
                                            <path d="M10 46 A36 36 0 0 1 82 46" stroke="rgba(34,197,94,.16)" strokeWidth="7" strokeLinecap="round" fill="none" />
                                            <path d="M10 46 A36 36 0 0 1 82 46" stroke="#22C55E" strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray="113" strokeDashoffset="22" />
                                        </svg>
                                        <div className="absolute inset-x-0 bottom-0 text-center">
                                            <div className="text-[16px] font-extrabold leading-none text-zinc-900">82</div>
                                            <div className="text-[7px] font-bold uppercase text-emerald-600">Ótimo</div>
                                        </div>
                                    </div>
                                    <p className="text-[9.5px] font-medium leading-snug text-zinc-600">Recuperação alta. Bom dia para puxar a intensidade.</p>
                                </div>
                            </div>

                            {/* conquistas */}
                            <div className="mb-1 text-[8px] font-bold uppercase tracking-wide text-zinc-500">Suas conquistas</div>
                            <div className="mb-3 flex gap-1.5">
                                <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 p-2">
                                    <Award size={13} className="mb-1 text-amber-700" />
                                    <div className="text-[10px] font-extrabold text-zinc-900">3 semanas</div>
                                    <div className="text-[8px] text-zinc-500">perfeitas</div>
                                </div>
                                <div className="flex-1 rounded-xl border p-2" style={{ background: rgba(brandColor, 0.08), borderColor: rgba(brandColor, 0.3) }}>
                                    <Flame size={13} className="mb-1" style={{ color: brandColor }} />
                                    <div className="text-[10px] font-extrabold text-zinc-900">8 semanas</div>
                                    <div className="text-[8px] text-zinc-500">consistente</div>
                                </div>
                                <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-2">
                                    <Dumbbell size={13} className="mb-1 text-zinc-400" />
                                    <div className="text-[10px] font-extrabold text-zinc-900">34 treinos</div>
                                    <div className="text-[8px] text-zinc-500">no programa</div>
                                </div>
                            </div>

                            {/* nav glass */}
                            <div className="flex items-center justify-around rounded-2xl border border-black/5 bg-white/85 px-2 py-2 shadow backdrop-blur">
                                {[
                                    { I: Home, on: true },
                                    { I: MessageCircle, on: false },
                                    { I: Heart, on: false },
                                    { I: Clock, on: false },
                                    { I: User, on: false },
                                ].map(({ I, on }, i) => (
                                    <I key={i} size={17} style={{ color: on ? brandColor : '#A1A1AA' }} strokeWidth={2} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <p className="max-w-[280px] text-center text-[11px] leading-snug text-k-text-quaternary">
                        É assim que seus alunos verão o app — com a sua marca.
                    </p>
                </div>
            </form>
        </div>
    )
}
