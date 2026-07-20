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
    onLoadedCount?: (count: number) => void
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

export function StudentScheduleSection({ studentId, refreshKey = 0, onLoadedCount }: Props) {
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
            const loaded = (data ?? []) as unknown as RecurringAppointment[]
            setRules(loaded)
            onLoadedCount?.(loaded.length)
        }
        setLoading(false)
    }, [studentId, onLoadedCount])

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
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary tabular-nums">
                    Rotina atual
                    {totalCount > 0 && <span> · {totalCount}</span>}
                </span>
                {totalCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setConfirmingEndAll(true)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-k-text-tertiary hover:text-red-500 transition-colors"
                    >
                        <CalendarOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Encerrar todos
                    </button>
                )}
            </div>

            {error && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}

            {loading && (
                <div className="flex items-center justify-center py-6 text-k-text-quaternary">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            )}

            {!loading && entries.length === 0 && (
                <p className="text-[11.5px] text-k-text-quaternary py-1">
                    Nenhuma rotina cadastrada. Clique em &quot;Agendar&quot; pra começar.
                </p>
            )}

            {!loading && entries.length > 0 && (
                <ul>
                    {entries.map((entry) => {
                        if (entry.kind === 'group') {
                            return (
                                <li key={`g-${entry.groupId}`} className="py-1.5">
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
                                className="flex items-center gap-2.5 py-2.5 border-b border-k-border-subtle last:border-b-0"
                            >
                                <Repeat className="w-3.5 h-3.5 text-k-text-quaternary flex-shrink-0" strokeWidth={1.5} />

                                <div className="flex-1 min-w-0">
                                    <div className="text-[12.5px] font-semibold text-k-text-primary flex items-center gap-2 flex-wrap">
                                        <span className="tabular-nums">
                                            {DAY_NAMES_PT[rule.day_of_week]} às {rule.start_time.slice(0, 5)}
                                        </span>
                                        <SyncStatusBadge
                                            status={rule.google_sync_status ?? null}
                                        />
                                    </div>
                                    <div className="font-mono text-[10px] text-k-text-tertiary flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                                        <span>{FREQUENCY_LABELS[rule.frequency]}</span>
                                        <span aria-hidden="true">·</span>
                                        <span>{rule.duration_minutes} min</span>
                                        {rule.notes && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <span className="truncate max-w-[200px] font-sans" title={rule.notes}>
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
                                        className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingId(rule.id)}
                                        aria-label="Encerrar rotina"
                                        className="p-1.5 text-k-text-quaternary hover:text-red-500 hover:bg-red-500/10 rounded-control transition-colors"
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
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-base font-bold text-k-text-primary">
                                Encerrar todos os agendamentos?
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfirmingEndAll(false)}
                                aria-label="Fechar"
                                disabled={endingAll}
                                className="text-k-text-quaternary hover:text-k-text-primary disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-k-text-secondary mb-6">
                            Você vai encerrar <strong>{totalCount}</strong>{' '}
                            {totalCount === 1 ? 'rotina ativa' : 'rotinas ativas'} deste aluno a partir de hoje. Treinos passados ficam no histórico.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmingEndAll(false)}
                                disabled={endingAll}
                                className="flex-1 px-4 py-2.5 bg-surface-inset hover:bg-surface-inset/70 text-k-text-primary text-sm font-semibold rounded-control transition-colors disabled:opacity-50"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleEndAll()}
                                disabled={endingAll}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-control transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-base font-bold text-k-text-primary">
                                Encerrar rotina?
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfirmingId(null)}
                                aria-label="Fechar"
                                disabled={!!cancelingId}
                                className="text-k-text-quaternary hover:text-k-text-primary disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-k-text-secondary mb-6">
                            A rotina vai parar de aparecer nos próximos agendamentos. O histórico
                            passado fica preservado.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmingId(null)}
                                disabled={!!cancelingId}
                                className="flex-1 px-4 py-2.5 bg-surface-inset hover:bg-surface-inset/70 text-k-text-primary text-sm font-semibold rounded-control transition-colors disabled:opacity-50"
                            >
                                Manter
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCancelRotina(confirmingId)}
                                disabled={!!cancelingId}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-control transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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
