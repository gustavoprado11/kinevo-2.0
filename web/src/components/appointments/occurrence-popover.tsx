'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    CalendarClock,
    CalendarOff,
    ExternalLink,
    Loader2,
    Trash2,
    X,
} from 'lucide-react'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import { cancelOccurrence } from '@/actions/appointments/cancel-occurrence'
import { cancelRecurringAppointment } from '@/actions/appointments/cancel-recurring'
import { RescheduleOccurrenceModal } from './reschedule-occurrence-modal'

interface Props {
    occurrence: AppointmentOccurrence
    studentName: string
    /** Avatar URL opcional pra o header do popover. */
    studentAvatarUrl?: string | null
    /** Fires after a successful reschedule. Caller should refresh data. */
    onRescheduled?: () => void
    /** Fires after a successful cancel. Caller should refresh data. */
    onCanceled?: () => void
    /** The trigger (card/row/button) the popover attaches to. */
    children: React.ReactNode
}

const WEEKDAYS_PT = [
    'domingo',
    'segunda',
    'terça',
    'quarta',
    'quinta',
    'sexta',
    'sábado',
]

const MONTHS_PT_SHORT = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
]

/** Ex: "2026-04-30" + "08:00" → "quinta, 30 abr · 08:00". */
function formatOccurrenceHeader(dateKey: string, startTime: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const weekday = WEEKDAYS_PT[date.getUTCDay()]
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = MONTHS_PT_SHORT[date.getUTCMonth()]
    const hhmm = startTime.slice(0, 5)
    return `${weekday}, ${day} ${month} · ${hhmm}`
}

function studentInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * Popover reutilizável de ações sobre uma ocorrência de agendamento.
 * Três ações: Remarcar este treino, Cancelar este treino, Abrir perfil do aluno.
 *
 * Header tem avatar (ou iniciais) do aluno + nome + data formatada em pt-BR.
 */
export function OccurrencePopover({
    occurrence,
    studentName,
    studentAvatarUrl,
    onRescheduled,
    onCanceled,
    children,
}: Props) {
    const router = useRouter()
    const containerRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)
    const [rescheduleOpen, setRescheduleOpen] = useState(false)
    /** Qual diálogo inline está ativo. `null` = menu principal. */
    const [confirming, setConfirming] = useState<'cancel' | 'end' | null>(null)
    const [canceling, setCanceling] = useState(false)
    const [ending, setEnding] = useState(false)
    const todayKey = useMemo(() => {
        const d = new Date()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }, [])
    const [endDate, setEndDate] = useState<string>(todayKey)
    const [error, setError] = useState<string | null>(null)

    const isPartOfGroup = !!occurrence.groupId

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handle = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false)
                setConfirming(null)
                setError(null)
                setEndDate(todayKey)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open, todayKey])

    // Close on escape
    useEffect(() => {
        if (!open) return
        const handle = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false)
                setConfirming(null)
                setError(null)
                setEndDate(todayKey)
            }
        }
        document.addEventListener('keydown', handle)
        return () => document.removeEventListener('keydown', handle)
    }, [open, todayKey])

    const handleCancelConfirmed = async () => {
        setCanceling(true)
        setError(null)
        const result = await cancelOccurrence({
            recurringAppointmentId: occurrence.recurringAppointmentId,
            occurrenceDate: occurrence.originalDate,
        })
        setCanceling(false)
        if (!result.success) {
            setError(result.error ?? 'Erro ao cancelar este treino.')
            return
        }
        setOpen(false)
        setConfirming(null)
        onCanceled?.()
    }

    const handleEndConfirmed = async () => {
        setEnding(true)
        setError(null)
        const result = await cancelRecurringAppointment({
            id: occurrence.recurringAppointmentId,
            endsOn: endDate,
        })
        setEnding(false)
        if (!result.success) {
            setError(result.error ?? 'Erro ao encerrar esta rotina.')
            return
        }
        setOpen(false)
        setConfirming(null)
        setEndDate(todayKey)
        onCanceled?.()
    }

    const handleOpenProfile = () => {
        setOpen(false)
        router.push(`/students/${occurrence.studentId}`)
    }

    const headerDate = formatOccurrenceHeader(
        occurrence.date,
        occurrence.startTime,
    )

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="block w-full text-left"
            >
                {children}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-hover z-float overflow-hidden"
                >
                    {/* Header — avatar + nome + data */}
                    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                        <div className="h-8 w-8 shrink-0 rounded-full border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-glass-bg flex items-center justify-center overflow-hidden">
                            {studentAvatarUrl ? (
                                <Image
                                    src={studentAvatarUrl}
                                    alt={studentName}
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 object-cover"
                                    unoptimized
                                />
                            ) : (
                                <span className="text-xs font-bold text-[#007AFF] dark:text-k-text-secondary">
                                    {studentInitial(studentName)}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary truncate">
                                {studentName}
                            </p>
                            <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary truncate">
                                {headerDate}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="px-3 py-2 text-[11px] text-[#FF3B30] dark:text-red-400 bg-[#FF3B30]/5 dark:bg-red-500/10">
                            {error}
                        </div>
                    )}

                    {confirming === null && (
                        <div className="p-1.5">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setOpen(false)
                                    setRescheduleOpen(true)
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                            >
                                <CalendarClock
                                    className="w-4 h-4 text-[#007AFF] dark:text-violet-400 flex-shrink-0"
                                    strokeWidth={1.5}
                                />
                                Remarcar este treino
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => setConfirming('cancel')}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[#FF3B30] dark:text-red-400 hover:bg-[#FF3B30]/5 dark:hover:bg-red-500/10 transition-colors"
                            >
                                <Trash2
                                    className="w-4 h-4 flex-shrink-0"
                                    strokeWidth={1.5}
                                />
                                Cancelar este treino
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => setConfirming('end')}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[#FF3B30] dark:text-red-400 hover:bg-[#FF3B30]/5 dark:hover:bg-red-500/10 transition-colors"
                            >
                                <CalendarOff
                                    className="w-4 h-4 flex-shrink-0"
                                    strokeWidth={1.5}
                                />
                                Encerrar esta rotina
                            </button>
                            <div className="h-px bg-[#E8E8ED] dark:bg-k-border-subtle my-1 mx-1" />
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleOpenProfile}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                            >
                                <ExternalLink
                                    className="w-4 h-4 text-[#86868B] dark:text-k-text-tertiary flex-shrink-0"
                                    strokeWidth={1.5}
                                />
                                Abrir perfil do aluno
                            </button>
                        </div>
                    )}

                    {confirming === 'cancel' && (
                        <div className="p-3 space-y-2">
                            <p className="text-xs text-[#1D1D1F] dark:text-k-text-primary font-semibold">
                                Cancelar este treino?
                            </p>
                            <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary leading-relaxed">
                                A rotina continua ativa. Este treino específico será removido.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setConfirming(null)}
                                    disabled={canceling}
                                    className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-md transition-colors disabled:opacity-50"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleCancelConfirmed()}
                                    disabled={canceling}
                                    className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#FF3B30] hover:bg-[#E02E24] rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                                >
                                    {canceling ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Cancelando...
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-3 h-3" />
                                            Confirmar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {confirming === 'end' && (
                        <div className="p-3 space-y-2">
                            <p className="text-xs text-[#1D1D1F] dark:text-k-text-primary font-semibold">
                                Encerrar esta rotina?
                            </p>
                            <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary leading-relaxed">
                                A rotina deixa de gerar novos treinos a partir da data escolhida. Treinos passados ficam no histórico.
                            </p>
                            {isPartOfGroup && (
                                <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary leading-relaxed">
                                    Apenas esta linha do pacote será encerrada. Outros dias do pacote continuam.
                                </p>
                            )}
                            <label
                                htmlFor="end-rotina-date"
                                className="block text-[10px] font-bold uppercase tracking-wide text-[#6E6E73] dark:text-k-text-quaternary pt-1"
                            >
                                Encerrar a partir de
                            </label>
                            <input
                                id="end-rotina-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                disabled={ending}
                                className="w-full rounded-md border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-2 py-1.5 text-[11px] text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 disabled:opacity-50"
                            />
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setConfirming(null)}
                                    disabled={ending}
                                    className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-md transition-colors disabled:opacity-50"
                                >
                                    Voltar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleEndConfirmed()}
                                    disabled={ending}
                                    className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#FF3B30] hover:bg-[#E02E24] rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                                >
                                    {ending ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Encerrando...
                                        </>
                                    ) : (
                                        <>
                                            <CalendarOff className="w-3 h-3" />
                                            Encerrar rotina
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <RescheduleOccurrenceModal
                isOpen={rescheduleOpen}
                onClose={() => setRescheduleOpen(false)}
                occurrence={occurrence}
                studentName={studentName}
                onSuccess={() => {
                    setRescheduleOpen(false)
                    onRescheduled?.()
                }}
            />
        </div>
    )
}
