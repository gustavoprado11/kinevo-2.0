'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { AppLayout } from '@/components/layout'
import { WeeklyCalendar } from '@/components/schedule/weekly-calendar'
import { WeekNavigator } from '@/components/schedule/week-navigator'
import { CreateAppointmentModal } from '@/components/appointments/create-appointment-modal'
import { listAppointmentsInRange } from '@/actions/appointments/list-appointments'
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
    date.setUTCDate(date.getUTCDate() - date.getUTCDay())
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
}: Props) {
    const [weekStart, setWeekStart] = useState<string>(initialWeekStart)
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

    const refetch = useCallback(
        async (start: string, end: string) => {
            const result = await listAppointmentsInRange({
                rangeStart: start,
                rangeEnd: end,
            })
            if (result.success && result.data) {
                setOccurrences(result.data)
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
        [studentsById],
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

    const handleSlotClick = useCallback((date: string, time: string) => {
        // Cria rotina a partir do slot vazio. O modal atual exige
        // `preselectedStudentId` pra habilitar submit — a UX aqui é diferente
        // (trainer escolhe aluno no modal). Passamos preselectedDate/time
        // mas sem student, deixando o modal exibir erro "Selecione um aluno"
        // quando não pré-selecionado. TODO: refatorar modal pra aceitar null.
        setCreateModal({ date, time })
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
                        <h1 className="text-xl font-bold text-[#1D1D1F] dark:text-k-text-primary tracking-tight">
                            Agenda
                        </h1>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-1">
                            Calendário semanal de agendamentos
                            <span className="ml-2 text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary/70">
                                ← → navegam · T volta pra hoje
                            </span>
                        </p>
                    </div>
                    <WeekNavigator
                        weekStart={weekStart}
                        isNavigating={isPending}
                        onPrevious={goToPreviousWeek}
                        onNext={goToNextWeek}
                        onToday={goToToday}
                    />
                </div>

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
