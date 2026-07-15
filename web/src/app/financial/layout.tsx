import { redirect } from 'next/navigation'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { isOrgBillingActive } from '@/lib/studio/org-access'

/**
 * Estúdios v1: o módulo Financeiro não existe para contas de estúdio (o estúdio
 * não cobra alunos individualmente por aqui). Enforcement server-side num ponto
 * só — cobre /financial e todas as subrotas, mesmo por link direto. Conta solo
 * (sem org ativa) passa intacta.
 */
export default async function FinancialLayout({ children }: { children: React.ReactNode }) {
    const ctx = await getOrganizationContext()
    if (ctx && isOrgBillingActive(ctx.organization.subscription_status, ctx.organization.grace_until)) {
        redirect('/dashboard')
    }
    return <>{children}</>
}
