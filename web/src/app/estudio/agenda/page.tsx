import Link from 'next/link'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { AppLayout } from '@/components/layout'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { requireManagerContext } from '../guard'
import { EstudioNav } from '../estudio-nav'
import { getOrgAgenda } from '@/lib/studio/org-agenda'

const TZ = 'America/Sao_Paulo'
const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function dateKey(d: Date): string {
    return d.toISOString().slice(0, 10)
}
function addDays(key: string, days: number): string {
    const [y, m, d] = key.split('-').map(Number)
    return dateKey(new Date(Date.UTC(y, m - 1, d + days)))
}
function labelFor(key: string, todayKey: string): string {
    const [y, m, d] = key.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const base = `${DAY_LABELS[dow]} · ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
    return key === todayKey ? `${base} (hoje)` : base
}

/**
 * Agenda consolidada do estúdio — visão semanal do gestor com as sessões de
 * TODOS os coaches (leitura; agendar continua pessoal, na agenda de cada um).
 */
export default async function EstudioAgendaPage({
    searchParams,
}: {
    searchParams: Promise<{ w?: string }>
}) {
    const ctx = await requireManagerContext()
    const { trainer } = await getTrainerWithSubscription()
    const { w } = await searchParams

    const thisMonday = dateKey(getWeekRange(new Date(), TZ).start)
    const weekStart = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : thisMonday
    const weekEnd = addDays(weekStart, 6)
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

    const occurrences = await getOrgAgenda(ctx.organization.id, weekStart, weekEnd)

    // Agrupa por dia (só dias com sessão aparecem; semana vazia tem estado próprio)
    const byDay = new Map<string, typeof occurrences>()
    for (const o of occurrences) {
        // canceladas já não saem da projeção (exceção kind=cancel filtra)
        const list = byDay.get(o.date) ?? []
        list.push(o)
        byDay.set(o.date, list)
    }
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart, i)).filter(d => byDay.has(d))

    const fmtRange = (() => {
        const [ys, ms, ds] = weekStart.split('-').map(Number)
        const [, me, de] = weekEnd.split('-').map(Number)
        return `${String(ds).padStart(2, '0')}/${String(ms).padStart(2, '0')} – ${String(de).padStart(2, '0')}/${String(me).padStart(2, '0')}/${ys}`
    })()

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

            <EstudioNav active="agenda" />

            {/* Navegação da semana */}
            <div className="my-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link
                        href={`/estudio/agenda?w=${addDays(weekStart, -7)}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-k-border-subtle text-k-text-tertiary hover:text-k-text-primary"
                        aria-label="Semana anterior"
                    >
                        <ChevronLeft size={16} />
                    </Link>
                    <span className="text-sm font-semibold text-k-text-primary">{fmtRange}</span>
                    <Link
                        href={`/estudio/agenda?w=${addDays(weekStart, 7)}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-k-border-subtle text-k-text-tertiary hover:text-k-text-primary"
                        aria-label="Próxima semana"
                    >
                        <ChevronRight size={16} />
                    </Link>
                    {weekStart !== thisMonday && (
                        <Link href="/estudio/agenda" className="ml-1 text-xs font-semibold text-violet-500 hover:text-violet-400">
                            Hoje
                        </Link>
                    )}
                </div>
                <p className="text-xs text-k-text-quaternary">
                    Sessões de toda a equipe. Para agendar, cada treinador usa a própria Agenda.
                </p>
            </div>

            {days.length === 0 ? (
                <div className="rounded-2xl border border-k-border-subtle bg-surface-card p-10 text-center">
                    <CalendarDays size={28} className="mx-auto mb-3 text-k-text-quaternary" />
                    <p className="text-sm font-medium text-k-text-primary">Nenhuma sessão agendada nesta semana</p>
                    <p className="mt-1 text-xs text-k-text-tertiary">As rotinas criadas pelos treinadores aparecem aqui automaticamente.</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {days.map(day => (
                        <div key={day} className="rounded-2xl border border-k-border-subtle bg-surface-card overflow-hidden">
                            <div className={`px-4 py-2.5 border-b border-k-border-subtle ${day === todayKey ? 'bg-violet-500/5' : ''}`}>
                                <h2 className={`text-sm font-semibold ${day === todayKey ? 'text-violet-500' : 'text-k-text-primary'}`}>
                                    {labelFor(day, todayKey)}
                                </h2>
                            </div>
                            <ul className="divide-y divide-k-border-subtle">
                                {byDay.get(day)!.map(o => (
                                    <li key={`${o.recurringAppointmentId}-${o.date}`} className="flex items-center gap-4 px-4 py-2.5">
                                        <span className="w-12 shrink-0 text-sm font-bold text-k-text-primary tabular-nums">{o.startTime}</span>
                                        <span className="shrink-0 text-xs text-k-text-quaternary tabular-nums">{o.durationMinutes}min</span>
                                        <span className="min-w-0 flex-1 truncate text-sm text-k-text-primary">{o.studentName}</span>
                                        <span className="shrink-0 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-500">
                                            {o.trainerId === trainer.id ? 'Você' : o.coachName}
                                        </span>
                                        {o.hasException && (
                                            <span className="shrink-0 text-[10px] font-bold uppercase text-amber-500">remarcada</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </AppLayout>
    )
}
