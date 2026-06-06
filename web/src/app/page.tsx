import { Navbar } from '@/components/landing/navbar'
import { LandingHero } from '@/components/landing/landing-hero'
import { FaqJsonLd } from '@/components/landing/faq-jsonld'
import { LandingSocialProof } from '@/components/landing/landing-social-proof'
import { LandingProblem } from '@/components/landing/landing-problem'
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works'
import { LandingPillars } from '@/components/landing/landing-pillars'
import { LandingSalaDeTreino } from '@/components/landing/landing-sala-de-treino'
import { LandingParaAluno } from '@/components/landing/landing-para-aluno'
import { LandingAiAssistant } from '@/components/landing/landing-ai-assistant'
import { LandingTestimonials } from '@/components/landing/landing-testimonials'
import { LandingPricing } from '@/components/landing/landing-pricing'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingCtaFooter } from '@/components/landing/landing-cta-footer'

// Server Component: todas as seções são renderizadas no HTML inicial (SSR) para
// que crawlers de busca e de IA (GPTBot, ClaudeBot, PerplexityBot, Googlebot)
// leiam preço, diferenciais, comparativo e FAQ sem depender de JavaScript.
// As seções continuam sendo Client Components individualmente (animações,
// abas, demos), mas o Next.js as renderiza no servidor e hidrata no cliente.
export default function Home() {
    return (
        <div className="min-h-screen bg-white selection:bg-[#7C3AED]/15 selection:text-[#7C3AED]">
            <FaqJsonLd />
            <Navbar />

            <main>
                <LandingHero />
                <LandingSocialProof />
                <LandingProblem />
                <div id="como-funciona">
                    <LandingHowItWorks />
                    <LandingPillars />
                </div>
                <LandingSalaDeTreino />
                <LandingParaAluno />
                <div id="assistente-ia">
                    <LandingAiAssistant />
                </div>
                <LandingTestimonials />
                <div id="precos">
                    <LandingPricing />
                </div>
                <div id="faq">
                    <LandingFaq />
                </div>
            </main>

            <LandingCtaFooter />
        </div>
    )
}
