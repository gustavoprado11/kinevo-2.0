/**
 * Limite de alunos por tier de IA (Fase 0 — IA do Treinador).
 *
 * Decisão fechada (Gustavo, §11 da SPEC):
 *   - Gratuito = 1 aluno (o próprio treinador, "aluno-teste"); o 2º exige plano pago.
 *   - Pago (essencial/pro/premium) = ilimitado.
 *
 * Enforçado ANTES do insert em todos os caminhos que criam aluno:
 *   - `createStudentCore` (cobre a action `createStudent` E `convertLeadToStudentCore`);
 *   - a tool MCP `kinevo_create_student` (lógica própria, não usa o core).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import type { AiTier } from '@/lib/auth/get-ai-tier'
import { hasOrgCoreAccess, getActiveBillingOrg } from '@/lib/studio/org-access'
import { studioLimitForOrg } from '@/lib/studio/studio-tiers'

export const STUDENT_CAP: Record<AiTier, number> = {
    free: 1,
    essencial: Infinity,
    pro_ia: Infinity,
    premium_ia: Infinity,
}

/** Erro de limite atingido — mensagem amigável pronta para exibir ao treinador. */
export class StudentCapError extends Error {
    readonly code = 'student_cap_reached'
    constructor(message: string) {
        super(message)
        this.name = 'StudentCapError'
    }
}

function capMessage(cap: number): string {
    if (cap === 1) {
        return 'O plano Gratuito permite apenas 1 aluno (você mesmo, como aluno-teste). Assine um plano para adicionar mais alunos.'
    }
    return `Você atingiu o limite de ${cap} aluno(s) do seu plano. Faça upgrade para adicionar mais.`
}

type DBClient = SupabaseClient<Database>

/** Mensagem do gate de aluno particular (coach de estúdio sem plano solo pago). */
export const PRIVATE_STUDENT_REQUIRES_PLAN_ERROR =
    'Alunos particulares exigem um plano pessoal pago ativo. Assine um plano em Configurações → Assinatura para atender sua carteira própria.'

/**
 * Lança StudentCapError se a criação de mais um aluno ultrapassar o cap do tier.
 * No-op para tiers ilimitados. Conta `students` por `coach_id` (o self-student
 * conta como 1, então no Free o 2º aluno é bloqueado).
 *
 * `opts.isPrivate` (Estúdios, decisão 16/jul): aluno PARTICULAR de coach de
 * estúdio exige plano solo PAGO do próprio coach (qualquer pago = ilimitado;
 * Gratuito NÃO vale — o coach já tem o núcleo pago pelo estúdio, a carteira
 * própria é privilégio do plano pessoal). Para treinador solo o flag é inócuo
 * (todos os alunos dele já são "particulares" por natureza).
 */
export async function assertCanCreateStudent(
    admin: DBClient,
    trainerId: string,
    tier: AiTier,
    opts?: { isPrivate?: boolean },
): Promise<void> {
    // Estúdio: o cap é da ORG e deriva da faixa (plan_tier), contando alunos por
    // organization_id (soma de todos os coaches). Org sem plan_tier (manual/comp)
    // → ilimitado. Isso substitui o antigo "coach de org ativa = ilimitado".
    const org = await getActiveBillingOrg(admin, trainerId)
    if (org && opts?.isPrivate) {
        // Aluno particular: sai do eixo da org — o gate é o plano PESSOAL.
        if (tier === 'free') {
            throw new StudentCapError(PRIVATE_STUDENT_REQUIRES_PLAN_ERROR)
        }
        return // qualquer plano pago = particulares ilimitados
    }
    if (org) {
        const limit = studioLimitForOrg(org.plan_tier)
        if (!Number.isFinite(limit)) return
        const { count, error } = await admin
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_trainer_profile', false)
        if (error) {
            console.error('[assertCanCreateStudent] org count error:', error)
            return
        }
        if ((count ?? 0) >= limit) {
            throw new StudentCapError(
                `O estúdio atingiu o limite de ${limit} alunos da faixa atual. Faça upgrade para a próxima faixa em Estúdio → Plano.`,
            )
        }
        return
    }

    const cap = STUDENT_CAP[tier]
    if (!Number.isFinite(cap)) return

    const { count, error } = await admin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', trainerId)

    if (error) {
        // Falha ao contar: não bloquear silenciosamente uma criação legítima por
        // erro de infra. Loga e segue (o cap é gate de produto, não de segurança).
        console.error('[assertCanCreateStudent] count error:', error)
        return
    }

    if ((count ?? 0) >= cap) {
        throw new StudentCapError(capMessage(cap))
    }
}

/** Erro de downgrade bloqueado (treinador com alunos tentando voltar ao Free). */
export class StudentDowngradeError extends Error {
    readonly code = 'downgrade_blocked'
    constructor(message: string) {
        super(message)
        this.name = 'StudentDowngradeError'
    }
}

/**
 * Bloqueia o downgrade para o plano Gratuito quando o treinador tem aluno real
 * (mais que o self-student permitido). Decisão Gustavo §4: "para usar com alunos,
 * precisa pagar". Não apaga nada — apenas recusa a mudança de plano.
 */
export async function assertCanDowngradeToFree(
    admin: DBClient,
    trainerId: string,
): Promise<void> {
    // Acesso herdado do estúdio: coach de org ativa nunca é bloqueado aqui.
    if (await hasOrgCoreAccess(admin, trainerId)) return
    const { count, error } = await admin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', trainerId)

    if (error) {
        console.error('[assertCanDowngradeToFree] count error:', error)
        return
    }

    const n = count ?? 0
    if (n > STUDENT_CAP.free) {
        throw new StudentDowngradeError(
            `Você tem ${n} alunos — para voltar ao plano Gratuito, remova-os ou mantenha um plano ativo.`,
        )
    }
}
