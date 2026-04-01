'use client'

import dynamic from 'next/dynamic'

// Navbar keeps SSR enabled — it contains critical navigation links (/login, /signup,
// anchor hrefs) that must be present in the initial HTML for SEO and usability.
const Navbar = dynamic(
    () => import('@/components/landing/navbar').then(mod => mod.Navbar),
    { loading: () => <div className="h-16" /> }
)

// Below-the-fold sections use ssr: false to keep framer-motion (~40KB gzipped)
// out of the initial bundle, improving FCP and LCP.
const LandingHero = dynamic(
    () => import('@/components/landing/landing-hero').then(mod => mod.LandingHero),
    { loading: () => <div className="min-h-screen" />, ssr: false }
)
const LandingSocialProof = dynamic(
    () => import('@/components/landing/landing-social-proof').then(mod => mod.LandingSocialProof),
    { loading: () => <div className="h-16" />, ssr: false }
)
const LandingProblem = dynamic(
    () => import('@/components/landing/landing-problem').then(mod => mod.LandingProblem),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingHowItWorks = dynamic(
    () => import('@/components/landing/landing-how-it-works').then(mod => mod.LandingHowItWorks),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingPillars = dynamic(
    () => import('@/components/landing/landing-pillars').then(mod => mod.LandingPillars),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingStudentApp = dynamic(
    () => import('@/components/landing/landing-student-app').then(mod => mod.LandingStudentApp),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingTestimonials = dynamic(
    () => import('@/components/landing/landing-testimonials').then(mod => mod.LandingTestimonials),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingPricing = dynamic(
    () => import('@/components/landing/landing-pricing').then(mod => mod.LandingPricing),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingFaq = dynamic(
    () => import('@/components/landing/landing-faq').then(mod => mod.LandingFaq),
    { loading: () => <div className="h-48" />, ssr: false }
)
const LandingAiAssistant = dynamic(
    () => import('@/components/landing/landing-ai-assistant').then(mod => mod.LandingAiAssistant),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingCtaFooter = dynamic(
    () => import('@/components/landing/landing-cta-footer').then(mod => mod.LandingCtaFooter),
    { loading: () => <div className="h-48" />, ssr: false }
)

export default function Home() {
    return (
        <div className="min-h-screen bg-white selection:bg-[#7C3AED]/15 selection:text-[#7C3AED]">
            <Navbar />

            <main>
                <LandingHero />
                <LandingSocialProof />
                <LandingProblem />
                <div id="assistente-ia">
                    <LandingAiAssistant />
                </div>
                <div id="como-funciona">
                    <LandingHowItWorks />
                    <LandingPillars />
                </div>
                <div id="app-aluno">
                    <LandingStudentApp />
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
