'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Calendar as CalendarIcon,
    CalendarOff,
    Loader2,
    Pencil,
    Repeat,
    Trash2,
    X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cancelRecurringAppointment } from '@/actions/appointments/cancel-recurring'
import { cancelAllAppointmentsForStudent } from '@/actions/appointments/cancel-all-for-student'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import { EditAppointmentModal } from './edit-appointment-modal'
import { RecurringGroupCard } from './recurring-group-card'
import { SyncStatusBadge } from './sync-status-badge'

const DAY_NAMES_PT = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
]

const FREQUENCY_LABELS: Record<RecurringAppointment['frequency'], string> = {
    once: 'Única',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
}

interface Props {
    studentId: string
    refreshKey?: number
}

interface SingleEntry {
    kind: 'single'
    rule: RecurringAppointment
}

interface GroupEntry {
    kind: 'group'
    groupId: string
    slots: RecurringAppointment[]
}

type Entry = SingleEntry | GroupEntry

function groupRules(rules: RecurringAppointment[]): Entry[] {
    const groups = new Map<string, RecurringAppointment[]>()
    const singles: RecurringAppointment[] = []
    for (const r of rules) {
        if (r.group_id) {
            const arr = groups.get(r.group_id) ?? []
            arr.push(r)
            groups.set(r.group_id, arr)
        } else {
            singles.push(r)
        }
    }
    const entries: Entry[] = []
    for (const [groupId, slots] of groups) {
        if (slots.length === 1) {
            // Grupo com 1 slot (restou só um após cancelamentos parciais)
            // renderiza como card individual pra não parecer um pacote solitário.
            entries.push({ kind: 'single', rule: slots[0] })
        } else {
            entries.push({ kind: 'group', groupId, slots })
        }
    }
    for (const r of singles) entries.push({ kind: 'single', rule: r })
    return entries
}

export function StudentScheduleSection({ studentId, refreshKey = 0 }: Props) {
    const [rules, setRules] = useState<RecurringAppointment[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<RecurringAppointment | null>(null)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)
    const [cancelingId, setCancelingId] = useState<string | null>(null)
    const [confirmingEndAll, setConfirmingEndAll] = useState(false)
    const [endingAll, setEndingAll] = useState(false)

    const fetchRules = useCallback(async () => {
        const supabase = createClient()
        const { data, error: queryError } = await supabase
            .from('recurring_appointments')
            .select('*')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true })
        if (queryError) {
            setError('Não foi possível carregar as rotinas.')
            setRules([])
        } else {
            setError(null)
            setRules((data ?? []) as unknown as RecurringAppointment[])
        }
        setLoading(false)
    }, [studentId])

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            await fetchRules()
            if (cancelled) return
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [fetchRules, refreshKey])

    const entries = useMemo(() => (rules ? groupRules(rules) : []), [rules])

    const handleCancelRotina = async (id: string) => {
        setCancelingId(id)
        const result = await cancelRecurringAppointment({ id })
        setCancelingId(null)
        setConfirmingId(null)
        if (!result.success) {
            setError(result.error ?? 'Erro ao encerrar rotina.')
            return
        }
        await fetchRules()
    }

    const totalCount = entries.reduce(
        (acc, e) => acc + (e.kind === 'single' ? 1 : e.slots.length),
        0,
    )

    const handleEndAll = async () => {
        setEndingAll(true)
        setError(null)
        const result = await cancelAllAppointmentsForStudent({ studentId })
        setEndingAll(false)
        setConfirmingEndAll(false)
        if (!result.success) {
            setError(result.error ?? 'Erro ao encerrar rotinas.')
            return
        }
        await fetchRules()
    }

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                    Rotina atual
                    {totalCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded bg-glass-bg text-[10px] text-k-text-tertiary font-bold border border-k-border-subtle">
                            {totalCount}
                        </span>
                    )}
                </h3>
                {totalCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setConfirmingEndAll(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <CalendarOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Encerrar todos
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
                    {error}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-6 text-[#86868B] dark:text-k-text-quaternary">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            )}

            {!loading && entries.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-[#D2D2D7] dark:border-k-border-subtle py-6 px-4 text-center">
                    <div className="w-10 h-10 bg-violet-50 dark:bg-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <CalendarIcon className="w-5 h-5 text-violet-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-[#1C1C1E] dark:text-k-text-secondary">
                        Nenhuma rotina cadastrada
                    </p>
                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5">
                        Clique em &quot;Agendar&quot; pra começar.
                    </p>
                </div>
            )}

            {!loading && entries.length > 0 && (
                <ul className="space-y-2">
                    {entries.map((entry) => {
                        if (entry.kind === 'group') {
                            return (
                                <li key={`g-${entry.groupId}`}>
                                    <RecurringGroupCard
                                        slots={entry.slots}
                                        onChange={fetchRules}
                                    />
                                </li>
                            )
                        }
                        const rule = entry.rule
                        return (
                            <li
                                key={rule.id}
                                className="flex items-center gap-3 p-3 rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-white/5"
                            >
                                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                    <Repeat className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary flex items-center gap-2 flex-wrap">
                                        <span>
                                            {DAY_NAMES_PT[rule.day_of_week]} às {rule.start_time.slice(0, 5)}
                                        </span>
                                        <SyncStatusBadge
                                            status={rule.google_sync_status ?? null}
                                        />
                                    </div>
                                    <div className="text-[11px] text-[#86868B] dark:text-k-text-quaternary flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span>{FREQUENCY_LABELS[rule.frequency]}</span>
                                        <span aria-hidden="true">•</span>
                                        <span>{rule.duration_minutes} min</span>
                                        {rule.notes && (
                                            <>
                                                <span aria-hidden="true">•</span>
                                                <span className="truncate max-w-[200px]" title={rule.notes}>
                                                    {rule.notes.split('\n')[0]}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(rule)}
                                        aria-label="Editar rotina"
                                        className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-lg transition-all"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingId(rule.id)}
                                        aria-label="Encerrar rotina"
                                        className="p-1.5 text-k-text-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            {editing && (
                <EditAppointmentModal
                    isOpen={!!editing}
                    onClose={() => setEditing(null)}
                    rule={editing}
                    onSuccess={() => {
                        setEditing(null)
                        void fetchRules()
                    }}
                />
            )}

            {confirmingEndAll && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={endingAll ? undefined : () => setConfirmingEndAll(false)}
                        aria-hidden="true"
                    />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-base font-bold text-[#1D1D1F] dark:text-k-text-primary">
                                Encerrar todos os agendamentos?
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfirmingEndAll(false)}
                                aria-label="Fechar"
                                disabled={endingAll}
                                className="text-[#AEAEB2] hover:text-[#1D1D1F] dark:text-k-text-quaternary dark:hover:text-k-text-primary disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary mb-6">
                            Você vai encerrar <strong>{totalCount}</strong>{' '}
                            {totalCount === 1 ? 'rotina ativa' : 'rotinas ativas'} deste aluno a partir de hoje. Treinos passados ficam no histórico.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmingEndAll(false)}
                                disabled={endingAll}
                                className="flex-1 px-4 py-2.5 bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 text-[#1D1D1F] dark:text-k-text-primary text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleEndAll()}
                                disabled={endingAll}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {endingAll ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Encerrando...
                                    </>
                                ) : (
                                    'Encerrar tudo'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmingId && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={cancelingId ? undefined : () => setConfirmingId(null)}
                        aria-hidden="true"
                    />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-base font-bold text-[#1D1D1F] dark:text-k-text-primary">
                                Encerrar rotina?
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfirmingId(null)}
                                aria-label="Fechar"
                                disabled={!!cancelingId}
                                className="text-[#AEAEB2] hover:text-[#1D1D1F] dark:text-k-text-quaternary dark:hover:text-k-text-primary disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary mb-6">
                            A rotina vai parar de aparecer nos próximos agendamentos. O histórico
                            passado fica preservado.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmingId(null)}
                                disabled={!!cancelingId}
                                className="flex-1 px-4 py-2.5 bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 text-[#1D1D1F] dark:text-k-text-primary text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                            >
                                Manter
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCancelRotina(confirmingId)}
                                disabled={!!cancelingId}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {cancelingId ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Encerrando...
                                    </>
                                ) : (
                                    'Sim, encerrar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
