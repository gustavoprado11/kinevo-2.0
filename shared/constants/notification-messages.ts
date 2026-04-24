/**
 * Notification Messages — Appointments
 *
 * Pares `{title, body}` centralizados para pushes que o aluno recebe
 * quando o trainer cria/edita/cancela agendamentos. Todos os textos são
 * pt-BR (MVP Brasil) — ver `docs/specs/agendamentos-plano.md` seção 6.6.
 *
 * Dia da semana usa forma curta minúscula ("seg", "qua", "sex"), ideal
 * pra caber em notificações push sem truncar.
 */

export interface PushMessage {
    title: string
    body: string
}

/** 0 = domingo … 6 = sábado */
export const DAY_NAMES_SHORT: Record<number, string> = {
    0: 'domingo',
    1: 'segunda',
    2: 'terça',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sábado',
}

/** 0 = domingo … 6 = sábado — versão reduzida para listas ("seg", "qua", "sex"). */
export const DAY_ABBR: Record<number, string> = {
    0: 'dom',
    1: 'seg',
    2: 'ter',
    3: 'qua',
    4: 'qui',
    5: 'sex',
    6: 'sáb',
}

/**
 * Junta uma lista de labels com "," e "e" (ex: ["seg", "qua", "sex"] → "seg, qua e sex").
 * Lista vazia → ''. Lista com 1 item → o próprio item.
 */
export function joinPt(items: string[]): string {
    if (items.length === 0) return ''
    if (items.length === 1) return items[0]
    const head = items.slice(0, -1).join(', ')
    const tail = items[items.length - 1]
    return `${head} e ${tail}`
}

export const appointmentMessages = {
    rotinaCriada: (dayOfWeek: number, startTime: string): PushMessage => ({
        title: 'Novo agendamento',
        body: `Seu treinador agendou treinos toda ${DAY_NAMES_SHORT[dayOfWeek]} às ${startTime}`,
    }),
    pacoteCriado: (daysOfWeek: number[]): PushMessage => {
        const uniqueDays = Array.from(new Set(daysOfWeek)).sort((a, b) => a - b)
        const labels = uniqueDays.map((d) => DAY_ABBR[d])
        return {
            title: 'Novos agendamentos',
            body: `Seu treinador agendou treinos em ${joinPt(labels)}`,
        }
    },
    lembrete1hAntes: (trainerName: string, startTime: string): PushMessage => ({
        title: 'Treino em 1 hora',
        body: `Seu treino com ${trainerName} é às ${startTime}`,
    }),
    ocorrenciaRemarcada: (newDateLabel: string, newStartTime: string): PushMessage => ({
        title: 'Treino remarcado',
        body: `Seu treino foi remarcado para ${newDateLabel} às ${newStartTime}`,
    }),
    ocorrenciaCancelada: (dateLabel: string, startTime: string): PushMessage => ({
        title: 'Treino cancelado',
        body: `Seu treino de ${dateLabel} às ${startTime} foi cancelado`,
    }),
    rotinaCancelada: (dayOfWeek: number): PushMessage => ({
        title: 'Agendamento encerrado',
        body: `Os treinos que aconteciam toda ${DAY_NAMES_SHORT[dayOfWeek]} foram encerrados`,
    }),
    pacoteCancelado: (trainerName: string): PushMessage => ({
        title: 'Agendamentos encerrados',
        body: `Seus treinos com ${trainerName} foram encerrados`,
    }),
} as const
