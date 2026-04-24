'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    AlertCircle,
    Calendar as CalendarIcon,
    Check,
    Clock,
    Loader2,
    Repeat,
    X,
} from 'lucide-react'
import { updateRecurringAppointment } from '@/actions/appointments/update-recurring'
import { createClient } from '@/lib/supabase/client'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'

type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly'

interface Props {
    isOpen: boolean
    onClose: () => void
    rule: RecurringAppointment
    onSuccess?: () => void
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DURATION_CHIPS = [45, 60, 90] as const

function dayOfWeekFromKey(key: string): number {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).getDay()
}

function normalizeTime(t: string): string {
    return t.length >= 5 ? t.slice(0, 5) : t
}

export function EditAppointmentModal({ isOpen, onClose, rule, onSuccess }: Props) {
    const [dayOfWeek, setDayOfWeek] = useState<number>(rule.day_of_week)
    const [startTime, setStartTime] = useState<string>(normalizeTime(rule.start_time))
    const [durationMinutes, setDurationMinutes] = useState<number>(rule.duration_minutes)
    const [customDuration, setCustomDuration] = useState<string>('')
    const [frequency, setFrequency] = useState<Frequency>(rule.frequency)
    const [startsOn, setStartsOn] = useState<string>(rule.starts_on)
    const [notes, setNotes] = useState<string>(rule.notes ?? '')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [futureExceptionsCount, setFutureExceptionsCount] = useState<number | null>(null)

    useEffect(() => {
        if (!isOpen) return
        setDayOfWeek(rule.day_of_week)
        setStartTime(normalizeTime(rule.start_time))
        setDurationMinutes(rule.duration_minutes)
        setCustomDuration(
            [45, 60, 90].includes(rule.duration_minutes) ? '' : String(rule.duration_minutes),
        )
        setFrequency(rule.frequency)
        setStartsOn(rule.starts_on)
        setNotes(rule.notes ?? '')
        setError(null)
        setLoading(false)
        setFutureExceptionsCount(null)
    }, [isOpen, rule])

    // Conta exceções futuras pra banner informativo ("Essa rotina tem N
    // ajustes individuais. Eles serão mantidos.") — avisa o trainer antes
    // de editar a rotina inteira.
    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        const run = async () => {
            const today = new Date().toLocaleDateString('en-CA', {
                timeZone: 'America/Sao_Paulo',
            })
            const supabase = createClient()
            const { count } = await supabase
                .from('appointment_exceptions')
                .select('id', { count: 'exact', head: true })
                .eq('recurring_appointment_id', rule.id)
                .gte('occurrence_date', today)
            if (cancelled) return
            setFutureExceptionsCount(count ?? 0)
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [isOpen, rule.id])

    // Monthly e Once: auto-align dayOfWeek to startsOn's weekday.
    useEffect(() => {
        if (frequency !== 'monthly' && frequency !== 'once') return
        const expected = dayOfWeekFromKey(startsOn)
        if (expected !== dayOfWeek) setDayOfWeek(expected)
    }, [frequency, startsOn, dayOfWeek])

    const effectiveDuration = useMemo(() => {
        if (customDuration) {
            const n = Number(customDuration)
            if (Number.isFinite(n) && n >= 15 && n <= 240) return n
        }
        return durationMinutes
    }, [customDuration, durationMinutes])

    const isMonthly = frequency === 'monthly'
    const isOnce = frequency === 'once'
    const dayOfWeekReadonly = isMonthly || isOnce

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const result = await updateRecurringAppointment({
                id: rule.id,
                dayOfWeek,
                startTime,
                durationMinutes: effectiveDuration,
                frequency,
                startsOn,
                notes: notes.trim() ? notes.trim() : null,
            })
            if (!result.success) {
                setError(result.error ?? 'Erro ao atualizar')
                return
            }
            onSuccess?.()
            onClose()
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
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl dark:border dark:border-transparent dark:ring-1 dark:ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-inset px-8 py-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">
                            Editar rotina
                        </h2>
                        <p className="text-xs text-[#86868B] dark:text-muted-foreground/60 font-medium mt-1">
                            Ajuste os horários da rotina recorrente
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loading ? undefined : onClose}
                        aria-label="Fechar"
                        className="h-8 w-8 flex items-center justify-center text-[#AEAEB2] dark:text-muted-foreground/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-full transition-colors disabled:opacity-50"
                        disabled={loading}
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-transparent p-8 space-y-5">
                    {error && (
                        <div
                            role="alert"
                            className="bg-[#FF3B30]/10 dark:bg-red-500/10 border border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            {error}
                        </div>
                    )}

                    {futureExceptionsCount !== null && futureExceptionsCount > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-300 px-4 py-3 rounded-xl text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                            <span>
                                Essa rotina tem{' '}
                                <strong>
                                    {futureExceptionsCount}{' '}
                                    {futureExceptionsCount === 1 ? 'ajuste individual' : 'ajustes individuais'}
                                </strong>{' '}
                                no futuro. Eles serão mantidos mesmo depois de editar a rotina.
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                            Frequência
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-[#F5F5F7] dark:bg-surface-inset p-1 rounded-lg">
                            {(
                                [
                                    { value: 'once', label: 'Única' },
                                    { value: 'weekly', label: 'Semanal' },
                                    { value: 'biweekly', label: 'Quinzenal' },
                                    { value: 'monthly', label: 'Mensal' },
                                ] as const
                            ).map((opt) => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => setFrequency(opt.value)}
                                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 transition-all duration-200 text-xs font-semibold ${
                                        frequency === opt.value
                                            ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                            : 'text-[#86868B] dark:text-k-text-tertiary hover:text-[#6E6E73] dark:hover:text-k-text-secondary'
                                    }`}
                                >
                                    <Repeat className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                            Dia da semana
                            {dayOfWeekReadonly && (
                                <span className="ml-2 font-medium normal-case text-[#86868B] dark:text-k-text-quaternary">
                                    (ajustado automaticamente)
                                </span>
                            )}
                        </label>
                        <div className="grid grid-cols-7 gap-1">
                            {DAY_LABELS.map((lbl, idx) => {
                                const selected = dayOfWeek === idx
                                const disabled = dayOfWeekReadonly
                                return (
                                    <button
                                        type="button"
                                        key={lbl}
                                        onClick={() => !disabled && setDayOfWeek(idx)}
                                        disabled={disabled}
                                        aria-pressed={selected}
                                        className={`h-9 rounded-lg text-xs font-semibold transition-all ${
                                            selected
                                                ? 'bg-[#007AFF] dark:bg-violet-600 text-white shadow-sm'
                                                : 'bg-[#F5F5F7] dark:bg-white/5 text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#E8E8ED] dark:hover:bg-white/10'
                                        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {lbl}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="edit-startTime"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            Horário
                        </label>
                        <div className="relative">
                            <Clock
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary"
                                strokeWidth={1.5}
                            />
                            <input
                                id="edit-startTime"
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                required
                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                            Duração
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {DURATION_CHIPS.map((min) => {
                                const active = !customDuration && durationMinutes === min
                                return (
                                    <button
                                        type="button"
                                        key={min}
                                        onClick={() => {
                                            setDurationMinutes(min)
                                            setCustomDuration('')
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            active
                                                ? 'bg-[#007AFF] dark:bg-violet-600 text-white'
                                                : 'bg-[#F5F5F7] dark:bg-white/5 text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#E8E8ED] dark:hover:bg-white/10'
                                        }`}
                                    >
                                        {min} min
                                    </button>
                                )
                            })}
                            <input
                                type="number"
                                min={15}
                                max={240}
                                placeholder="Outra"
                                value={customDuration}
                                onChange={(e) => setCustomDuration(e.target.value)}
                                aria-label="Duração personalizada (minutos)"
                                className="w-24 rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-3 py-1.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-2 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="edit-startsOn"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            Data de início
                        </label>
                        <div className="relative">
                            <CalendarIcon
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary"
                                strokeWidth={1.5}
                            />
                            <input
                                id="edit-startsOn"
                                type="date"
                                value={startsOn}
                                onChange={(e) => setStartsOn(e.target.value)}
                                required
                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="edit-notes"
                            className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide"
                        >
                            Notas (opcional)
                        </label>
                        <textarea
                            id="edit-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={500}
                            rows={2}
                            className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-3.5 py-2.5 text-sm text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 resize-none"
                        />
                    </div>

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
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" strokeWidth={2} />
                                    Salvar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
