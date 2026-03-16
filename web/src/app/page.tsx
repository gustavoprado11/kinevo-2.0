import { Navbar } from '@/components/landing/navbar'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingSocialProof } from '@/components/landing/landing-social-proof'
import { LandingProblem } from '@/components/landing/landing-problem'
import { LandingPillars } from '@/components/landing/landing-pillars'
import { LandingStudentApp } from '@/components/landing/landing-student-app'
import { LandingPricing } from '@/components/landing/landing-pricing'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingCtaFooter } from '@/components/landing/landing-cta-footer'

export default function Home() {
    return (
        <div className="min-h-screen bg-white selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
            <Navbar />

            <main>
                <LandingHero />
                <LandingSocialProof />
                <LandingProblem />
                <div id="como-funciona">
                    <LandingPillars />
                </div>
                <div id="app-aluno">
                    <LandingStudentApp />
                </div>
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
