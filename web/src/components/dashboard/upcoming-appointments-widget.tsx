'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import Image from 'next/image'
import { Calendar, ChevronRight, Package } from 'lucide-react'
import type { AppointmentOccurrence } from '@kinevo/shared/types/appointments'
import type { UpcomingAppointmentStudent } from '@/lib/dashboard/get-dashboard-data'
import { OccurrencePopover } from '@/components/appointments/occurrence-popover'

interface Props {
    appointments: AppointmentOccurrence[]
    studentsById: Record<string, UpcomingAppointmentStudent>
}

const WEEKDAYS_PT: Record<number, string> = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
}

const TIMEZONE = 'America/Sao_Paulo'

function toTodayDateKey(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/** Days difference between two `YYYY-MM-DD` strings in calendar days. */
function daysBetween(fromKey: string, toKey: string): number {
    const [fy, fm, fd] = fromKey.split('-').map(Number)
    const [ty, tm, td] = toKey.split('-').map(Number)
    const from = Date.UTC(fy, fm - 1, fd)
    const to = Date.UTC(ty, tm - 1, td)
    return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

/**
 * Formata a data/hora de uma ocorrência em pt-BR:
 * - "Hoje às 07:00"
 * - "Amanhã às 07:00"
 * - "Terça às 07:00" (próximos 2-6 dias)
 * - "03/05 às 07:00" (7+ dias)
 */
export function formatOccurrenceWhen(
    dateKey: string,
    startTime: string,
    todayKey: string,
): string {
    const delta = daysBetween(todayKey, dateKey)
    const hh = startTime.slice(0, 5)

    if (delta === 0) return `Hoje às ${hh}`
    if (delta === 1) return `Amanhã às ${hh}`
    if (delta >= 2 && delta <= 6) {
        const [y, m, d] = dateKey.split('-').map(Number)
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
        return `${WEEKDAYS_PT[dow]} às ${hh}`
    }
    // 7+ dias ou passado
    const [, m, d] = dateKey.split('-').map(Number)
    const dd = String(d).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    return `${dd}/${mm} às ${hh}`
}

function studentInitial(name: string): string {
    return name.charAt(0).toUpperCase()
}

export function UpcomingAppointmentsWidget({ appointments, studentsById }: Props) {
    const router = useRouter()
    const todayKey = toTodayDateKey()

    const refresh = useCallback(() => {
        // Trigger server component refresh so the widget picks up new data.
        router.refresh()
    }, [router])

    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                        Próximos agendamentos
                    </h2>
                    {appointments.length > 0 && (
                        <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded">
                            {appointments.length}
                        </span>
                    )}
                </div>
            </div>

            {appointments.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-violet-50 dark:bg-violet-500/10">
                        <Calendar className="h-4 w-4 text-violet-500" strokeWidth={2} />
                    </div>
                    <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary">
                        Nenhum agendamento marcado
                    </p>
                    <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-1">
                        Crie uma rotina no perfil de um aluno
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-[#E8E8ED] dark:divide-border">
                    {appointments.map((occ) => {
                        const student = studentsById[occ.studentId]
                        const studentName = student?.name ?? 'Aluno'
                        const whenLabel = formatOccurrenceWhen(
                            occ.date,
                            occ.startTime,
                            todayKey,
                        )
                        return (
                            <li
                                key={`${occ.recurringAppointmentId}-${occ.originalDate}`}
                                className="px-6 py-3"
                            >
                                <OccurrencePopover
                                    occurrence={occ}
                                    studentName={studentName}
                                    studentAvatarUrl={student?.avatarUrl ?? null}
                                    onRescheduled={refresh}
                                    onCanceled={refresh}
                                >
                                    <div className="flex items-center gap-3 w-full group hover:bg-[#F9F9FB] dark:hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors">
                                        <div className="h-9 w-9 shrink-0 rounded-full border border-[#E8E8ED] dark:border-border bg-[#F5F5F7] dark:bg-muted flex items-center justify-center overflow-hidden">
                                            {student?.avatarUrl ? (
                                                <Image
                                                    src={student.avatarUrl}
                                                    alt={studentName}
                                                    width={36}
                                                    height={36}
                                                    className="h-9 w-9 object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <span className="text-sm font-bold text-[#007AFF] dark:text-primary">
                                                    {studentInitial(studentName)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground truncate">
                                                    {studentName}
                                                </span>
                                                {occ.groupId && (
                                                    <span
                                                        title="Faz parte de um pacote multi-dia"
                                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                                                    >
                                                        <Package className="w-2.5 h-2.5" strokeWidth={2} />
                                                        Pacote
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-[#86868B] dark:text-muted-foreground">
                                                {whenLabel}
                                                <span className="ml-1.5 text-[#AEAEB2] dark:text-k-text-quaternary">
                                                    · {occ.durationMinutes} min
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </OccurrencePopover>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
