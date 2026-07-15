import { redirect } from 'next/navigation'
import { getOrganizationContext, type OrganizationContext } from '@/lib/studio/get-organization'
import { isOrgBillingActive } from '@/lib/studio/org-access'

/**
 * Guard das páginas /estudio: exige gestor (owner/admin) de uma org com billing
 * ativo. Coach comum → /dashboard; org bloqueada → /estudio/blocked; solo → /dashboard.
 * Retorna o contexto para a página não re-buscar.
 */
export async function requireManagerContext(): Promise<OrganizationContext> {
    const ctx = await getOrganizationContext()
    if (!ctx) redirect('/dashboard')
    if (!ctx.isManager) redirect('/dashboard')
    if (!isOrgBillingActive(ctx.organization.subscription_status, ctx.organization.grace_until)) {
        redirect('/estudio/blocked')
    }
    return ctx
}
