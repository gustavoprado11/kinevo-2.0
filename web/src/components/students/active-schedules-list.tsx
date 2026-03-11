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

    return (
        <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-k-text-quaternary">
                Recorrentes
            </p>
            {schedules.map(schedule => (
                <div
                    key={schedule.id}
                    className="flex items-center gap-2 bg-violet-50 dark:bg-violet-500/10 rounded-lg px-3 py-2"
                >
                    <RefreshCw className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate block">
                            {schedule.form_template_title}
                        </span>
                        <span className="text-[10px] text-violet-500 dark:text-violet-400/70">
                            {frequencyLabels[schedule.frequency]}
                            {schedule.next_due_at && (
                                <> &middot; Próximo: {new Date(schedule.next_due_at).toLocaleDateString('pt-BR')}</>
                            )}
                        </span>
                    </div>
                    <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deletingId === schedule.id}
                        className="p-1 rounded-md text-violet-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
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
