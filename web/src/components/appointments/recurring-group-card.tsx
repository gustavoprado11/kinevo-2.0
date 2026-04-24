'use client'

import { useState } from 'react'
import { Loader2, Pencil, Package, Trash2, X } from 'lucide-react'
import { cancelRecurringAppointment } from '@/actions/appointments/cancel-recurring'
import { cancelRecurringGroup } from '@/actions/appointments/cancel-recurring-group'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import { EditAppointmentModal } from './edit-appointment-modal'
import { SyncStatusBadge, type GoogleSyncStatus } from './sync-status-badge'

const DAY_NAMES_PT = [
    'Dom',
    'Seg',
    'Ter',
    'Qua',
    'Qui',
    'Sex',
    'Sáb',
]

const FREQUENCY_LABELS: Record<RecurringAppointment['frequency'], string> = {
    once: 'Única',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
}

interface Props {
    slots: RecurringAppointment[]
    onChange: () => void
}

export function RecurringGroupCard({ slots, onChange }: Props) {
    const [editingSlot, setEditingSlot] = useState<RecurringAppointment | null>(null)
    const [confirmMode, setConfirmMode] = useState<
        | { kind: 'slot'; id: string }
        | { kind: 'group'; groupId: string }
        | null
    >(null)
    const [canceling, setCanceling] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // All slots share: group_id, frequency, notes (propagated)
    const first = slots[0]
    const groupId = first.group_id

    // Sort by day of week + start time for consistent rendering.
    const sortedSlots = [...slots].sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
        return a.start_time.localeCompare(b.start_time)
    })

    const distinctDays = Array.from(
        new Set(sortedSlots.map((s) => s.day_of_week)),
    ).sort((a, b) => a - b)

    const handleCancelGroup = async () => {
        if (!groupId) return
        setCanceling(true)
        setError(null)
        const result = await cancelRecurringGroup({ groupId })
        setCanceling(false)
        setConfirmMode(null)
        if (!result.success) {
            setError(result.error ?? 'Erro ao encerrar pacote.')
            return
        }
        onChange()
    }

    const handleCancelSlot = async (id: string) => {
        setCanceling(true)
        setError(null)
        const result = await cancelRecurringAppointment({ id })
        setCanceling(false)
        setConfirmMode(null)
        if (!result.success) {
            setError(result.error ?? 'Erro ao encerrar dia.')
            return
        }
        onChange()
    }

    return (
        <div className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50/60 dark:bg-violet-500/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-violet-100 dark:border-violet-500/10">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary flex items-center gap-2 flex-wrap">
                            <span>Pacote de {slots.length} treinos</span>
                            <span className="text-[11px] font-normal text-[#86868B] dark:text-k-text-quaternary">
                                · {FREQUENCY_LABELS[first.frequency]}
                            </span>
                            <SyncStatusBadge
                                status={aggregateGroupSyncStatus(slots)}
                            />
                        </div>
                        <div className="text-[11px] text-violet-700 dark:text-violet-300 font-semibold flex items-center gap-1 flex-wrap">
                            {distinctDays.map((d, i) => (
                                <span key={d}>
                                    {DAY_NAMES_PT[d]}
                                    {i < distinctDays.length - 1 && (
                                        <span className="text-violet-400 mx-0.5">·</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => groupId && setConfirmMode({ kind: 'group', groupId })}
                    aria-label="Encerrar pacote"
                    title="Encerrar pacote"
                    className="p-1.5 text-k-text-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all flex-shrink-0"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Shared notes */}
            {first.notes && (
                <div className="px-3 py-2 border-b border-violet-100 dark:border-violet-500/10 text-[11px] text-[#6E6E73] dark:text-k-text-secondary">
                    <span className="font-semibold text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wider text-[10px]">
                        Notas ·{' '}
                    </span>
                    {first.notes}
                </div>
            )}

            {error && (
                <div className="px-3 py-2 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10">
                    {error}
                </div>
            )}

            {/* Slots */}
            <ul className="divide-y divide-violet-100 dark:divide-violet-500/10">
                {sortedSlots.map((slot) => (
                    <li
                        key={slot.id}
                        className="flex items-center gap-3 px-3 py-2 group hover:bg-violet-100/40 dark:hover:bg-violet-500/5"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-[#1D1D1F] dark:text-k-text-primary font-medium">
                                {DAY_NAMES_PT[slot.day_of_week]} às {slot.start_time.slice(0, 5)}
                            </div>
                            <div className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                                {slot.duration_minutes} min
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                type="button"
                                onClick={() => setEditingSlot(slot)}
                                aria-label="Editar este dia"
                                className="p-1.5 text-k-text-tertiary hover:text-k-text-primary hover:bg-white dark:hover:bg-white/10 rounded-md transition-all"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmMode({ kind: 'slot', id: slot.id })}
                                aria-label="Encerrar este dia"
                                className="p-1.5 text-k-text-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {editingSlot && (
                <EditAppointmentModal
                    isOpen={!!editingSlot}
                    onClose={() => setEditingSlot(null)}
                    rule={editingSlot}
                    onSuccess={() => {
                        setEditingSlot(null)
                        onChange()
                    }}
                />
            )}

            {confirmMode && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={canceling ? undefined : () => setConfirmMode(null)}
                        aria-hidden="true"
                    />
                    <div className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-base font-bold text-[#1D1D1F] dark:text-k-text-primary">
                                {confirmMode.kind === 'group'
                                    ? 'Encerrar pacote?'
                                    : 'Encerrar este dia?'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfirmMode(null)}
                                aria-label="Fechar"
                                disabled={canceling}
                                className="text-[#AEAEB2] hover:text-[#1D1D1F] dark:text-k-text-quaternary dark:hover:text-k-text-primary disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary mb-6">
                            {confirmMode.kind === 'group'
                                ? `Vamos encerrar os ${slots.length} treinos deste pacote. O histórico passado fica preservado.`
                                : 'Só este dia para de aparecer nos próximos agendamentos. Os outros treinos do pacote continuam ativos.'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmMode(null)}
                                disabled={canceling}
                                className="flex-1 px-4 py-2.5 bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 text-[#1D1D1F] dark:text-k-text-primary text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                            >
                                Manter
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirmMode.kind === 'group') {
                                        void handleCancelGroup()
                                    } else {
                                        void handleCancelSlot(confirmMode.id)
                                    }
                                }}
                                disabled={canceling}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {canceling ? (
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

/**
 * Status consolidado do grupo: `error` se qualquer slot erra;
 * `pending` se algum está sincronizando; `synced` se todos os que têm
 * status conhecido estão synced; caso contrário, `not_synced`/null.
 */
function aggregateGroupSyncStatus(
    slots: RecurringAppointment[],
): GoogleSyncStatus {
    const statuses = slots.map((s) => s.google_sync_status ?? null)
    if (statuses.every((s) => s === null || s === undefined)) return null
    if (statuses.includes('error')) return 'error'
    if (statuses.includes('pending')) return 'pending'
    if (statuses.includes('disabled')) return 'disabled'
    if (statuses.every((s) => s === 'synced')) return 'synced'
    return 'not_synced'
}
