import { describe, it, expect } from 'vitest'
import {
    appointmentMessages,
    DAY_ABBR,
    DAY_NAMES_SHORT,
    joinPt,
} from '../notification-messages'

describe('joinPt', () => {
    it('retorna string vazia quando lista vazia', () => {
        expect(joinPt([])).toBe('')
    })
    it('retorna o item quando lista tem 1', () => {
        expect(joinPt(['seg'])).toBe('seg')
    })
    it('usa " e " pra 2 itens', () => {
        expect(joinPt(['seg', 'sex'])).toBe('seg e sex')
    })
    it('usa ", " + " e " pra 3+ itens', () => {
        expect(joinPt(['seg', 'qua', 'sex'])).toBe('seg, qua e sex')
    })
})

describe('DAY_NAMES_SHORT / DAY_ABBR', () => {
    it('cobre os 7 dias', () => {
        for (let i = 0; i < 7; i++) {
            expect(DAY_NAMES_SHORT[i]).toBeTruthy()
            expect(DAY_ABBR[i]).toBeTruthy()
        }
    })
})

describe('appointmentMessages', () => {
    it('rotinaCriada usa nome completo do dia + horário', () => {
        const msg = appointmentMessages.rotinaCriada(2, '07:00')
        expect(msg.title).toBe('Novo agendamento')
        expect(msg.body).toBe('Seu treinador agendou treinos toda terça às 07:00')
    })

    it('pacoteCriado agrega dias únicos ordenados usando DAY_ABBR', () => {
        const msg = appointmentMessages.pacoteCriado([5, 1, 3])
        expect(msg.title).toBe('Novos agendamentos')
        expect(msg.body).toBe('Seu treinador agendou treinos em seg, qua e sex')
    })

    it('pacoteCriado remove duplicatas', () => {
        const msg = appointmentMessages.pacoteCriado([1, 1, 3])
        expect(msg.body).toBe('Seu treinador agendou treinos em seg e qua')
    })

    it('lembrete1hAntes inclui nome do treinador e hora', () => {
        const msg = appointmentMessages.lembrete1hAntes('Gustavo', '07:00')
        expect(msg.title).toBe('Treino em 1 hora')
        expect(msg.body).toBe('Seu treino com Gustavo é às 07:00')
    })

    it('ocorrenciaRemarcada formata data + hora', () => {
        const msg = appointmentMessages.ocorrenciaRemarcada('25/04', '08:30')
        expect(msg.title).toBe('Treino remarcado')
        expect(msg.body).toBe('Seu treino foi remarcado para 25/04 às 08:30')
    })

    it('ocorrenciaCancelada inclui data e horário', () => {
        const msg = appointmentMessages.ocorrenciaCancelada('24/04', '07:00')
        expect(msg.title).toBe('Treino cancelado')
        expect(msg.body).toBe('Seu treino de 24/04 às 07:00 foi cancelado')
    })

    it('rotinaCancelada usa nome completo do dia', () => {
        const msg = appointmentMessages.rotinaCancelada(3)
        expect(msg.title).toBe('Agendamento encerrado')
        expect(msg.body).toBe('Os treinos que aconteciam toda quarta foram encerrados')
    })

    it('pacoteCancelado usa nome do treinador', () => {
        const msg = appointmentMessages.pacoteCancelado('Gustavo')
        expect(msg.title).toBe('Agendamentos encerrados')
        expect(msg.body).toBe('Seus treinos com Gustavo foram encerrados')
    })

    it('títulos são consistentes entre chamadas com mesmos argumentos', () => {
        expect(appointmentMessages.rotinaCriada(2, '07:00')).toEqual(
            appointmentMessages.rotinaCriada(2, '07:00'),
        )
    })
})
