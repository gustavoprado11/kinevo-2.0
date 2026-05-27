import { redirect } from 'next/navigation'

/**
 * /landing foi consolidado em /marketing/landing (hub Marketing).
 * Redirect mantido pra qualquer deep link antigo.
 */
export default function LegacyLandingRedirect() {
    redirect('/marketing/landing')
}
