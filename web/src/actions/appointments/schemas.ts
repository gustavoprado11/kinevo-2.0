import { z } from 'zod'

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_HHMM_REGEX = /^\d{2}:\d{2}$/

export const frequencySchema = z.enum(['once', 'weekly', 'biweekly', 'monthly'])
export const exceptionKindSchema = z.enum([
    'rescheduled',
    'canceled',
    'completed',
    'no_show',
])

export const createRecurringInputSchema = z.object({
    studentId: z.string().uuid({ message: 'ID do aluno inválido' }),
    dayOfWeek: z
        .number({ invalid_type_error: 'Dia da semana inválido' })
        .int()
        .min(0, { message: 'Dia da semana deve ser entre 0 e 6' })
        .max(6, { message: 'Dia da semana deve ser entre 0 e 6' }),
    startTime: z
        .string()
        .regex(TIME_HHMM_REGEX, { message: 'Horário inválido (use HH:MM)' }),
    durationMinutes: z
        .number({ invalid_type_error: 'Duração inválida' })
        .int()
        .min(15, { message: 'Duração mínima é 15 minutos' })
        .max(240, { message: 'Duração máxima é 240 minutos' })
        .default(60),
    frequency: frequencySchema.default('weekly'),
    startsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data inicial inválida (YYYY-MM-DD)' }),
    endsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data final inválida (YYYY-MM-DD)' })
        .nullable()
        .optional(),
    notes: z
        .string()
        .max(500, { message: 'Notas devem ter até 500 caracteres' })
        .nullable()
        .optional(),
})
export type CreateRecurringInput = z.infer<typeof createRecurringInputSchema>

export const updateRecurringInputSchema = createRecurringInputSchema
    .partial()
    .extend({ id: z.string().uuid({ message: 'ID inválido' }) })
export type UpdateRecurringInput = z.infer<typeof updateRecurringInputSchema>

export const cancelRecurringInputSchema = z.object({
    id: z.string().uuid({ message: 'ID inválido' }),
    endsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data final inválida (YYYY-MM-DD)' })
        .optional(),
})
export type CancelRecurringInput = z.infer<typeof cancelRecurringInputSchema>

export const rescheduleOccurrenceInputSchema = z.object({
    recurringAppointmentId: z.string().uuid({ message: 'ID da rotina inválido' }),
    originalDate: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data original inválida' }),
    newDate: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Nova data inválida' }),
    newStartTime: z
        .string()
        .regex(TIME_HHMM_REGEX, { message: 'Novo horário inválido (HH:MM)' }),
    scope: z.enum(['only_this', 'this_and_future']),
    notes: z.string().max(500).optional(),
})
export type RescheduleOccurrenceInput = z.infer<
    typeof rescheduleOccurrenceInputSchema
>

export const cancelOccurrenceInputSchema = z.object({
    recurringAppointmentId: z.string().uuid({ message: 'ID da rotina inválido' }),
    occurrenceDate: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data inválida' }),
    notes: z.string().max(500).optional(),
})
export type CancelOccurrenceInput = z.infer<typeof cancelOccurrenceInputSchema>

export const markOccurrenceStatusInputSchema = z.object({
    recurringAppointmentId: z.string().uuid({ message: 'ID da rotina inválido' }),
    occurrenceDate: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data inválida' }),
    status: z.enum(['completed', 'no_show']),
    notes: z.string().max(500).optional(),
})
export type MarkOccurrenceStatusInput = z.infer<
    typeof markOccurrenceStatusInputSchema
>

export const slotInputSchema = z.object({
    dayOfWeek: z
        .number({ invalid_type_error: 'Dia da semana inválido' })
        .int()
        .min(0, { message: 'Dia da semana deve ser entre 0 e 6' })
        .max(6, { message: 'Dia da semana deve ser entre 0 e 6' }),
    startTime: z
        .string()
        .regex(TIME_HHMM_REGEX, { message: 'Horário inválido (use HH:MM)' }),
    durationMinutes: z
        .number({ invalid_type_error: 'Duração inválida' })
        .int()
        .min(15, { message: 'Duração mínima é 15 minutos' })
        .max(240, { message: 'Duração máxima é 240 minutos' }),
})
export type SlotInput = z.infer<typeof slotInputSchema>

export const createRecurringGroupInputSchema = z.object({
    studentId: z.string().uuid({ message: 'ID do aluno inválido' }),
    slots: z
        .array(slotInputSchema)
        .min(1, { message: 'Adicione pelo menos um dia à rotina' })
        .max(7, { message: 'Uma rotina pode ter no máximo 7 dias por semana' }),
    frequency: frequencySchema.default('weekly'),
    startsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data inicial inválida (YYYY-MM-DD)' }),
    endsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data final inválida (YYYY-MM-DD)' })
        .nullable()
        .optional(),
    notes: z
        .string()
        .max(500, { message: 'Notas devem ter até 500 caracteres' })
        .nullable()
        .optional(),
})
export type CreateRecurringGroupInput = z.infer<
    typeof createRecurringGroupInputSchema
>

export const cancelRecurringGroupInputSchema = z.object({
    groupId: z.string().uuid({ message: 'ID do pacote inválido' }),
    endsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data final inválida (YYYY-MM-DD)' })
        .optional(),
})
export type CancelRecurringGroupInput = z.infer<
    typeof cancelRecurringGroupInputSchema
>

export const cancelAllForStudentInputSchema = z.object({
    studentId: z.string().uuid({ message: 'ID do aluno inválido' }),
    endsOn: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'Data final inválida (YYYY-MM-DD)' })
        .optional(),
})
export type CancelAllForStudentInput = z.infer<
    typeof cancelAllForStudentInputSchema
>

export const listAppointmentsInputSchema = z.object({
    rangeStart: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'rangeStart inválido (YYYY-MM-DD)' }),
    rangeEnd: z
        .string()
        .regex(DATE_KEY_REGEX, { message: 'rangeEnd inválido (YYYY-MM-DD)' }),
})
export type ListAppointmentsInput = z.infer<typeof listAppointmentsInputSchema>
