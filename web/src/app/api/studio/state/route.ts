import { NextResponse } from 'next/server'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { isOrgBillingActive } from '@/lib/studio/org-access'

export const dynamic = 'force-dynamic'

/**
 * Estado de estúdio da casca do app (Sidebar/AppLayout via useStudioState):
 * - isStudioAccount: membro de org com billing ativo → esconde Financeiro.
 * - isManager: owner/admin → mostra o item "Estúdio".
 * Nunca lança: erro degrada para conta solo (isStudioAccount=false).
 */
export async function GET() {
    try {
        const ctx = await getOrganizationContext()
        if (!ctx || !isOrgBillingActive(ctx.organization.subscription_status, ctx.organization.grace_until)) {
            return NextResponse.json({ isStudioAccount: false, isManager: false })
        }
        return NextResponse.json({ isStudioAccount: true, isManager: ctx.isManager })
    } catch {
        return NextResponse.json({ isStudioAccount: false, isManager: false })
    }
}
