import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { AppLayout } from '@/components/layout'
import { Users, TrendingUp, Dumbbell, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { requireManagerContext } from './guard'
import { EstudioNav } from './estudio-nav'

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
    student_name: string
    coach_id: string
    coach_name: string | null
    has_active_program: boolean
    last_session: string | null
    at_risk: boolean
}

export default async function EstudioOverviewPage() {
    const ctx = await requireManagerContext()
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const weekStart = getWeekRange(new Date(), TZ).start.toISOString().slice(0, 10)
    const [coachRes, studentRes] = await Promise.all([
        supabase.rpc('get_org_coach_week_stats', { p_org: ctx.organization.id, p_week_start: weekStart }),
        supabase.rpc('get_org_students_overview', { p_org: ctx.organization.id }),
    ])
    const coaches = (coachRes.data ?? []) as CoachRow[]
    const students = (studentRes.data ?? []) as StudentRow[]

    const totalActive = students.length
    const atRisk = students.filter(s => s.at_risk).length
    const doneWeek = coaches.reduce((a, c) => a + Number(c.completed_sessions), 0)
    const expectedWeek = coaches.reduce((a, c) => a + Number(c.expected_sessions), 0)
    const adherence = expectedWeek > 0 ? Math.round((doneWeek * 100) / expectedWeek) : null

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">{ctx.organization.name}</h1>
                <p className="text-sm text-k-text-tertiary mt-0.5">Painel do estúdio — visão do gestor</p>
            </div>

            <EstudioNav active="overview" />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-6">
                <KpiCard icon={<Users size={18} className="text-violet-500" />} label="Alunos ativos" value={String(totalActive)} />
                <KpiCard icon={<Dumbbell size={18} className="text-emerald-500" />} label="Treinos na semana" value={`${doneWeek}/${expectedWeek}`} />
                <KpiCard icon={<TrendingUp size={18} className="text-blue-500" />} label="Aderência" value={adherence === null ? '—' : `${adherence}%`} />
                <KpiCard icon={<AlertTriangle size={18} className="text-amber-500" />} label="Em risco" value={String(atRisk)} />
            </div>

            {/* Por treinador */}
            <div className="rounded-xl border border-k-border-subtle bg-surface-card overflow-hidden">
                <div className="px-4 py-3 border-b border-k-border-subtle">
                    <h2 className="text-sm font-semibold text-k-text-primary">Por treinador</h2>
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

            {/* Alunos em risco (atalho) */}
            {atRisk > 0 && (
                <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500" />
                            <span className="text-sm font-medium text-k-text-primary">{atRisk} aluno(s) em risco</span>
                            <span className="text-xs text-k-text-tertiary">sem programa ativo ou sem treinar há 14+ dias</span>
                        </div>
                        <Link href="/estudio/alunos" className="text-xs font-semibold text-violet-500 hover:text-violet-400">Ver alunos →</Link>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-k-border-subtle bg-surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary">{label}</span>
            </div>
            <p className="text-2xl font-bold text-k-text-primary">{value}</p>
        </div>
    )
}
