/**
 * Validação semântica de argumentos das CONFIRM_TOOLS (Guardrail G5 — Fase B).
 *
 * O HITL protege a EXECUÇÃO (a tool só roda após o card). Mas o card é montado com
 * o que o modelo mandou — sem checar se faz sentido. Aqui validamos ANTES:
 *   - o recurso existe e pertence a ESTE treinador (anti-alvo-errado / anti-injeção);
 *   - o estado permite a ação (ex.: não cancelar contrato já cancelado);
 *   - devolvemos um ALVO LEGÍVEL ("Pedro Silva — R$ 199,00/mês") p/ o card confirmar
 *     com contexto, não com args crus.
 *
 * Política:
 *   - Estrito (pode BLOQUEAR) onde há dinheiro/conta e dá pra validar com confiança:
 *     contratos (criar/pagar/cancelar) e conversão de lead.
 *   - Best-effort (NUNCA bloqueia) no resto: a própria tool já checa posse na execução
 *     (ex.: delete de treino via verifyItemOwnership; agenda/avaliação via core/RPC).
 *   - FAIL-OPEN: se o próprio validador falhar (erro de query/schema), liberamos —
 *     um guardrail quebrado jamais pode travar uma ação legítima.
 *
 * Usado em dois pontos:
 *   - command-engine (UX): enriquece o card ou troca por uma clarificação;
 *   - execute-tool (enforcement): barra a execução real se inválido (defense-in-depth).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ConfirmTarget {
    /** Rótulo legível do alvo p/ o card (ex.: "Pedro Silva — R$ 199,00/mês"). */
    label: string
    details?: Record<string, string>
}

export type ConfirmValidation =
    | { ok: true; target: ConfirmTarget | null }
    | { ok: false; reason: string }

function brl(n: number | null | undefined): string {
    const v = typeof n === 'number' ? n : 0
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function str(v: unknown): string | null {
    return typeof v === 'string' && v.length > 0 ? v : null
}

const INTERVAL_PT: Record<string, string> = { month: 'mês', quarter: 'trimestre', year: 'ano' }

async function studentName(
    admin: SupabaseClient,
    trainerId: string,
    studentId: string | null,
): Promise<string | null> {
    if (!studentId) return null
    const { data } = await admin
        .from('students')
        .select('name')
        .eq('id', studentId)
        .eq('coach_id', trainerId)
        .maybeSingle()
    return (data as { name?: string } | null)?.name ?? null
}

/**
 * Valida os args de uma CONFIRM_TOOL. Retorna o alvo legível (ok) ou um motivo de
 * bloqueio (não-ok). Tools sem validador estrito retornam { ok:true, target:null }.
 */
export async function validateConfirmArgs(
    admin: SupabaseClient,
    trainerId: string,
    toolName: string,
    args: Record<string, unknown>,
): Promise<ConfirmValidation> {
    try {
        switch (toolName) {
            case 'kinevo_create_contract': {
                const studentId = str(args.student_id)
                if (!studentId) return { ok: false, reason: 'Faltou indicar o aluno do contrato.' }
                const { data: st } = await admin
                    .from('students')
                    .select('name')
                    .eq('id', studentId)
                    .eq('coach_id', trainerId)
                    .maybeSingle()
                if (!st) return { ok: false, reason: 'Aluno não encontrado na sua carteira.' }

                const planId = str(args.plan_id)
                let planLabel = 'cortesia'
                if (planId) {
                    const { data: pl } = await admin
                        .from('trainer_plans')
                        .select('title, price, interval')
                        .eq('id', planId)
                        .eq('trainer_id', trainerId)
                        .maybeSingle()
                    if (!pl) return { ok: false, reason: 'Plano não encontrado nos seus planos.' }
                    const p = pl as { title: string; price: number; interval: string }
                    planLabel = `${p.title} — ${brl(p.price)}/${INTERVAL_PT[p.interval] ?? p.interval}`
                }
                const name = (st as { name: string }).name
                return { ok: true, target: { label: `${name} · ${planLabel}` } }
            }

            case 'kinevo_mark_payment_as_paid':
            case 'kinevo_cancel_contract': {
                const contractId = str(args.contract_id)
                if (!contractId) return { ok: false, reason: 'Faltou indicar o contrato.' }
                const { data: c } = await admin
                    .from('student_contracts')
                    .select('trainer_id, student_id, amount, status')
                    .eq('id', contractId)
                    .maybeSingle()
                const contract = c as
                    | { trainer_id: string; student_id: string; amount: number; status: string }
                    | null
                if (!contract || contract.trainer_id !== trainerId) {
                    return { ok: false, reason: 'Contrato não encontrado ou não é seu.' }
                }
                if (toolName === 'kinevo_cancel_contract' && contract.status === 'canceled') {
                    return { ok: false, reason: 'Esse contrato já está cancelado.' }
                }
                const name = (await studentName(admin, trainerId, contract.student_id)) ?? 'aluno'
                return {
                    ok: true,
                    target: { label: `${name} — ${brl(contract.amount)}`, details: { status: contract.status } },
                }
            }

            case 'kinevo_convert_lead': {
                const leadId = str(args.lead_id)
                if (!leadId) return { ok: false, reason: 'Faltou indicar o lead.' }
                const { data: l } = await admin
                    .from('trainer_leads')
                    .select('name, trainer_id, converted_to_student_id')
                    .eq('id', leadId)
                    .maybeSingle()
                const lead = l as
                    | { name: string; trainer_id: string; converted_to_student_id: string | null }
                    | null
                if (!lead || lead.trainer_id !== trainerId) {
                    return { ok: false, reason: 'Lead não encontrado ou não é seu.' }
                }
                if (lead.converted_to_student_id) {
                    return { ok: false, reason: `O lead ${lead.name} já foi convertido em aluno.` }
                }
                return { ok: true, target: { label: lead.name } }
            }

            case 'kinevo_delete_program': {
                const programId = str(args.program_id)
                if (!programId) return { ok: false, reason: 'Faltou indicar o programa.' }
                const { data: p } = await admin
                    .from('assigned_programs')
                    .select('name, status, trainer_id, student_id')
                    .eq('id', programId)
                    .maybeSingle()
                const prog = p as
                    | { name: string; status: string; trainer_id: string; student_id: string }
                    | null
                if (!prog || prog.trainer_id !== trainerId) {
                    return { ok: false, reason: 'Programa não encontrado ou não é seu.' }
                }
                // Só rascunhos: programa ativo se encerra com expirar (preserva histórico).
                if (prog.status !== 'draft') {
                    return {
                        ok: false,
                        reason: 'Só rascunhos podem ser excluídos. Para encerrar um programa ativo preservando o histórico, peça para expirar.',
                    }
                }
                const name = (await studentName(admin, trainerId, prog.student_id)) ?? 'aluno'
                return { ok: true, target: { label: `${prog.name} · rascunho de ${name}` } }
            }

            // Sem validador estrito (a tool já checa posse na execução): libera com
            // alvo genérico — o card mostra o resumo dos args como hoje.
            default:
                return { ok: true, target: null }
        }
    } catch (e) {
        // Guardrail quebrado NÃO pode travar ação legítima: fail-open.
        console.error('[validateConfirmArgs] erro (fail-open):', e)
        return { ok: true, target: null }
    }
}
