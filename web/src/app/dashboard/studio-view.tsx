import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { AppLayout } from '@/components/layout'
import { User } from 'lucide-react'

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
                <div className="inline-flex rounded-control border border-k-border-primary bg-surface-card overflow-hidden">
                    <span className="bg-surface-inset px-3.5 py-1.5 text-xs font-semibold text-k-text-primary">Estúdio</span>
                    <Link href="/dashboard?v=me" className="flex items-center gap-1.5 border-l border-k-border-subtle px-3.5 py-1.5 text-xs font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset transition-colors">
                        <User size={12} /> Meu painel
                    </Link>
                </div>
            </div>

            {/* Régua de KPIs — painel único, divisores hairline; semana passada como referência */}
            <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-panel border border-k-border-subtle bg-k-border-subtle overflow-hidden">
                <KpiCell label="Alunos ativos" value={String(totalActive)} />
                <KpiCell
                    label="Treinos na semana"
                    value={`${doneWeek}/${expectedWeek}`}
                    hint={prevExpected > 0 ? `sem. passada: ${prevDone}/${prevExpected}` : undefined}
                />
                <KpiCell
                    label="Aderência"
                    value={adherence === null ? '—' : `${adherence}%`}
                    hint={prevAdherence === null ? undefined : `sem. passada: ${prevAdherence}%`}
                    trend={adherence !== null && prevAdherence !== null ? adherence - prevAdherence : undefined}
                />
                <KpiCell label="Em risco" value={String(atRisk)} attention={atRisk > 0} />
            </div>

            {/* Por treinador */}
            <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                <div className="px-4 py-3 border-b border-k-border-subtle flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-k-text-primary">Por treinador</h2>
                    <Link href="/estudio/treinadores" className="text-xs font-medium text-k-text-secondary hover:text-k-text-primary transition-colors">Gerenciar equipe →</Link>
                </div>
                {coaches.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-k-text-quaternary">Nenhum treinador com alunos ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-k-border-subtle">
                                    <th className="px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-k-text-tertiary">Treinador</th>
                                    <th className="px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-k-text-tertiary text-right">Alunos</th>
                                    <th className="px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-k-text-tertiary text-right">Semana</th>
                                    <th className="px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-k-text-tertiary text-right">Aderência</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coaches.map(c => (
                                    <tr key={c.coach_id} className="border-b border-k-border-subtle last:border-0">
                                        <td className="px-4 py-2.5 text-k-text-primary font-medium">
                                            {c.coach_id === trainer.id
                                                ? <>{c.coach_name} <span className="text-k-text-tertiary font-normal">· você</span></>
                                                : c.coach_name}
                                        </td>
                                        <td className="px-4 py-2.5 text-k-text-secondary text-right tabular-nums">{c.active_students}</td>
                                        <td className="px-4 py-2.5 text-k-text-secondary text-right tabular-nums">{c.completed_sessions}/{c.expected_sessions}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {c.adherence_pct === null
                                                ? <span className="text-k-text-quaternary">—</span>
                                                : <span className={Number(c.adherence_pct) >= 70 ? 'text-k-text-secondary' : 'text-amber-600 dark:text-amber-400'}>{c.adherence_pct}%</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Atalhos: as telas normais são o lugar da operação — links quietos */}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 px-1">
                <ShortcutLink href="/students" title="Alunos" desc={`${totalActive} ativos${atRisk > 0 ? ` · ${atRisk} em risco` : ''}`} />
                <ShortcutLink href="/schedule" title="Agenda do estúdio" desc="toda a equipe" />
                <ShortcutLink href="/estudio/plano" title="Plano" desc="faixa, uso e cobrança" />
            </div>
        </AppLayout>
    )
}

function KpiCell({ label, value, hint, trend, attention }: {
    label: string
    value: string
    hint?: string
    trend?: number
    attention?: boolean
}) {
    return (
        <div className="bg-surface-card px-5 py-4 min-w-0">
            <span className="block font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary mb-1">{label}</span>
            <p className={`text-[26px] leading-tight font-bold tracking-tight tabular-nums ${attention ? 'text-amber-600 dark:text-amber-400' : 'text-k-text-primary'}`}>{value}</p>
            {hint && (
                <p className="mt-0.5 text-[11.5px] text-k-text-tertiary tabular-nums">
                    {trend !== undefined && trend !== 0
                        ? <><span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{trend > 0 ? '+' : ''}{trend}pp</span> · {hint}</>
                        : hint}
                </p>
            )}
        </div>
    )
}

function ShortcutLink({ href, title, desc }: { href: string; title: string; desc: string }) {
    return (
        <Link href={href} className="group text-sm">
            <span className="font-medium text-k-text-secondary group-hover:text-k-text-primary transition-colors">{title}</span>
            <span className="text-k-text-quaternary"> · {desc} →</span>
        </Link>
    )
}
