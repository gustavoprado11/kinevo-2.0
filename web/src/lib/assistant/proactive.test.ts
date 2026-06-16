import { describe, it, expect, vi } from 'vitest'

// `proactive.ts` importa `runAssistantTurn` de `command-engine`, que ao carregar
// puxa todo o universo das 55 tools MCP (supabase-admin, stripe...) cujos módulos
// lançam sem env no ambiente de teste. Este teste só exercita `buildBriefingInput`
// (função pura, sem rede) — então mockamos o módulo inteiro e evitamos a cadeia.
vi.mock('@/lib/assistant/command-engine', () => ({ runAssistantTurn: vi.fn() }))

import { buildBriefingInput } from './proactive'

describe('proactive — briefing input', () => {
    it('mantém o contrato do briefing (telegráfico, sem cumprimento, sem ação sensível)', () => {
        const s = buildBriefingInput()
        expect(s).toMatch(/BRIEFING/i)
        expect(s).toMatch(/telegráfico/i)
        expect(s).toMatch(/não cumprimente/i)
        expect(s).toMatch(/não execute nenhuma ação sensível/i)
    })

    it('cobre as fontes do dia (alunos, alertas, agenda, pagamentos)', () => {
        const s = buildBriefingInput().toLowerCase()
        expect(s).toContain('sem treinar')
        expect(s).toContain('alertas')
        expect(s).toContain('agenda')
        expect(s).toContain('pagamentos')
    })
})
