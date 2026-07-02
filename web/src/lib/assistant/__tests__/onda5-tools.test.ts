/**
 * Onda 5 — as 5 tools novas (archive_student, correct_assessment,
 * find_exercise_substitutes, duplicate_program, send_message_batch):
 * classificação/HITL, pesos de crédito, subsetting e o schema do lote.
 */
import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import {
    ALL_MCP_TOOLS,
    CONFIRM_TOOLS,
    BULK_TOOLS,
    classifyTool,
    creditWeightForCall,
    resolveToolSubset,
    actionClassForTool,
} from '../tool-policy'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn() }))
vi.mock('@/lib/student-notifications', () => ({ insertStudentNotification: vi.fn() }))
vi.mock('@/lib/push-notifications', () => ({ sendStudentPush: vi.fn() }))

const NEW_TOOLS = [
    'kinevo_archive_student',
    'kinevo_correct_assessment',
    'kinevo_find_exercise_substitutes',
    'kinevo_duplicate_program',
    'kinevo_send_message_batch',
] as const

describe('onda5 — catálogo e classificação', () => {
    it('as 5 tools estão no catálogo', () => {
        for (const t of NEW_TOOLS) expect(ALL_MCP_TOOLS).toContain(t)
    })

    it('archive/correct/batch pausam para HITL; substitutes é read; duplicate é write', () => {
        expect(classifyTool('kinevo_archive_student')).toBe('confirm')
        expect(classifyTool('kinevo_correct_assessment')).toBe('confirm')
        expect(classifyTool('kinevo_send_message_batch')).toBe('confirm')
        expect(classifyTool('kinevo_find_exercise_substitutes')).toBe('read')
        expect(classifyTool('kinevo_duplicate_program')).toBe('write')
    })

    it('batch é BULK: crédito por aluno com cap', () => {
        expect(BULK_TOOLS.has('kinevo_send_message_batch')).toBe(true)
        expect(actionClassForTool('kinevo_send_message_batch')).toBe('bulk')
        expect(creditWeightForCall('kinevo_send_message_batch', 3)).toBe(3)
        expect(creditWeightForCall('kinevo_send_message_batch', 50)).toBe(10)
    })

    it('duplicate é write composto (peso 2, sem LLM de build)', () => {
        expect(creditWeightForCall('kinevo_duplicate_program')).toBe(2)
    })

    it('subsetting: cada tool nova entra no(s) intent(s) certo(s)', () => {
        expect(resolveToolSubset(['alunos'])).toContain('kinevo_archive_student')
        expect(resolveToolSubset(['avaliacao'])).toContain('kinevo_correct_assessment')
        expect(resolveToolSubset(['prescricao'])).toContain('kinevo_duplicate_program')
        expect(resolveToolSubset(['prescricao'])).toContain('kinevo_find_exercise_substitutes')
        expect(resolveToolSubset(['comunicacao'])).toContain('kinevo_send_message_batch')
        // e NÃO vazam para um intent alheio
        expect(resolveToolSubset(['financeiro'])).not.toContain('kinevo_send_message_batch')
        expect(resolveToolSubset(['agenda'])).not.toContain('kinevo_archive_student')
    })

    it('CONFIRM inclui exatamente as novas sensíveis (nenhuma sobrando de fora)', () => {
        expect(CONFIRM_TOOLS.has('kinevo_archive_student')).toBe(true)
        expect(CONFIRM_TOOLS.has('kinevo_correct_assessment')).toBe(true)
        expect(CONFIRM_TOOLS.has('kinevo_send_message_batch')).toBe(true)
        expect(CONFIRM_TOOLS.has('kinevo_duplicate_program')).toBe(false)
        expect(CONFIRM_TOOLS.has('kinevo_find_exercise_substitutes')).toBe(false)
    })
})

describe('onda5 — schema do lote de mensagens', () => {
    it('exige 2..100 uuids', async () => {
        const { batchStudentIdsSchema, MAX_BATCH_MESSAGE_STUDENTS } = await import(
            '@/lib/mcp/tools/messages'
        )
        expect(MAX_BATCH_MESSAGE_STUDENTS).toBe(100)
        const uuid = () => crypto.randomUUID()
        expect(batchStudentIdsSchema.safeParse([uuid()]).success).toBe(false) // 1 → use send_message
        expect(batchStudentIdsSchema.safeParse([uuid(), uuid()]).success).toBe(true)
        expect(batchStudentIdsSchema.safeParse(['não-uuid', uuid()]).success).toBe(false)
        expect(
            batchStudentIdsSchema.safeParse(Array.from({ length: 101 }, uuid)).success,
        ).toBe(false)
    })
})
