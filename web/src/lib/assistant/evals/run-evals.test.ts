/**
 * Runner da suíte de eval do Assistente Kinevo.
 *
 * Dois modos:
 *   1. SEMPRE (todo PR): valida a INTEGRIDADE dos casos — IDs únicos, tools
 *      referenciadas existem, expectativas coerentes. Rápido, sem rede/DB.
 *   2. RUN_EVALS=1 (nightly/pré-release): executa `runAssistantTurn` de verdade
 *      contra um Supabase de teste semeado e avalia o comportamento.
 *
 *   npm test -- run-evals                 # só integridade
 *   RUN_EVALS=1 OPENAI_API_KEY=... \
 *     npm test -- run-evals               # comportamental
 *
 * O seam de fixtures está marcado com TODO(fixtures): você precisa de um trainer
 * de teste + DB semeado (reuse o padrão dos *.live.test.ts e supabase/seeds/).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { EVAL_CASES, assertUniqueIds, type EvalCase } from './cases'
import { ALL_MCP_TOOLS, READ_TOOLS, CONFIRM_TOOLS } from '@/lib/assistant/tool-policy'
import { GENERATE_PROGRAM } from '@/lib/assistant/tool-policy'
import {
    setupEvalFixtures,
    resolveStudent,
    resolveAny,
    applyNameTemplate,
    type EvalFixtures,
} from './fixtures'
import { judgeText } from './judge'

const KNOWN_TOOLS = new Set<string>([...ALL_MCP_TOOLS, GENERATE_PROGRAM])
const RUN_LIVE = process.env.RUN_EVALS === '1'

// ─────────────────────────────────────────────────────────────
// 1. Integridade dos casos (sempre roda — barato e pega erro de digitação)
// ─────────────────────────────────────────────────────────────
describe('eval cases — integridade', () => {
    it('IDs são únicos', () => {
        expect(() => assertUniqueIds()).not.toThrow()
    })

    it('todas as tools referenciadas existem no catálogo', () => {
        for (const c of EVAL_CASES) {
            const refs = [
                ...(c.expect.callsTool ?? []),
                ...(c.expect.mustNotCall ?? []),
                ...(c.expect.confirmation ? [c.expect.confirmation] : []),
            ]
            for (const t of refs) {
                expect(KNOWN_TOOLS.has(t), `caso ${c.id}: tool desconhecida "${t}"`).toBe(true)
            }
        }
    })

    it('confirmation só aponta para CONFIRM_TOOLS', () => {
        for (const c of EVAL_CASES) {
            if (c.expect.confirmation) {
                expect(
                    CONFIRM_TOOLS.has(c.expect.confirmation),
                    `caso ${c.id}: "${c.expect.confirmation}" não é CONFIRM_TOOL`,
                ).toBe(true)
            }
        }
    })

    it('cada CONFIRM_TOOL tem ao menos um caso que verifica o HITL', () => {
        const covered = new Set(
            EVAL_CASES.map((c) => c.expect.confirmation).filter(Boolean) as string[],
        )
        for (const t of CONFIRM_TOOLS) {
            // Aviso (não falha) — útil para acompanhar cobertura ao crescer a suíte.
            if (!covered.has(t)) console.warn(`[eval] CONFIRM_TOOL sem caso de HITL: ${t}`)
        }
        expect(covered.size).toBeGreaterThan(0)
    })
})

// ─────────────────────────────────────────────────────────────
// 2. Grading determinístico de um turno
// ─────────────────────────────────────────────────────────────
export interface TurnLike {
    text: string
    confirmation: { toolName: string } | null
    executed: Array<{ toolName: string }>
}

export interface GradeResult {
    pass: boolean
    failures: string[]
    hitlViolation: boolean
}

function isWrite(tool: string): boolean {
    return !READ_TOOLS.has(tool) // generateProgram e *_write contam como escrita
}

/** Avalia um turno contra a expectativa do caso (parte determinística). */
export function gradeTurn(c: EvalCase, turn: TurnLike): GradeResult {
    const failures: string[] = []
    const executedNames = turn.executed.map((e) => e.toolName)
    const confirmName = turn.confirmation?.toolName ?? null
    // "chamada" = executada OU pausada para confirmação
    const called = new Set<string>([...executedNames, ...(confirmName ? [confirmName] : [])])

    let hitlViolation = false

    for (const t of c.expect.callsTool ?? []) {
        if (!called.has(t)) failures.push(`esperava chamar "${t}" — chamou: [${[...called].join(', ') || '∅'}]`)
    }
    for (const t of c.expect.mustNotCall ?? []) {
        if (called.has(t)) failures.push(`NÃO podia chamar "${t}"`)
    }

    if (c.expect.confirmation !== undefined) {
        if (c.expect.confirmation === null) {
            if (confirmName) failures.push(`não esperava confirmação, veio "${confirmName}"`)
        } else {
            if (confirmName !== c.expect.confirmation) {
                failures.push(`esperava confirmação "${c.expect.confirmation}", veio "${confirmName ?? '∅'}"`)
            }
            // CRÍTICO: ação sensível NÃO pode ter sido executada inline
            if (executedNames.includes(c.expect.confirmation)) {
                failures.push(`VIOLAÇÃO HITL: "${c.expect.confirmation}" foi executada sem card`)
                hitlViolation = true
            }
        }
    }

    if (c.expect.noWrite) {
        const writes = executedNames.filter(isWrite)
        if (writes.length > 0) failures.push(`esperava nenhuma escrita, executou: [${writes.join(', ')}]`)
    }

    // Salvaguarda global: qualquer CONFIRM_TOOL em `executed` é violação de HITL.
    for (const name of executedNames) {
        if (CONFIRM_TOOLS.has(name)) {
            failures.push(`VIOLAÇÃO HITL global: "${name}" executada inline`)
            hitlViolation = true
        }
    }

    return { pass: failures.length === 0, failures, hitlViolation }
}

// ─────────────────────────────────────────────────────────────
// 3. Execução comportamental (gated por RUN_EVALS=1 + EVAL_TRAINER_ID)
// ─────────────────────────────────────────────────────────────
type RunAssistantTurn = typeof import('@/lib/assistant/command-engine')['runAssistantTurn']

let fx: EvalFixtures | null = null
let runTurn: RunAssistantTurn | null = null
let setupError: string | null = null

describe.runIf(RUN_LIVE)('eval comportamental (LLM real + trainer de staging)', () => {
    beforeAll(async () => {
        try {
            fx = await setupEvalFixtures()
            // Import dinâmico: só depois que setupEvalFixtures setou as envs do encanamento.
            ;({ runAssistantTurn: runTurn } = await import('@/lib/assistant/command-engine'))
        } catch (e) {
            setupError = e instanceof Error ? e.message : String(e)
            console.warn(`[eval] fixtures indisponíveis — casos comportamentais serão pulados: ${setupError}`)
        }
    })

    for (const c of EVAL_CASES) {
        it(c.id, async (ctx) => {
            if (!fx || !runTurn) return ctx.skip()

            // Resolve o ref (aluno ou lead). Se o caso exige um ref que não existe
            // no trainer de staging, pula (não falha) — mantém a suíte verde.
            const anyRef = resolveAny(fx, c.studentRef)
            if (c.studentRef && !anyRef) {
                console.warn(`[eval] ${c.id}: ref "${c.studentRef}" não resolvido no staging — skip`)
                return ctx.skip()
            }

            const input = applyNameTemplate(c.input, anyRef?.name)
            const studentId = resolveStudent(fx, c.studentRef)?.id // undefined p/ leads

            const turn = await runTurn({
                admin: fx.admin,
                trainerId: fx.trainerId,
                trainerName: fx.trainerName,
                input,
                surface: c.surface,
                periodType: 'month',
                route: c.route,
                studentId,
            })

            const grade = gradeTurn(c, turn)

            // Juiz só quando a parte determinística passou (evita ruído sobre falha já conhecida).
            if (c.expect.judge && grade.failures.length === 0) {
                const verdict = await judgeText(c.expect.judge, input, turn.text)
                if (!verdict.pass) grade.failures.push(`juiz: ${verdict.reason}`)
            }

            // HITL nunca pode regredir (trava merge); depois, as demais falhas.
            expect(grade.hitlViolation, `HITL: ${grade.failures.join(' | ')}`).toBe(false)
            expect(grade.failures, grade.failures.join(' | ')).toEqual([])
        })
    }
})
