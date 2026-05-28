import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
    Inbox,
    Globe,
    ExternalLink,
    Sparkles,
    Pencil,
    ChevronRight,
    TrendingUp,
    UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ShareLandingCard } from './share-landing-card'

export const dynamic = 'force-dynamic'

interface LeadPreview {
    id: string
    name: string
    goal: string | null
    status: string
    created_at: string
}

function relativeTime(iso: string) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime())
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'agora'
    if (m < 60) return `há ${m} min`
    const h = Math.floor(m / 60)
    if (h < 24) return `há ${h}h`
    const d = Math.floor(h / 24)
    if (d < 7) return `há ${d}d`
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default async function MarketingOverviewPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, public_slug, landing_published')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) redirect('/login')
    const t = trainer as { id: string; public_slug: string | null; landing_published: boolean | null }

    /* KPIs: leads (total ativos, novos não lidos, convertidos últimos 30 dias) */
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: leadsAll }, { data: recent }] = await Promise.all([
        supabase
            .from('trainer_leads')
            .select('id, status, created_at')
            .eq('trainer_id', t.id)
            .neq('status', 'archived')
            .gte('created_at', thirtyDaysAgo),
        supabase
            .from('trainer_leads')
            .select('id, name, goal, status, created_at')
            .eq('trainer_id', t.id)
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(5),
    ])

    const leads = (leadsAll ?? []) as Array<{ id: string; status: string; created_at: string }>
    const recentLeads = (recent ?? []) as LeadPreview[]

    const total30 = leads.length
    const novos = leads.filter((l) => l.status === 'new').length
    const convertidos = leads.filter((l) => l.status === 'converted').length
    const conversion = total30 > 0 ? Math.round((convertidos / total30) * 100) : 0

    const landingUrl = t.public_slug
        ? `https://www.kinevoapp.com/com/${t.public_slug}`
        : null

    return (
        <div className="mx-auto max-w-[1500px] px-4 pt-6 pb-10 space-y-5">
            {/* Status landing */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                            <Globe size={18} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-bold text-k-text-primary">Sua landing pública</h2>
                                <StatusBadge
                                    tone={
                                        !t.public_slug ? 'neutral' : t.landing_published ? 'positive' : 'draft'
                                    }
                                    label={
                                        !t.public_slug ? 'Sem URL' : t.landing_published ? 'Publicada' : 'Rascunho'
                                    }
                                />
                            </div>
                            {landingUrl ? (
                                <p className="mt-1 truncate font-mono text-sm text-k-text-secondary">
                                    <span className="text-k-text-quaternary">www.kinevoapp.com/com/</span>
                                    <span className="font-semibold text-k-text-primary">{t.public_slug}</span>
                                </p>
                            ) : (
                                <p className="mt-1 text-sm text-k-text-tertiary">
                                    Defina uma URL pra capturar leads.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {landingUrl && t.landing_published && (
                            <a
                                href={landingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-bold text-k-text-secondary transition-colors hover:bg-glass-bg-active"
                            >
                                <ExternalLink size={12} /> Abrir
                            </a>
                        )}
                        <Link
                            href="/marketing/landing"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition-colors hover:bg-violet-500"
                        >
                            <Pencil size={12} /> {t.public_slug ? 'Editar landing' : 'Criar landing'}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Como divulgar — só quando publicada (URL ativa) */}
            {t.public_slug && t.landing_published && (
                <ShareLandingCard slug={t.public_slug} />
            )}

            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard
                    icon={<Inbox size={16} strokeWidth={1.8} />}
                    label="Leads novos"
                    value={novos}
                    accent="violet"
                    sub={novos > 0 ? 'aguardando contato' : 'tudo em dia'}
                />
                <KpiCard
                    icon={<TrendingUp size={16} strokeWidth={1.8} />}
                    label="Últimos 30 dias"
                    value={total30}
                    accent="neutral"
                    sub="leads recebidos"
                />
                <KpiCard
                    icon={<UserCheck size={16} strokeWidth={1.8} />}
                    label="Conversão"
                    value={total30 > 0 ? `${conversion}%` : '—'}
                    accent="emerald"
                    sub={`${convertidos} virou${convertidos === 1 ? '' : 'am'} aluno`}
                />
            </div>

            {/* Últimos leads */}
            <div className="rounded-2xl border border-k-border-primary bg-surface-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-k-border-subtle px-5 py-3.5">
                    <h2 className="text-sm font-bold text-k-text-primary">Últimos leads</h2>
                    <Link
                        href="/marketing/leads"
                        className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700"
                    >
                        Ver todos <ChevronRight size={12} />
                    </Link>
                </div>
                {recentLeads.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                            <Sparkles size={22} strokeWidth={1.6} />
                        </div>
                        <h3 className="text-sm font-bold text-k-text-primary mb-1">Nenhum lead ainda</h3>
                        <p className="mx-auto max-w-sm text-xs text-k-text-tertiary">
                            {!t.public_slug
                                ? 'Comece definindo sua URL pública.'
                                : !t.landing_published
                                    ? 'Sua landing está como rascunho. Publique pra começar a captar.'
                                    : 'Compartilhe sua URL na bio do Instagram pra capturar os primeiros.'}
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-k-border-subtle">
                        {recentLeads.map((l) => (
                            <li key={l.id}>
                                <Link
                                    href="/marketing/leads"
                                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-glass-bg-active"
                                >
                                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-violet-500/12 text-sm font-bold text-violet-700 dark:text-violet-300">
                                        {l.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`truncate text-sm ${l.status === 'new' ? 'font-bold text-k-text-primary' : 'font-semibold text-k-text-primary'}`}>
                                                {l.name}
                                            </span>
                                            {l.status === 'new' && (
                                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                                            )}
                                        </div>
                                        {l.goal && (
                                            <p className="mt-0.5 truncate text-xs text-k-text-tertiary">{l.goal}</p>
                                        )}
                                    </div>
                                    <span className="text-xs text-k-text-quaternary tabular-nums whitespace-nowrap">
                                        {relativeTime(l.created_at)}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

function KpiCard({
    icon, label, value, sub, accent,
}: {
    icon: React.ReactNode
    label: string
    value: number | string
    sub: string
    accent: 'violet' | 'emerald' | 'neutral'
}) {
    const accentCls =
        accent === 'violet' ? 'bg-violet-500/12 text-violet-600 dark:text-violet-400'
            : accent === 'emerald' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                : 'bg-k-border-subtle text-k-text-tertiary'
    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wide text-k-text-tertiary">
                    {label}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accentCls}`}>
                    {icon}
                </div>
            </div>
            <p className="text-2xl font-bold text-k-text-primary tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-k-text-quaternary">{sub}</p>
        </div>
    )
}

function StatusBadge({ tone, label }: { tone: 'positive' | 'draft' | 'neutral'; label: string }) {
    const cls = tone === 'positive'
        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
        : tone === 'draft'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'bg-k-border-subtle text-k-text-quaternary'
    const dot = tone === 'positive' ? 'bg-emerald-500' : tone === 'draft' ? 'bg-amber-500' : 'bg-k-text-quaternary'
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {label}
        </span>
    )
}
