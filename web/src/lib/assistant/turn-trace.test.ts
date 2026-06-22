import { describe, it, expect } from 'vitest'
import { toolResultOk } from './turn-trace'
import { mcpSuccess, mcpError } from '@/lib/mcp/types'

/**
 * toolResultOk é billing-crítico: o crédito do turno só conta tools que deram certo
 * (auditoria 2026-06-22, C2). Uma falha tem que ser detectada nos DOIS envelopes que
 * circulam — o do MCP (isError:true / {"error":...} no content) e o das tools próprias
 * do chat ({error} / {success:false}). Errar p/ "falhou" é o lado seguro do billing.
 */
describe('toolResultOk — envelope MCP', () => {
    it('mcpError() é falha (isError:true)', () => {
        expect(toolResultOk(mcpError('Aluno não encontrado.'))).toBe(false)
    })

    it('mcpSuccess() é sucesso', () => {
        expect(toolResultOk(mcpSuccess({ message: { id: 'x' }, status: 'sent' }))).toBe(true)
    })

    it('detecta erro pelo content textual mesmo sem isError preservado', () => {
        const semFlag = { content: [{ type: 'text', text: JSON.stringify({ error: 'falhou' }) }] }
        expect(toolResultOk(semFlag)).toBe(false)
    })

    it('sucesso cujo payload contém a chave "error":null NÃO é falsamente reprovado', () => {
        expect(toolResultOk(mcpSuccess({ ok: true, error: null }))).toBe(true)
    })
})

describe('toolResultOk — envelope das tools próprias do chat', () => {
    it('{error} é falha', () => {
        expect(toolResultOk({ error: 'boom' })).toBe(false)
    })

    it('{success:false} é falha', () => {
        expect(toolResultOk({ success: false })).toBe(false)
    })

    it('{success:true} é sucesso', () => {
        expect(toolResultOk({ success: true, data: [] })).toBe(true)
    })
})

describe('toolResultOk — não-objetos não são falha', () => {
    it.each([null, undefined, 'texto', 42, true])('%s → ok', (v) => {
        expect(toolResultOk(v)).toBe(true)
    })
})
