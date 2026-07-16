import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { AppLayout } from '@/components/layout'
import { Users, TrendingUp, Dumbbell, AlertTriangle, User } from 'lucide-react'

const TZ = 'America/Sao_Paulo'

interface CoachRow {
    coach_id: string
    coach_name: string
    active_students: number
    completed_sessions: number
    expected_sessions: number
    adherence_pct: number | null
}
interface StudentRow {
    student_id: string
    at_risk: boolean
}

interface Props {
    trainer: { id: string; name: string; email: string; avatar_url?: string | null; theme?: string | null }
    organization: { id: string; name: string }
}

/**
 * Dashboard do GESTOR — a visão do estúdio vive AQUI (decisão 16/jul: o
 * estúdio usa as telas normais do Kinevo; a aba Estúdio ficou só com a
 * administração). Toggle "Meu painel" leva à visão pessoal (?v=me).
 */
export async function StudioDashboardView({ trainer, organization }: Props) {
    const supabase = await createClient()

    const weekStartDate = getWeekRange(new Date(), TZ).start
    const weekStart = weekStartDate.toISOString().slice(0, 10)
    const prevWeekStart = new Date(weekStartDate.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
    const [coachRes, studentRes, prevCoachRes] = await Promise.all([
        supabase.rpc('get_org_coach_week_stats', { p_org: organization.id, p_week_start: weekStart }),
        supabase.rpc('get_org_students_overview', { p_org: organization.id }),
        supabase.rpc('get_org_coach_week_stats', { p_org: organization.id, p_week_start: prevWeekStart }),
    ])
    const coaches = (coachRes.data ?? []) as CoachRow[]
    const students = (studentRes.data ?? []) as StudentRow[]
    const prevCoaches = (prevCoachRes.data ?? []) as CoachRow[]

    const totalActive = students.length
    const atRisk = students.filter(s => s.at_risk).length
    const doneWeek = coaches.reduce((a, c) => a + Number(c.completed_sessions), 0)
    const expectedWeek = coaches.reduce((a, c) => a + Number(c.expected_sessions), 0)
    const adherence = expectedWeek > 0 ? Math.round((doneWeek * 100) / expectedWeek) : null
    const prevDone = prevCoaches.reduce((a, c) => a + Number(c.completed_sessions), 0)
    const prevExpected = prevCoaches.reduce((a, c) => a + Number(c.expected_sessions), 0)
    const prevAdherence = prevExpected > 0 ? Math.round((prevDone * 100) / prevExpected) : null

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">{organization.name}</h1>
                    <p className="text-sm text-k-text-tertiary mt-0.5">Visão do estúdio</p>
                </div>
                <div className="flex gap-1 rounded-full bg-glass-bg p-1 border border-k-border-subtle">
                    <span className="rounded-full bg-violet-500 px-3.5 py-1.5 text-xs font-bold text-white">Estúdio</span>
                    <Link href="/dashboard?v=me" className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-k-text-tertiary hover:text-k-text-primary">
                        <User size={12} /> Meu painel
                    </Link>
                </div>
            </div>

            {/* KPIs (com a semana passada como referência) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <KpiCard icon={<Users size={18} className="text-violet-500" />} label="Alunos ativos" value={String(totalActive)} />
                <KpiCard
                    icon={<Dumbbell size={18} className="text-emerald-500" />}
                    label="Treinos na semana"
                    value={`${doneWeek}/${expectedWeek}`}
                    hint={prevExpected > 0 ? `sem. passada: ${prevDone}/${prevExpected}` : undefined}
                />
                <KpiCard
                    icon={<TrendingUp size={18} className="text-blue-500" />}
                    label="Aderência"
                    value={adherence === null ? '—' : `${adherence}%`}
                    hint={prevAdherence === null ? undefined : `sem. passada: ${prevAdherence}%`}
                    trend={adherence !== null && prevAdherence !== null ? adherence - prevAdherence : undefined}
                />
                <KpiCard icon={<AlertTriangle size={18} className="text-amber-500" />} label="Em risco" value={String(atRisk)} />
            </div>

            {/* Por treinador */}
            <div className="rounded-xl border border-k-border-subtle bg-surface-card overflow-hidden">
                <div className="px-4 py-3 border-b border-k-border-subtle flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-k-text-primary">Por treinador</h2>
                    <Link href="/estudio/treinadores" className="text-xs font-semibold text-violet-500 hover:text-violet-400">Gerenciar equipe →</Link>
                </div>
                {coaches.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-k-text-quaternary">Nenhum treinador com alunos ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-k-text-quaternary border-b border-k-border-subtle">
                                    <th className="px-4 py-2 font-medium">Treinador</th>
                                    <th className="px-4 py-2 font-medium">Alunos</th>
                                    <th className="px-4 py-2 font-medium">Semana</th>
                                    <th className="px-4 py-2 font-medium">Aderência</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coaches.map(c => (
                                    <tr key={c.coach_id} className="border-b border-k-border-subtle last:border-0">
                                        <td className="px-4 py-2.5 text-k-text-primary font-medium">
                                            {c.coach_id === trainer.id ? `${c.coach_name} (você)` : c.coach_name}
                                        </td>
                                        <td className="px-4 py-2.5 text-k-text-secondary">{c.active_students}</td>
                                        <td className="px-4 py-2.5 text-k-text-secondary">{c.completed_sessions}/{c.expected_sessions}</td>
                                        <td className="px-4 py-2.5">
                                            {c.adherence_pct === null
                                                ? <span className="text-k-text-quaternary">—</span>
                                                : <span className={Number(c.adherence_pct) >= 70 ? 'text-emerald-500' : 'text-amber-500'}>{c.adherence_pct}%</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Atalhos: as telas normais são o lugar da operação */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <ShortcutCard href="/students" title="Alunos" desc={`${totalActive} ativos${atRisk > 0 ? ` · ${atRisk} em risco` : ''}`} />
                <ShortcutCard href="/schedule" title="Agenda do estúdio" desc="Sessões de toda a equipe" />
                <ShortcutCard href="/estudio/plano" title="Plano" desc="Faixa, uso e cobrança" />
            </div>
        </AppLayout>
    )
}

function KpiCard({ icon, label, value, hint, trend }: {
    icon: React.ReactNode
    label: string
    value: string
    hint?: string
    trend?: number
}) {
    return (
        <div className="rounded-2xl border border-k-border-subtle bg-surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary">{label}</span>
            </div>
            <p className="text-2xl font-bold text-k-text-primary">{value}</p>
            {hint && (
                <p className={`mt-1 text-[11px] ${
                    trend === undefined ? 'text-k-text-quaternary' : trend >= 0 ? 'text-emerald-500' : 'text-amber-500'
                }`}>
                    {hint}{trend !== undefined && trend !== 0 ? ` (${trend > 0 ? '+' : ''}${trend}pp)` : ''}
                </p>
            )}
        </div>
    )
}

function ShortcutCard({ href, title, desc }: { href: string; title: string; desc: string }) {
    return (
        <Link href={href} className="rounded-2xl border border-k-border-subtle bg-surface-card p-4 hover:border-violet-500/40 transition-colors">
            <p className="text-sm font-bold text-k-text-primary">{title}</p>
            <p className="mt-0.5 text-xs text-k-text-tertiary">{desc}</p>
        </Link>
    )
}
