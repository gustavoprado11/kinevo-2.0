import type { Metadata } from 'next'
import { AndroidTesterForm } from './android-tester-form'

export const metadata: Metadata = {
    title: 'Kinevo — Acesso Antecipado Android',
    description: 'Cadastre seu e-mail Google para receber acesso antecipado ao app Kinevo para Android.',
    openGraph: {
        title: 'Kinevo — Acesso Antecipado Android',
        description: 'O Kinevo para Android está em fase de testes. Cadastre seu e-mail para receber o acesso.',
        type: 'website',
        url: 'https://kinevoapp.com/android',
    },
}

export default function AndroidPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0F0A1A] via-[#1A1035] to-[#0D0D17] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] mb-4 shadow-[0_0_40px_rgba(124,58,237,0.3)]">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
                            <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24C14.86 8.35 13.02 8.05 12 8.05c-1.02 0-2.86.3-4.47.86L5.66 5.67c-.18-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25 0-.69.56-1.25 1.25-1.25.69 0 1.25.56 1.25 1.25 0 .69-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25 0-.69.56-1.25 1.25-1.25.69 0 1.25.56 1.25 1.25 0 .69-.56 1.25-1.25 1.25z" fill="currentColor"/>
                        </svg>
                    </div>
                    <h1 className="font-jakarta text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Acesso Antecipado
                    </h1>
                    <p className="text-[#94a3b8] mt-2 text-sm sm:text-base leading-relaxed max-w-sm mx-auto">
                        O Kinevo para Android está em fase de testes.
                        Cadastre seu e-mail do Google para receber o acesso.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-[#1A1A2E]/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/5 shadow-2xl">
                    <AndroidTesterForm />
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-[#475569] mt-8">
                    Ao se cadastrar, você concorda com nossos{' '}
                    <a href="/terms" className="underline hover:text-[#94a3b8] transition-colors">Termos de Uso</a>
                    {' '}e{' '}
                    <a href="/privacy" className="underline hover:text-[#94a3b8] transition-colors">Política de Privacidade</a>.
                </p>
            </div>
        </div>
    )
}
