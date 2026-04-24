'use client'

import { useEffect, useState } from 'react'
import {
    AlertCircle,
    Calendar as CalendarIcon,
    CalendarClock,
    Check,
    Clock,
    Loader2,
    X,
} from 'lucide-react'
import { rescheduleOccurrence } from '@/actions/appointments/reschedule-occurrence'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'

type Scope = 'only_this' | 'this_and_future'

interface Props {
    isOpen: boolean
    onClose: () => void
    occurrence: AppointmentOccurrence
    studentName: string
    onSuccess?: () => void
}

/**
 * Modal compacto pra remarcar uma ocorrência específica. Permite escolher
 * entre "Apenas esta" (cria exceção) e "Esta e as próximas" (encerra
 * rotina original + cria nova). Delega a lógica ao server action
 * `rescheduleOccurrence` da Fase 2.
 */
export function RescheduleOccurrenceModal({
    isOpen,
    onClose,
    occurrence,
    studentName,
    onSuccess,
}: Props) {
    const [newDate, setNewDate] = useState<string>(occurrence.date)
    const [newStartTime, setNewStartTime] = useState<string>(occurrence.startTime)
    const [scope, setScope] = useState<Scope>('only_this')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        setNewDate(occurrence.date)
        setNewStartTime(occurrence.startTime)
        setScope('only_this')
        setError(null)
        setLoading(false)
    }, [isOpen, occurrence.date, occurrence.startTime])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const result = await rescheduleOccurrence({
                recurringAppointmentId: occurrence.recurringAppointmentId,
                originalDate: occurrence.originalDate,
                newDate,
                newStartTime,
                scope,
            })
            if (!result.success) {
                setError(result.error ?? 'Erro ao remarcar.')
                return
            }
            onSuccess?.()
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
                onClick={loading ? undefined : onClose}
                aria-hidden="true"
            />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl dark:border dark:border-transparent dark:ring-1 dark:ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-inset px-6 py-5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                            <CalendarClock
                                className="w-4 h-4 text-violet-500 dark:text-violet-400"
                                strokeWidth={1.5}
                            />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-white truncate">
                                Remarcar
                            </h2>
                            <p className="text-[11px] text-[#86868B] dark:text-muted-foreground/60 truncate">
                                {studentName} · {occurrence.originalDate} às {occurrence.startTime}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={loading ? undefined : onClose}
                        aria-label="Fechar"
                        disabled={loading}
                        className="h-8 w-8 flex items-center justify-center text-[#AEAEB2] dark:text-muted-foreground/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-full transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div
                            role="alert"
                            className="bg-[#FF3B30]/10 dark:bg-red-500/10 border border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 px-3 py-2 rounded-lg text-xs flex items-start gap-2"
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="reschedule-date"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            Nova data
                        </label>
                        <div className="relative">
                            <CalendarIcon
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary"
                                strokeWidth={1.5}
                            />
                            <input
                                id="reschedule-date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                required
                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="reschedule-time"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            Novo horário
                        </label>
                        <div className="relative">
                            <Clock
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary"
                                strokeWidth={1.5}
                            />
                            <input
                                id="reschedule-time"
                                type="time"
                                value={newStartTime}
                                onChange={(e) => setNewStartTime(e.target.value)}
                                required
                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20"
                            />
                        </div>
                    </div>

                    <fieldset>
                        <legend className="mb-2 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                            Escopo
                        </legend>
                        <div className="space-y-1.5">
                            <label
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    scope === 'only_this'
                                        ? 'border-[#007AFF] dark:border-violet-500/50 bg-[#007AFF]/5 dark:bg-violet-500/10'
                                        : 'border-[#E8E8ED] dark:border-k-border-subtle hover:bg-[#F9F9FB] dark:hover:bg-white/5'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="scope"
                                    value="only_this"
                                    checked={scope === 'only_this'}
                                    onChange={() => setScope('only_this')}
                                    className="mt-0.5 accent-[#007AFF] dark:accent-violet-500"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                        Apenas esta
                                    </p>
                                    <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                                        Só remarca este treino específico. A rotina continua igual.
                                    </p>
                                </div>
                            </label>
                            <label
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                    scope === 'this_and_future'
                                        ? 'border-[#007AFF] dark:border-violet-500/50 bg-[#007AFF]/5 dark:bg-violet-500/10'
                                        : 'border-[#E8E8ED] dark:border-k-border-subtle hover:bg-[#F9F9FB] dark:hover:bg-white/5'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="scope"
                                    value="this_and_future"
                                    checked={scope === 'this_and_future'}
                                    onChange={() => setScope('this_and_future')}
                                    className="mt-0.5 accent-[#007AFF] dark:accent-violet-500"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                        Esta e as próximas
                                    </p>
                                    <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                                        A rotina antiga encerra neste dia e uma nova começa no horário escolhido.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </fieldset>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={loading ? undefined : onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#007AFF] dark:text-k-text-secondary hover:text-[#0056B3] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-full transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0056B3] dark:hover:bg-violet-500 text-white text-sm font-semibold rounded-full shadow-sm dark:shadow-lg dark:shadow-violet-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    Remarcando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" strokeWidth={2} />
                                    Remarcar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
