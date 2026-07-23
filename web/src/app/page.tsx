import { LandingV2 } from '@/components/landing/v2/landing-v2'

// Server Component: nova landing (port fiel do Claude Design — Kinevo.dc.html).
// O HTML da landing é renderizado no SSR (crawlers leem hero/recursos/planos sem
// JS). Os visuais do hero (dashboard + celular do Assistente) e os PREÇOS são
// React portados para slots no cliente (fonte única = TIER_DISPLAY/STUDIO_TIERS).
// Sem FAQ nesta versão do design → FAQ JSON-LD removido (schema tem que casar com
// o conteúdo visível; ver faqs-data.ts/faq-jsonld.tsx se a seção voltar).
export default function Home() {
    return <LandingV2 />
}
