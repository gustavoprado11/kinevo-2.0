import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/messages/actions', () => ({ sendMessage: vi.fn() }))
vi.mock('@/actions/insights', () => ({ markInsightActed: vi.fn() }))

import { sendMessage } from '@/app/messages/actions'
import { markInsightActed } from '@/actions/insights'
import { DraftMessageComposer } from '../draft-message-composer'
import type { InsightItem } from '@/actions/insights'

const sendMock = vi.mocked(sendMessage)
const markMock = vi.mocked(markInsightActed)

const insight: InsightItem = {
    id: '22222222-2222-4222-8222-222222222222',
    student_id: '11111111-1111-4111-8111-111111111111',
    student_name: 'João',
    category: 'alert',
    priority: 'high',
    title: 'João está estagnado no supino',
    body: 'Mesma carga há 3 semanas.',
    action_type: 'adjust_load',
    action_metadata: {},
    status: 'new',
    source: 'rules',
    insight_key: 'stagnation:x',
    created_at: '2026-06-15T00:00:00.000Z',
}

function mockFetchOnce(payload: unknown, ok = true) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok,
        json: async () => payload,
        text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    }))
}

const baseProps = {
    insight,
    studentId: insight.student_id!,
    studentName: 'João',
}

describe('DraftMessageComposer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sendMock.mockResolvedValue({ success: true })
        markMock.mockResolvedValue({ success: true })
    })

    it('mostra loading e depois preenche o textarea com o rascunho gerado', async () => {
        mockFetchOnce({ draft: { message: 'Oi João, tudo bem?', references: ['Último treino há 5 dias'], confidence: 'high' }, cost_usd: 0.0002 })
        render(<DraftMessageComposer {...baseProps} onClose={() => {}} onSent={() => {}} />)

        expect(screen.getByText(/Gerando rascunho/i)).toBeInTheDocument()

        const textarea = await screen.findByDisplayValue('Oi João, tudo bem?')
        expect(textarea).toBeInTheDocument()
        // Referência exibida
        expect(screen.getByText('Último treino há 5 dias')).toBeInTheDocument()
    })

    it('exibe o aviso de confidence baixa', async () => {
        mockFetchOnce({ draft: { message: 'Oi, tudo bem?', references: [], confidence: 'low' }, cost_usd: 0 })
        render(<DraftMessageComposer {...baseProps} onClose={() => {}} onSent={() => {}} />)
        await screen.findByDisplayValue('Oi, tudo bem?')
        expect(screen.getByText(/Contexto limitado/i)).toBeInTheDocument()
    })

    it('envia o texto (editado) e marca o insight como tratado, chamando onSent', async () => {
        mockFetchOnce({ draft: { message: 'rascunho original', references: [], confidence: 'high' }, cost_usd: 0 })
        const onSent = vi.fn()
        render(<DraftMessageComposer {...baseProps} onClose={() => {}} onSent={onSent} />)

        const textarea = await screen.findByDisplayValue('rascunho original')
        fireEvent.change(textarea, { target: { value: 'mensagem editada pelo treinador' } })
        fireEvent.click(screen.getByRole('button', { name: /Enviar/i }))

        await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1))
        // sendMessage(studentId, FormData) com o texto editado
        const [studentIdArg, fd] = sendMock.mock.calls[0]
        expect(studentIdArg).toBe(insight.student_id)
        expect((fd as FormData).get('content')).toBe('mensagem editada pelo treinador')

        await waitFor(() => expect(markMock).toHaveBeenCalledWith(insight.id))
        await waitFor(() => expect(onSent).toHaveBeenCalledWith(insight.id))
    })

    it('não marca como tratado nem chama onSent se o envio falhar', async () => {
        mockFetchOnce({ draft: { message: 'rascunho', references: [], confidence: 'high' }, cost_usd: 0 })
        sendMock.mockResolvedValue({ success: false, error: 'Falha no envio' })
        const onSent = vi.fn()
        render(<DraftMessageComposer {...baseProps} onClose={() => {}} onSent={onSent} />)

        await screen.findByDisplayValue('rascunho')
        fireEvent.click(screen.getByRole('button', { name: /Enviar/i }))

        await waitFor(() => expect(screen.getByText('Falha no envio')).toBeInTheDocument())
        expect(markMock).not.toHaveBeenCalled()
        expect(onSent).not.toHaveBeenCalled()
    })

    it('Descartar chama onClose sem enviar', async () => {
        mockFetchOnce({ draft: { message: 'rascunho', references: [], confidence: 'high' }, cost_usd: 0 })
        const onClose = vi.fn()
        render(<DraftMessageComposer {...baseProps} onClose={onClose} onSent={() => {}} />)
        await screen.findByDisplayValue('rascunho')

        fireEvent.click(screen.getByRole('button', { name: /Descartar/i }))
        expect(onClose).toHaveBeenCalled()
        expect(sendMock).not.toHaveBeenCalled()
    })

    it('mostra estado de erro quando a geração falha (não-ok)', async () => {
        mockFetchOnce('Rate limit exceeded', false)
        render(<DraftMessageComposer {...baseProps} onClose={() => {}} onSent={() => {}} />)
        await waitFor(() => expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument())
        // Enviar fica desabilitado fora do estado "ready"
        expect(screen.getByRole('button', { name: /Enviar/i })).toBeDisabled()
    })
})
