import { describe, it, expect } from 'vitest'
import {
    digestToolResult,
    toModelHistory,
    deriveProgramFocus,
    stripInternalParts,
    MEMORY_READ_TOOLS,
} from '../tool-memory'
import type { AssistantMessage, AssistantMessagePart } from '../conversations'

/** Envelope MCP (mcpSuccess): payload JSON dentro de content[0].text. */
const env = (obj: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] })

const PROGRAM_PAYLOAD = {
    program: {
        id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
        name: 'Hipertrofia ABC',
        status: 'draft',
        student: { id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', name: 'João Silva' },
        workouts: [
            {
                id: 'cccccccc-3333-4333-8333-cccccccccccc',
                name: 'Treino A — Peito/Tríceps',
                scheduled_days: [1, 4],
                items: [
                    {
                        id: 'dddddddd-4444-4444-8444-dddddddddddd',
                        item_type: 'exercise',
                        sets: 4,
                        reps: '8-10',
                        exercise: { id: 'ex-1', name: 'Supino Reto' },
                        children: [
                            {
                                id: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
                                item_type: 'exercise',
                                sets: 3,
                                reps: '12',
                                exercise: { id: 'ex-2', name: 'Crucifixo' },
                            },
                        ],
                    },
                ],
            },
        ],
    },
}

function msg(role: 'user' | 'assistant', content: string, parts: AssistantMessagePart[] = []): AssistantMessage {
    return { id: `m-${Math.random()}`, role, content, parts, credits_cost: 0, created_at: '2026-07-01T12:00:00Z' }
}

describe('digestToolResult', () => {
    it('programa: projeção dedicada com TODOS os UUIDs (programa, sessão, itens)', () => {
        const d = digestToolResult('kinevo_get_program', env(PROGRAM_PAYLOAD))
        expect(d).toBeTruthy()
        expect(d).toContain('program_id=aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')
        expect(d).toContain('workout_id=cccccccc-3333-4333-8333-cccccccccccc')
        expect(d).toContain('item_id=dddddddd-4444-4444-8444-dddddddddddd')
        // filho do superset também entra:
        expect(d).toContain('item_id=eeeeeeee-5555-4555-8555-eeeeeeeeeeee')
        expect(d).toContain('Supino Reto 4x8-10')
        expect(d).toContain('dias=[1,4]')
        expect(d).toContain('student_id=bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb')
    })

    it('genérico: compacta, derruba nulls e respeita o cap', () => {
        const payload = {
            appointments: [
                { id: 'apt-1', title: 'Sessão João', starts_at: '2026-07-02T10:00', notes: null },
            ],
            total: 1,
        }
        const d = digestToolResult('kinevo_list_appointments', env(payload))
        expect(d).toBeTruthy()
        expect(d).toContain('apt-1')
        expect(d).not.toContain('notes')
        const long = digestToolResult('kinevo_list_appointments', env({ x: 'a'.repeat(5000) }), 100)
        expect(long!.length).toBeLessThanOrEqual(101)
    })

    it('erro (mcpError) não vira memória', () => {
        expect(digestToolResult('kinevo_get_program', env({ error: 'Programa não encontrado' }))).toBeNull()
    })
})

describe('toModelHistory', () => {
    it('anexa o bloco <<DADOS_DE_TOOLS>> às mensagens do assistente com parts', () => {
        const history = toModelHistory([
            msg('user', 'monta um treino pro João'),
            msg('assistant', 'Montei o rascunho.', [
                { type: 'executed', toolName: 'kinevo_create_student_draft_program', result: env(PROGRAM_PAYLOAD) },
            ]),
        ])
        expect(history[0].content).toBe('monta um treino pro João')
        expect(history[1].content).toContain('<<DADOS_DE_TOOLS>>')
        expect(history[1].content).toContain('program_id=aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')
        expect(history[1].content).toContain('<<FIM_DADOS_DE_TOOLS>>')
    })

    it('parts `context` entram no bloco; desfecho de confirmação também', () => {
        const history = toModelHistory([
            msg('assistant', 'ok', [
                { type: 'context', toolName: 'kinevo_list_appointments', digest: '{"appointments":[{"id":"apt-9"}]}' },
                {
                    type: 'confirmation',
                    request: { toolName: 'kinevo_send_message', title: 't', summary: 's', args: {}, destructive: false },
                    status: 'cancelled',
                },
            ]),
        ])
        expect(history[0].content).toContain('apt-9')
        expect(history[0].content).toContain('kinevo_send_message (cancelada pelo treinador)')
    })

    it('orçamento: o turno mais RECENTE ganha o bloco; os antigos perdem primeiro', () => {
        const bigPart: AssistantMessagePart = {
            type: 'context',
            toolName: 'kinevo_get_program',
            digest: 'x'.repeat(900),
        }
        const messages = [
            msg('assistant', 'antigo', [bigPart]),
            msg('assistant', 'meio', [bigPart]),
            msg('assistant', 'recente', [bigPart]),
        ]
        const history = toModelHistory(messages, { digestBudget: 1000 })
        expect(history[2].content).toContain('<<DADOS_DE_TOOLS>>')
        expect(history[1].content).not.toContain('<<DADOS_DE_TOOLS>>')
        expect(history[0].content).not.toContain('<<DADOS_DE_TOOLS>>')
    })

    it('respeita o teto de mensagens', () => {
        const many = Array.from({ length: 30 }, (_, i) => msg('user', `m${i}`))
        expect(toModelHistory(many).length).toBe(20)
    })
})

describe('deriveProgramFocus', () => {
    it('acha o programa mais recente (executed draft)', () => {
        const focus = deriveProgramFocus([
            msg('assistant', 'a', [
                { type: 'executed', toolName: 'kinevo_create_student_draft_program', result: env(PROGRAM_PAYLOAD) },
            ]),
        ])
        expect(focus).toEqual({ id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', name: 'Hipertrofia ABC' })
    })

    it('acha via digest `context` (regex program_id=...)', () => {
        const digest = digestToolResult('kinevo_get_program', env(PROGRAM_PAYLOAD))!
        const focus = deriveProgramFocus([
            msg('assistant', 'a', [{ type: 'context', toolName: 'kinevo_get_program', digest }]),
        ])
        expect(focus?.id).toBe('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')
        expect(focus?.name).toBe('Hipertrofia ABC')
    })

    it('o mais recente vence; sem programa → null', () => {
        const other = {
            program: { ...PROGRAM_PAYLOAD.program, id: 'ffffffff-9999-4999-8999-ffffffffffff', name: 'Outro' },
        }
        const focus = deriveProgramFocus([
            msg('assistant', 'velho', [
                { type: 'executed', toolName: 'kinevo_get_program', result: env(PROGRAM_PAYLOAD) },
            ]),
            msg('assistant', 'novo', [
                { type: 'executed', toolName: 'kinevo_get_program', result: env(other) },
            ]),
        ])
        expect(focus?.id).toBe('ffffffff-9999-4999-8999-ffffffffffff')
        expect(deriveProgramFocus([msg('user', 'oi')])).toBeNull()
    })
})

describe('stripInternalParts', () => {
    it('remove só as parts `context`', () => {
        const m = msg('assistant', 'a', [
            { type: 'executed', toolName: 't', result: {} },
            { type: 'context', toolName: 'kinevo_get_program', digest: 'x' },
        ])
        const stripped = stripInternalParts(m)
        expect(stripped.parts).toHaveLength(1)
        expect(stripped.parts[0].type).toBe('executed')
        // sem context → mesma referência (sem clone desnecessário)
        const clean = msg('assistant', 'b', [{ type: 'executed', toolName: 't', result: {} }])
        expect(stripInternalParts(clean)).toBe(clean)
    })
})

describe('MEMORY_READ_TOOLS', () => {
    it('inclui as leituras com IDs acionáveis em follow-up', () => {
        expect(MEMORY_READ_TOOLS.has('kinevo_get_program')).toBe(true)
        expect(MEMORY_READ_TOOLS.has('kinevo_list_appointments')).toBe(true)
        // list_students NÃO — o contexto geral já traz nome+UUID de todos.
        expect(MEMORY_READ_TOOLS.has('kinevo_list_students')).toBe(false)
    })
})
