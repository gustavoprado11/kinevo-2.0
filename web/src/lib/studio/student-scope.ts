import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { getOrganizationContext } from './get-organization'
import { isOrgBillingActive } from './org-access'

type DBClient = SupabaseClient<Database>

/**
 * Estúdios v1 — escopo de alunos do ator.
 *
 * O choke point de APLICAÇÃO para "quais alunos este treinador pode ver/editar":
 * - solo: os alunos dele (students.coach_id = trainerId) — comportamento de sempre.
 * - org:  TODOS os alunos do estúdio (students.organization_id = orgId), além dos
 *         próprios por coach_id (cobre aluno criado antes do backfill de org_id).
 *
 * Org com billing bloqueado degrada para 'solo' — mesmo critério do
 * hasOrgCoreAccess (isOrgBillingActive), para os gates nunca divergirem.
 */
export type StudentScope =
    | { kind: 'solo'; trainerId: string }
    | { kind: 'org'; trainerId: string; orgId: string; isManager: boolean }

export async function getStudentScope(trainerId: string): Promise<StudentScope> {
    const solo: StudentScope = { kind: 'solo', trainerId }
    // Never-throw: falha de infra na resolução de org não pode derrubar a action —
    // sem confirmação de org ativa, o ator opera como solo (menor privilégio).
    try {
        const ctx = await getOrganizationContext()
        if (!ctx) return solo
        // Defesa: o contexto vem da SESSÃO; se o chamador passou outro trainerId,
        // não herdamos a org da sessão para ele.
        if (ctx.trainerId !== trainerId) return solo
        if (!isOrgBillingActive(ctx.organization.subscription_status, ctx.organization.grace_until)) {
            return solo
        }
        return {
            kind: 'org',
            trainerId,
            orgId: ctx.organization.id,
            isManager: ctx.isManager,
        }
    } catch (err) {
        console.error('[getStudentScope] resolução de org falhou — degradando para solo:', err)
        return solo
    }
}

/** Linha mínima do aluno devolvida pelo guard — o que as actions precisam p/ decidir. */
export interface AccessibleStudent {
    id: string
    coach_id: string | null
    organization_id: string | null
}

/**
 * Guard central das server actions (substitui os `student.coach_id !== trainer.id`
 * espalhados): devolve a linha do aluno se o escopo alcança, senão null.
 * Usar com o client ADMIN nas actions (RLS não roda) — a autorização é esta função.
 */
export async function assertStudentAccess(
    client: DBClient,
    scope: StudentScope,
    studentId: string,
): Promise<AccessibleStudent | null> {
    const { data, error } = await client
        .from('students')
        .select('id, coach_id, organization_id')
        .eq('id', studentId)
        .maybeSingle()
    if (error || !data) return null

    const student = data as AccessibleStudent
    if (student.coach_id === scope.trainerId) return student
    if (scope.kind === 'org' && student.organization_id === scope.orgId) return student
    return null
}

/**
 * IDs de alunos visíveis pelo escopo — para superfícies agregadas que hoje usam
 * admin client com filtro escalar por trainer_id (ex.: dashboards, lotes).
 */
export async function getVisibleStudentIds(
    client: DBClient,
    scope: StudentScope,
    opts: { activeOnly?: boolean } = {},
): Promise<string[]> {
    let query = client.from('students').select('id')
    query =
        scope.kind === 'org'
            ? query.or(`organization_id.eq.${scope.orgId},coach_id.eq.${scope.trainerId}`)
            : query.eq('coach_id', scope.trainerId)
    if (opts.activeOnly) query = query.eq('status', 'active')

    const { data, error } = await query
    if (error || !data) return []
    return (data as Array<{ id: string }>).map((r) => r.id)
}
