/**
 * LandingV2 — nova landing (port fiel do Claude Design "Landing Page.dc.html").
 *
 * Server Component: o HTML do design (corrigido no build — fidelidade dos mocks +
 * promessa condizente) é renderizado no SSR. O bloco de PREÇOS é um slot onde o
 * cliente faz portal de <PricingV2/> (fonte única = TIER_DISPLAY). Estilos via CSS
 * escopado `.kvlp`; ícones SVG inline (CSP). Interatividade + animações no
 * LandingV2Client. Conteúdo gerado por scratchpad/build-landing.mjs.
 */
import './landing-v2.css'
import { LANDING_HTML } from './landing-content'
import { LandingV2Client } from './landing-v2-client'

export function LandingV2() {
    return (
        <>
            <div id="kvlp-root" className="kvlp" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
            <LandingV2Client rootId="kvlp-root" />
        </>
    )
}
