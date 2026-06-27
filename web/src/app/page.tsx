import { FaqJsonLd } from '@/components/landing/faq-jsonld'
import { LandingV2 } from '@/components/landing/v2/landing-v2'

// Server Component: nova landing (port fiel do Claude Design — Landing Page.dc.html).
// O HTML da landing é renderizado no SSR (crawlers leem hero/recursos/comparativo/
// FAQ sem JS) + FAQ JSON-LD (faq-jsonld). Os PREÇOS e os DEVICE MOCKS (iPhone/Apple
// Watch realistas com telas fiéis ao app) são React portados para slots no cliente.
export default function Home() {
    return (
        <>
            <FaqJsonLd />
            <LandingV2 />
        </>
    )
}
