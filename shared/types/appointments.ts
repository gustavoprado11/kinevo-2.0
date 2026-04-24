/**
 * Appointments — Types
 *
 * Tipos compartilhados (Web + Mobile) pra rotinas recorrentes de atendimento.
 * Alinhados com as tabelas da migration 106.
 */

export type AppointmentFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly'
export type AppointmentStatus = 'active' | 'canceled'
export type ExceptionKind =
    | 'rescheduled'
    | 'canceled'
    | 'completed'
    | 'no_show'

/** Status computado de uma ocorrência já com exceções aplicadas. */
export type OccurrenceStatus =
    | 'scheduled'
    | 'rescheduled'
    | 'completed'
    | 'no_show'

/** Linha da tabela `recurring_appointments`. */
export interface RecurringAppointment {
    id: string
    trainer_id: string
    student_id: string
    day_of_week: number // 0 = Domingo … 6 = Sábado
    start_time: string // "HH:MM" ou "HH:MM:SS"
    duration_minutes: number
    frequency: AppointmentFrequency
    starts_on: string // "YYYY-MM-DD"
    ends_on: string | null
    status: AppointmentStatus
    notes: string | null
    /**
     * NULL quando a rotina é simples. Quando presente, agrupa linhas do
     * mesmo pacote multi-slot (ex: Seg 7h + Qua 7h + Sex 18h para o
     * mesmo aluno).
     */
    group_id: string | null
    /** ID do evento no Google Calendar (Fase 6). NULL se nunca sincronizou. */
    google_event_id?: string | null
    /** Estado da sincronização Google (Fase 6). */
    google_sync_status?:
        | 'not_synced'
        | 'pending'
        | 'synced'
        | 'error'
        | 'disabled'
        | null
    created_at: string
    updated_at: string
}

/** Linha da tabela `appointment_exceptions`. */
export interface AppointmentException {
    id: string
    recurring_appointment_id: string
    trainer_id: string
    occurrence_date: string // "YYYY-MM-DD"
    kind: ExceptionKind
    new_date: string | null
    new_start_time: string | null
    notes: string | null
    created_at: string
}

/**
 * Ocorrência concreta de um agendamento recorrente em uma data específica,
 * já com exceções aplicadas. Produzida pelo `appointments-projection`.
 */
export interface AppointmentOccurrence {
    recurringAppointmentId: string
    /** ID do pacote multi-slot quando a rotina pertence a um grupo. */
    groupId: string | null
    studentId: string
    trainerId: string

    /** Data efetiva (pode diferir de originalDate se remarcada). "YYYY-MM-DD". */
    date: string
    /** Hora efetiva. "HH:MM". */
    startTime: string
    durationMinutes: number

    /** Data original antes de qualquer remarcação. "YYYY-MM-DD". */
    originalDate: string

    status: OccurrenceStatus

    /** True se há linha em `appointment_exceptions` pra essa ocorrência. */
    hasException: boolean

    /** Notas da regra + nota da exceção (se houver). */
    notes: string | null
}
