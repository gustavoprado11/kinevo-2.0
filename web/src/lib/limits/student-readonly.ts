/**
 * Estado "gestão de alunos travada" (read-only) — Fase 1, Trilha 3.
 *
 * Decisão Gustavo (§5.x da SPEC): "para usar com alunos, precisa pagar".
 *   - Trial expirado / sem plano pago → o treinador cai no FREE e ENTRA (limitado),
 *     em vez de bater no hard-block (/subscription/blocked). Quem fez isso é o
 *     `get-trainer.ts` + a resolução de tier (`getAiTier`).
 *   - PORÉM: um pagante que tinha alunos e caiu para o Free (assinatura caducou)
 *     NÃO pode mais operar a base de alunos. Os dados NÃO são apagados — a gestão
 *     de alunos entra em estado READ-ONLY até voltar a um plano pago.
 *
 * Este helper cobre o estado read-only para EDIÇÃO/operação dos alunos já
 * existentes. O bloqueio de CRIAÇÃO de novos alunos já é feito pelo
 * `student-cap.ts` do F0 (`assertCanCreateStudent`).
 *
 * Regra: free com > 1 aluno (mais que o self-student permitido) → travado.
 * Free com 0 ou 1 aluno ainda pode operar normalmente (é o self-student de teste).
 */

import type { AiTier } from '@/lib/auth/get-ai-tier'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { STUDENT_CAP } from '@/lib/limits/student-cap'
import { hasOrgCoreAccess } from '@/lib/studio/org-access'

/** Mensagem de erro padrão para as server-actions de mutação de aluno (read-only). */
export const STUDENT_MANAGEMENT_LOCKED_ERROR =
    'Sua assinatura terminou. Reative um plano para editar e operar seus alunos.'

/**
 * True quando a gestão de alunos deve ficar read-only: o treinador resolveu
 * para o tier Free mas tem mais alunos do que o cap do Free permite (ou seja,
 * é um ex-pagante com alunos reais que perdeu o plano).
 */
export function isStudentManagementLocked(
    tier: AiTier,
    studentCount: number,
): boolean {
    if (tier !== 'free') return false
    return studentCount > STUDENT_CAP.free
}

/** Mensagem amigável para o banner/estado travado. */
export function studentManagementLockedMessage(studentCount: number): string {
    return `Sua assinatura terminou e você tem ${studentCount} aluno(s) cadastrados. ` +
        'Eles continuam salvos, mas a gestão de alunos fica somente leitura até você ' +
        'reativar um plano. Reative para voltar a editar, prescrever e operar seus alunos.'
}

/**
 * Enforcement server-side do estado read-only. Resolve o tier e conta os alunos
 * com o admin client (independe do client do chamador) e devolve true quando a
 * gestão de alunos está travada. As server-actions de MUTAÇÃO de aluno chamam isto
 * logo após resolver o trainerId e, se true, recusam com `STUDENT_MANAGEMENT_LOCKED_ERROR`.
 * Tenant-isolado por trainerId. Para pagante (tier != free) retorna false na 1ª query.
 */
export async function isStudentManagementLockedForTrainer(trainerId: string): Promise<boolean> {
    // Import lazy: `supabase-admin` lança no load se a service key faltar (ambiente
    // de teste). Carregar só em runtime mantém get-trainter→student-readonly testável.
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    // Coach de estúdio ativo nunca fica read-only (acesso herdado ao núcleo).
    if (await hasOrgCoreAccess(supabaseAdmin, trainerId)) return false
    const tier = await getAiTierForTrainer(supabaseAdmin, trainerId)
    if (tier !== 'free') return false
    const { count } = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', trainerId)
    return isStudentManagementLocked(tier, count ?? 0)
}
