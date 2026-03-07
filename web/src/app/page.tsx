import { Navbar } from '@/components/landing/navbar'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingTrainers } from '@/components/landing/landing-trainers'
import { LandingStudents } from '@/components/landing/landing-students'
import { LandingPricing } from '@/components/landing/landing-pricing'
import { LandingCtaFooter } from '@/components/landing/landing-cta-footer'

export default function Home() {
    return (
        <div className="min-h-screen bg-white selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
            <Navbar />

            <main>
                <LandingHero />
                <div id="treinadores">
                    <LandingTrainers />
                </div>
                <div id="alunos">
                    <LandingStudents />
                </div>
                <div id="precos">
                    <LandingPricing />
                </div>
            </main>

            <LandingCtaFooter />
        </div>
    )
}
