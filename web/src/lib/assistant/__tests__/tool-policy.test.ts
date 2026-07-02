import { describe, it, expect } from 'vitest'
import {
    ALL_MCP_TOOLS,
    READ_TOOLS,
    WRITE_TOOLS,
    CONFIRM_TOOLS,
    classifyTool,
    creditWeightForCall,
    computeTurnCredits,
    MAX_TURN_CREDITS,
    actionClassForTool,
    resolveToolSubset,
    CORE_TOOLS,
    GENERATE_PROGRAM,
} from '../tool-policy'

describe('tool-policy — classificação', () => {
    it('cobre as 62 tools', () => {
        expect(ALL_MCP_TOOLS.length).toBe(62)
        expect(new Set(ALL_MCP_TOOLS).size).toBe(62) // sem duplicatas
    })

    it('READ ∪ WRITE = todas; READ ∩ WRITE = ∅', () => {
        for (const t of ALL_MCP_TOOLS) {
            const inRead = READ_TOOLS.has(t)
            const inWrite = WRITE_TOOLS.has(t)
            expect(inRead || inWrite).toBe(true)
            expect(inRead && inWrite).toBe(false)
        }
    })

    it('CONFIRM ⊆ WRITE', () => {
        for (const t of CONFIRM_TOOLS) {
            expect(WRITE_TOOLS.has(t)).toBe(true)
            expect(READ_TOOLS.has(t)).toBe(false)
        }
    })

    it('classifyTool: read / write / confirm', () => {
        expect(classifyTool('kinevo_list_students')).toBe('read')
        expect(classifyTool('kinevo_update_student')).toBe('write')
        expect(classifyTool('kinevo_cancel_contract')).toBe('confirm')
        expect(classifyTool('kinevo_delete_workout_item')).toBe('confirm')
    })

    it('os 5 W-GATE estão em CONFIRM', () => {
        for (const t of [
            'kinevo_create_contract',
            'kinevo_mark_payment_as_paid',
            'kinevo_cancel_contract',
            'kinevo_convert_lead',
            'kinevo_finalize_assessment',
        ]) {
            expect(CONFIRM_TOOLS.has(t)).toBe(true)
        }
    })
})

describe('tool-policy — pesos de crédito', () => {
    it('read e write simples = 1; generateProgram = 5; compostos = 2-3', () => {
        expect(creditWeightForCall('kinevo_list_students')).toBe(1)
        expect(creditWeightForCall('kinevo_update_student')).toBe(1)
        expect(creditWeightForCall(GENERATE_PROGRAM)).toBe(5)
        expect(creditWeightForCall('kinevo_create_program_template')).toBe(6) // build Sonnet (C3)
        expect(creditWeightForCall('kinevo_create_superset')).toBe(2)
    })

    it('bulk = 1/aluno, cap em 10', () => {
        expect(creditWeightForCall('kinevo_send_form', 1)).toBe(1)
        expect(creditWeightForCall('kinevo_send_form', 5)).toBe(5)
        expect(creditWeightForCall('kinevo_send_form', 20)).toBe(10)
        expect(creditWeightForCall('kinevo_send_form', 0)).toBe(1)
    })

    it('computeTurnCredits tem piso de 1', () => {
        expect(computeTurnCredits([])).toBe(1)
        expect(computeTurnCredits([{ tool: 'kinevo_list_students' }])).toBe(1)
        expect(
            computeTurnCredits([
                { tool: 'kinevo_list_students' },
                { tool: 'kinevo_get_student' },
            ]),
        ).toBe(2)
        expect(
            computeTurnCredits([
                { tool: GENERATE_PROGRAM },
                { tool: 'kinevo_send_message' },
            ]),
        ).toBe(6)
    })

    it('computeTurnCredits respeita o teto MAX_TURN_CREDITS (C1)', () => {
        // loop patológico: 12× create_student_draft_program (peso 3) = 36 → capado
        const loop = Array.from({ length: 12 }, () => ({
            tool: 'kinevo_create_student_draft_program',
        }))
        expect(computeTurnCredits(loop)).toBe(MAX_TURN_CREDITS)
        // turno legítimo (abaixo do teto) não é afetado
        expect(computeTurnCredits([{ tool: 'kinevo_create_student_draft_program' }])).toBe(6)
    })

    it('actionClassForTool', () => {
        expect(actionClassForTool('kinevo_list_students')).toBe('query')
        expect(actionClassForTool('kinevo_update_student')).toBe('write')
        expect(actionClassForTool('kinevo_send_form')).toBe('bulk')
        expect(actionClassForTool(GENERATE_PROGRAM)).toBe('prescription')
    })
})

describe('tool-policy — subsetting', () => {
    it('sem intenção → todas as 62', () => {
        expect(resolveToolSubset([]).length).toBe(62)
    })

    it('intenção financeiro inclui core + tools financeiras, exclui agenda', () => {
        const subset = resolveToolSubset(['financeiro'])
        for (const c of CORE_TOOLS) expect(subset).toContain(c)
        expect(subset).toContain('kinevo_create_contract')
        expect(subset).toContain('kinevo_get_revenue_summary')
        expect(subset).not.toContain('kinevo_create_appointment')
        expect(subset.length).toBeLessThan(62) // cortou o input
    })

    it('múltiplas intenções unem os conjuntos (sem duplicar)', () => {
        const subset = resolveToolSubset(['financeiro', 'agenda'])
        expect(subset).toContain('kinevo_create_contract')
        expect(subset).toContain('kinevo_create_appointment')
        expect(new Set(subset).size).toBe(subset.length)
    })
})
