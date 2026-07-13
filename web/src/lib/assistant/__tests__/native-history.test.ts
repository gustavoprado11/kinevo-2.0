// Histórico NATIVO (P2): as últimas mensagens do assistente viram pares
// assistant(tool-call) + tool(tool-result) reconstruídos das parts persistidas.
// O contrato aqui travado: o que vira nativo, o que permanece digest, e que
// call sem result JAMAIS é emitida (quebra providers).

import { describe, it, expect } from 'vitest'
import { toNativeModelHistory } from '../tool-memory'
import type { AssistantMessage } from '../conversations'

function msg(
    role: 'user' | 'assistant',
    content: string,
    parts: AssistantMessage['parts'] = [],
): AssistantMessage {
    return { id: `m${Math.random()}`, role, content, parts, credits_cost: 0, created_at: '2026-07-13' }
}

/** Envelope mcpSuccess como persistido nas parts. */
function envelope(payload: unknown) {
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

const PROGRAM_RESULT = envelope({
    program: {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: 'Hipertrofia 5x',
        status: 'draft',
        workouts: [
            {
                id: 'wwwwwwww-1111-2222-3333-444444444444',
                name: 'Treino A',
                scheduled_days: [1],
                items: [
                    {
                        id: 'iiiiiiii-5555-6666-7777-888888888888',
                        item_type: 'exercise',
                        sets: 4,
                        reps: '6-8',
                        exercise: { id: 'e1', name: 'Supino' },
                    },
                ],
            },
        ],
    },
})

describe('toNativeModelHistory', () => {
    it('executed com args vira par nativo; resultado de programa usa a projeção com IDs', () => {
        const history = toNativeModelHistory([
            msg('user', 'monta um treino'),
            msg('assistant', 'Montei o programa.', [
                {
                    type: 'executed',
                    toolName: 'kinevo_create_student_draft_program',
                    args: { student_id: 's1', name: 'Hipertrofia 5x' },
                    result: PROGRAM_RESULT,
                },
            ]),
        ])

        expect(history).toHaveLength(3) // user, assistant(call), tool(result)
        const assistant = history[1]
        expect(assistant.role).toBe('assistant')
        const content = assistant.content as Array<Record<string, unknown>>
        expect(content[0]).toMatchObject({ type: 'text', text: 'Montei o programa.' })
        expect(content[1]).toMatchObject({
            type: 'tool-call',
            toolName: 'kinevo_create_student_draft_program',
            input: { student_id: 's1', name: 'Hipertrofia 5x' },
        })

        const tool = history[2]
        expect(tool.role).toBe('tool')
        const result = (tool.content as Array<Record<string, unknown>>)[0]
        expect(result.toolCallId).toBe((content[1] as { toolCallId: string }).toolCallId)
        const output = result.output as { type: string; value: string }
        expect(output.type).toBe('text') // projeção dedicada de programa
        expect(output.value).toContain('program_id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
        expect(output.value).toContain('item_id=iiiiiiii-5555-6666-7777-888888888888')
    })

    it('part sem args (mensagem antiga) ainda vira nativa, com input vazio', () => {
        const history = toNativeModelHistory([
            msg('assistant', 'Feito.', [
                { type: 'executed', toolName: 'kinevo_update_student', result: envelope({ ok: true }) },
            ]),
        ])
        const content = history[0].content as Array<Record<string, unknown>>
        expect(content[1]).toMatchObject({ type: 'tool-call', input: {} })
        expect(history[1].role).toBe('tool')
    })

    it('question/proposal pendentes NUNCA viram tool-call (sem result = quebra provider)', () => {
        const history = toNativeModelHistory([
            msg('assistant', 'Qual o objetivo?', [
                {
                    type: 'question',
                    request: { question: 'Objetivo?', options: ['A', 'B'], multiple: false, allowOther: true },
                    status: 'pending',
                },
            ]),
        ])
        expect(history).toHaveLength(1)
        expect(typeof history[0].content).toBe('string')
    })

    it('fora da janela nativa degrada para o bloco <<DADOS_DE_TOOLS>>', () => {
        const old = Array.from({ length: 5 }, (_, k) =>
            msg('assistant', `turno ${k}`, [
                { type: 'executed', toolName: 'kinevo_update_student', args: { k }, result: envelope({ k }) },
            ]),
        )
        const history = toNativeModelHistory(old, { nativeWindow: 2 })
        // 5 mensagens: 3 antigas achatadas (1 msg cada) + 2 nativas (2 msgs cada).
        expect(history).toHaveLength(3 + 4)
        const flattened = history[0]
        expect(typeof flattened.content).toBe('string')
        expect(flattened.content as string).toContain('<<DADOS_DE_TOOLS>>')
        expect(flattened.content as string).toContain('kinevo_update_student (executada)')
    })

    it('leituras (context) permanecem como digest mesmo em mensagem nativa', () => {
        const history = toNativeModelHistory([
            msg('assistant', 'Aqui está.', [
                { type: 'context', toolName: 'kinevo_list_appointments', digest: '{"appointments":[…]}' },
                { type: 'executed', toolName: 'kinevo_update_student', args: {}, result: envelope({ ok: 1 }) },
            ]),
        ])
        const content = history[0].content as Array<{ type: string; text?: string }>
        const text = content.find((c) => c.type === 'text')?.text ?? ''
        expect(text).toContain('kinevo_list_appointments')
        expect(text).toContain('<<DADOS_DE_TOOLS>>')
    })

    it('confirmação: confirmada vira nativa; cancelada vira linha de digest', () => {
        const confirmed = toNativeModelHistory([
            msg('assistant', 'Enviando.', [
                {
                    type: 'confirmation',
                    request: { toolName: 'kinevo_send_message', title: '', summary: '', args: { student_id: 's1', content: 'Oi' }, destructive: false },
                    status: 'confirmed',
                    result: envelope({ sent: true }),
                },
            ]),
        ])
        expect(confirmed[1].role).toBe('tool')

        const cancelled = toNativeModelHistory([
            msg('assistant', 'Enviando.', [
                {
                    type: 'confirmation',
                    request: { toolName: 'kinevo_send_message', title: '', summary: '', args: {}, destructive: false },
                    status: 'cancelled',
                },
            ]),
        ])
        expect(cancelled).toHaveLength(1)
        expect(cancelled[0].content as string).toContain('cancelada pelo treinador')
    })
})
