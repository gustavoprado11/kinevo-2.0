'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout'
import { WeeklyCalendar } from '@/components/schedule/weekly-calendar'
import { WeekNavigator } from '@/components/schedule/week-navigator'
import { CreateAppointmentModal } from '@/components/appointments/create-appointment-modal'
import { listAppointmentsInRange } from '@/actions/appointments/list-appointments'
import { listStudioAgendaInRange } from '@/actions/organizations/list-studio-agenda'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'

export interface ScheduleStudent {
    name: string
    avatarUrl: string | null
}

export interface ScheduleStudentOption {
    id: string
    name: string
    avatarUrl: string | null
}

interface Props {
    trainerName: string
    trainerEmail: string
    trainerAvatarUrl: string | null
    trainerTheme?: 'light' | 'dark' | 'system'
    initialWeekStart: string // YYYY-MM-DD (domingo)
    initialOccurrences: AppointmentOccurrence[]
    initialStudentsById: Record<string, ScheduleStudent>
    students: ScheduleStudentOption[]
    /** Estúdios: id do ator + coaches ativos (>1 = mostra o filtro por coach). */
    myTrainerId?: string
    studioCoaches?: { id: string; name: string }[]
}

function addDaysKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function todayKeyBR(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function weekStartOf(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const mondayOffset = (date.getUTCDay() + 6) % 7 // dom=6, seg=0, ..., sáb=5
    date.setUTCDate(date.getUTCDate() - mondayOffset)
    return date.toISOString().slice(0, 10)
}

export function ScheduleClient({
    trainerName,
    trainerEmail,
    trainerAvatarUrl,
    trainerTheme,
    initialWeekStart,
    initialOccurrences,
    initialStudentsById,
    students,
    myTrainerId,
    studioCoaches = [],
}: Props) {
    const [weekStart, setWeekStart] = useState<string>(initialWeekStart)
    // Estúdios: 'me' = agenda pessoal (fluxo original); 'all' ou coachId = visão
    // do estúdio (fetch org + filtro client-side).
    const [coachFilter, setCoachFilter] = useState<string>('me')
    const showStudioFilter = studioCoaches.length > 1
    const [occurrences, setOccurrences] =
        useState<AppointmentOccurrence[]>(initialOccurrences)
    const [studentsById, setStudentsById] =
        useState<Record<string, ScheduleStudent>>(initialStudentsById)
    const [isPending, startTransition] = useTransition()
    const [createModal, setCreateModal] = useState<{
        date: string
        time: string
    } | null>(null)

    const weekEnd = useMemo(() => addDaysKey(weekStart, 6), [weekStart])

    /**
     * Snapshots pra reverter `onOptimisticMove` quando o server falha.
     * Chave: `recurringAppointmentId::originalDate`. Valor: estado prévio
     * da ocorrência antes do move optimistic.
     */
    const optimisticSnapshots = useRef<Map<string, AppointmentOccurrence>>(
        new Map(),
    )

    const handleOptimisticMove = useCallback(
        (args: {
            recurringAppointmentId: string
            originalDate: string
            newDate: string
            newStartTime: string
        }) => {
            const key = `${args.recurringAppointmentId}::${args.originalDate}`
            setOccurrences((prev) => {
                const next = prev.map((o) => {
                    if (
                        o.recurringAppointmentId === args.recurringAppointmentId &&
                        o.originalDate === args.originalDate
                    ) {
                        // Snapshot só se ainda não temos (primeiro move desde
                        // o último commit/refetch).
                        if (!optimisticSnapshots.current.has(key)) {
                            optimisticSnapshots.current.set(key, o)
                        }
                        return {
                            ...o,
                            date: args.newDate,
                            startTime: args.newStartTime,
                            status:
                                o.status === 'scheduled'
                                    ? 'rescheduled'
                                    : o.status,
                            hasException: true,
                        }
                    }
                    return o
                })
                return next
            })
        },
        [],
    )

    const handleOptimisticRevert = useCallback(
        (args: { recurringAppointmentId: string; originalDate: string }) => {
            const key = `${args.recurringAppointmentId}::${args.originalDate}`
            const snapshot = optimisticSnapshots.current.get(key)
            if (!snapshot) return
            optimisticSnapshots.current.delete(key)
            setOccurrences((prev) =>
                prev.map((o) => {
                    if (
                        o.recurringAppointmentId === args.recurringAppointmentId &&
                        o.originalDate === args.originalDate
                    ) {
                        return snapshot
                    }
                    return o
                }),
            )
        },
        [],
    )

    const refetch = useCallback(
        async (start: string, end: string, filter: string = coachFilter) => {
            // Visão do estúdio: busca as ocorrências de TODOS os coaches e
            // filtra client-side; nomes de alunos de colegas vêm sufixados.
            if (filter !== 'me') {
                const org = await listStudioAgendaInRange({ rangeStart: start, rangeEnd: end })
                if (org.success && org.occurrences) {
                    const filtered = filter === 'all'
                        ? org.occurrences
                        : org.occurrences.filter((o) => o.trainerId === filter)
                    setOccurrences(filtered)
                    optimisticSnapshots.current.clear()
                    if (org.studentsById) {
                        setStudentsById((prev) => ({ ...org.studentsById, ...prev }))
                    }
                }
                return
            }
            const result = await listAppointmentsInRange({
                rangeStart: start,
                rangeEnd: end,
            })
            if (result.success && result.data) {
                setOccurrences(result.data)
                // Server commit reconciliou o state — descarta snapshots
                // antigos de moves optimistic já confirmados.
                optimisticSnapshots.current.clear()
                // Estende o map de alunos pra incluir novos referenciados
                const referenced = Array.from(
                    new Set(result.data.map((o) => o.studentId)),
                )
                const missing = referenced.filter((id) => !studentsById[id])
                if (missing.length > 0) {
                    // Alunos novos que ainda não estão no map ficam com
                    // fallback "Aluno". Um refetch server-side resolveria, mas
                    // pro MVP esse caminho é raro (trainer criou aluno agora e
                    // já tem treino essa semana).
                    setStudentsById((prev) => {
                        const next = { ...prev }
                        for (const id of missing) {
                            if (!next[id]) next[id] = { name: 'Aluno', avatarUrl: null }
                        }
                        return next
                    })
                }
            }
        },
        [studentsById, coachFilter],
    )

    const navigateToWeek = useCallback(
        (newStart: string) => {
            startTransition(() => {
                setWeekStart(newStart)
                void refetch(newStart, addDaysKey(newStart, 6))
            })
        },
        [refetch],
    )

    const goToPreviousWeek = useCallback(() => {
        navigateToWeek(addDaysKey(weekStart, -7))
    }, [navigateToWeek, weekStart])

    const goToNextWeek = useCallback(() => {
        navigateToWeek(addDaysKey(weekStart, 7))
    }, [navigateToWeek, weekStart])

    const goToToday = useCallback(() => {
        navigateToWeek(weekStartOf(todayKeyBR()))
    }, [navigateToWeek])

    // Keyboard shortcuts: ← → navegam semanas; T vai pra hoje.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Ignora se o usuário está digitando
            const target = e.target as HTMLElement | null
            if (
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable)
            ) {
                return
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault()
                goToPreviousWeek()
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                goToNextWeek()
            } else if (e.key.toLowerCase() === 't') {
                e.preventDefault()
                goToToday()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [goToPreviousWeek, goToNextWeek, goToToday])

    const handleCoachFilter = useCallback(
        (filter: string) => {
            setCoachFilter(filter)
            startTransition(() => {
                void refetch(weekStart, addDaysKey(weekStart, 6), filter)
            })
        },
        [refetch, weekStart],
    )

    const handleSlotClick = useCallback((date: string, time: string) => {
        // Cria rotina a partir do slot vazio. O modal atual exige
        // `preselectedStudentId` pra habilitar submit — a UX aqui é diferente
        // (trainer escolhe aluno no modal). Passamos preselectedDate/time
        // mas sem student, deixando o modal exibir erro "Selecione um aluno"
        // quando não pré-selecionado. TODO: refatorar modal pra aceitar null.
        setCreateModal({ date, time })
    }, [])

    const handleNewAppointment = useCallback(() => {
        const hourSP = Number(
            new Date().toLocaleTimeString('en-GB', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                hour12: false,
            }),
        )
        const nextHour = Math.min(hourSP + 1, 23)
        setCreateModal({
            date: todayKeyBR(),
            time: `${String(nextHour).padStart(2, '0')}:00`,
        })
    }, [])

    return (
        <AppLayout
            trainerName={trainerName}
            trainerEmail={trainerEmail}
            trainerAvatarUrl={trainerAvatarUrl}
            trainerTheme={trainerTheme}
        >
            <div className="min-h-screen bg-surface-primary -m-8 p-8 flex flex-col space-y-4">
                {/* Header da página — fora do card do calendário */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-k-text-primary tracking-tight">
                            Agenda
                        </h1>
                        <p className="text-xs text-k-text-quaternary mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            Calendário semanal de agendamentos
                            <span className="inline-flex items-center gap-1 text-[11px] text-k-text-tertiary">
                                <kbd className="rounded border border-k-border-primary px-1 font-mono text-[10px] leading-none">←</kbd>
                                <kbd className="rounded border border-k-border-primary px-1 font-mono text-[10px] leading-none">→</kbd>
                                navegam ·
                                <kbd className="rounded border border-k-border-primary px-1 font-mono text-[10px] leading-none">T</kbd>
                                hoje
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <WeekNavigator
                            weekStart={weekStart}
                            isNavigating={isPending}
                            onPrevious={goToPreviousWeek}
                            onNext={goToNextWeek}
                            onToday={goToToday}
                        />
                        <Button
                            onClick={handleNewAppointment}
                            className="gap-2 px-4 py-2 text-sm"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            Novo agendamento
                        </Button>
                    </div>
                </div>

                {/* Estúdios: filtro por treinador (Você · Todos · cada coach).
                    Ver é aberto a todo membro; AGENDAR continua pessoal. */}
                {showStudioFilter && (
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <FilterChip active={coachFilter === 'me'} onClick={() => handleCoachFilter('me')} label="Você" />
                        <FilterChip active={coachFilter === 'all'} onClick={() => handleCoachFilter('all')} label="Estúdio (todos)" />
                        {studioCoaches
                            .filter((c) => c.id !== myTrainerId)
                            .map((c) => (
                                <FilterChip
                                    key={c.id}
                                    active={coachFilter === c.id}
                                    onClick={() => handleCoachFilter(c.id)}
                                    label={c.name.split(' ')[0]}
                                />
                            ))}
                        {coachFilter !== 'me' && (
                            <span className="shrink-0 text-[11px] text-k-text-quaternary">
                                visão do estúdio — para agendar/remarcar, use a visão &ldquo;Você&rdquo;
                            </span>
                        )}
                    </div>
                )}

                {/* Card único contendo header de dias + grid de horas */}
                <WeeklyCalendar
                    weekStart={weekStart}
                    weekEnd={weekEnd}
                    occurrences={occurrences}
                    studentsById={studentsById}
                    onSlotClick={handleSlotClick}
                    onOccurrenceChanged={() =>
                        void refetch(weekStart, weekEnd)
                    }
                    onOptimisticMove={handleOptimisticMove}
                    onOptimisticRevert={handleOptimisticRevert}
                />
            </div>

            {createModal && (
                <CreateAppointmentModal
                    isOpen
                    onClose={() => setCreateModal(null)}
                    preselectedDate={createModal.date}
                    preselectedTime={createModal.time}
                    students={students}
                    onSuccess={() => {
                        setCreateModal(null)
                        void refetch(weekStart, weekEnd)
                    }}
                />
            )}
        </AppLayout>
    )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`shrink-0 rounded-control border px-3 py-1.5 text-xs transition-colors ${
                active
                    ? 'bg-surface-inset border-k-border-primary text-k-text-primary font-semibold'
                    : 'bg-surface-card border-k-border-primary text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset/60 font-medium'
            }`}
        >
            {label}
        </button>
    )
}
