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
    { loading: () => <div className="h-24" />, ssr: false }
)
const LandingProblem = dynamic(
    () => import('@/components/landing/landing-problem').then(mod => mod.LandingProblem),
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
const LandingPricing = dynamic(
    () => import('@/components/landing/landing-pricing').then(mod => mod.LandingPricing),
    { loading: () => <div className="h-96" />, ssr: false }
)
const LandingFaq = dynamic(
    () => import('@/components/landing/landing-faq').then(mod => mod.LandingFaq),
    { loading: () => <div className="h-48" />, ssr: false }
)
const LandingCtaFooter = dynamic(
    () => import('@/components/landing/landing-cta-footer').then(mod => mod.LandingCtaFooter),
    { loading: () => <div className="h-48" />, ssr: false }
)

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
