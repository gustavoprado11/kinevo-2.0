'use client'

import { useState } from 'react'
import { RefreshCw, Trash2, Loader2 } from 'lucide-react'
import { deleteFormSchedule, type FormScheduleRow, type ScheduleFrequency } from '@/actions/forms/form-schedules'
import { useRouter } from 'next/navigation'

interface ActiveSchedulesListProps {
    schedules: FormScheduleRow[]
}

const frequencyLabels: Record<ScheduleFrequency, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
}

export function ActiveSchedulesList({ schedules }: ActiveSchedulesListProps) {
    const router = useRouter()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    if (schedules.length === 0) return null

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        const res = await deleteFormSchedule(id)
        if (res.success) {
            router.refresh()
        }
        setDeletingId(null)
    }

    // Redesign: o bloco 100% violeta virou lista neutra — violeta é ação,
    // não fundo de card.
    return (
        <div>
            <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary mb-1">
                Recorrentes
            </p>
            {schedules.map(schedule => (
                <div
                    key={schedule.id}
                    className="flex items-center gap-2 py-2 border-b border-k-border-subtle last:border-b-0"
                >
                    <RefreshCw className="w-3.5 h-3.5 text-k-text-quaternary shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-k-text-primary truncate block">
                            {schedule.form_template_title}
                        </span>
                        <span className="font-mono text-[10px] text-k-text-tertiary tabular-nums">
                            {frequencyLabels[schedule.frequency]}
                            {schedule.next_due_at && (
                                <> &middot; próximo {new Date(schedule.next_due_at).toLocaleDateString('pt-BR')}</>
                            )}
                        </span>
                    </div>
                    <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deletingId === schedule.id}
                        className="p-1 rounded-control text-k-text-quaternary hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Remover recorrência"
                    >
                        {deletingId === schedule.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            ))}
        </div>
    )
}
