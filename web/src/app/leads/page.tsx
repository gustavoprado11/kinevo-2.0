import { redirect } from 'next/navigation'

/**
 * /leads foi consolidado em /marketing/leads (hub Marketing).
 * Mantemos o redirect porque push notifications enviadas antes da migração
 * apontam pra /leads — não podemos quebrar deep links já entregues.
 */
export default function LegacyLeadsRedirect() {
    redirect('/marketing/leads')
}
