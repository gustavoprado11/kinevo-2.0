import { describe, it, expect } from 'vitest'
import { buildInstructions, formatForSurface, PROMPT_VERSION } from './system-prompt'

describe('system-prompt v2', () => {
    it('expõe uma versão semântica', () => {
        expect(PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('contém as regras-núcleo (persona, não inventar, UUID, médico, temporal)', () => {
        const s = buildInstructions('workspace')
        expect(s).toContain('Assistente do Kinevo')
        expect(s).toContain('Nunca invente dados')
        expect(s).toMatch(/UUID do aluno/i)
        expect(s).toMatch(/diagnóstico médico/i)
        expect(s).toMatch(/DATA E HORA atuais/i)
        expect(s).toContain('generateProgram')
    })

    it('NÃO referencia a tool fantasma analyzeStudentProgress', () => {
        // Bug histórico: o prompt base mandava usar uma tool inexistente no caminho MCP.
        expect(buildInstructions('workspace')).not.toContain('analyzeStudentProgress')
    })

    it('voz: instrui resposta falável sem markdown', () => {
        const s = buildInstructions('voice')
        expect(s).toMatch(/VOZ ALTA/i)
        expect(s).toMatch(/não use markdown/i)
        expect(formatForSurface('voice')).toMatch(/frases curtas/i)
    })

    it('proativo: instrui briefing telegráfico e sem ação sensível autônoma', () => {
        const s = buildInstructions('proactive')
        expect(s).toMatch(/briefing/i)
        expect(s).toMatch(/ações sensíveis por conta própria/i)
    })

    it('default (workspace/chat): permite markdown leve', () => {
        expect(formatForSurface('workspace')).toMatch(/markdown leve/i)
        expect(formatForSurface('chat' as never)).toMatch(/markdown leve/i)
    })
})
