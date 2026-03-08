import { type ReactNode } from 'react'
import { type LucideIcon, Lock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface AuthLayoutProps {
    children: ReactNode
    tagline: string
    taglineAccent: string
    subtitle: string
    bottomIcon?: LucideIcon
    bottomText?: string
    /** Set to null to hide the back button. Defaults to '/' */
    backHref?: string | null
    backLabel?: string
    /** Extra content below the form card (e.g. "Already have an account?" link) */
    footer?: ReactNode
}

export function AuthLayout({
    children,
    tagline,
    taglineAccent,
    subtitle,
    bottomIcon: BottomIcon = Lock,
    bottomText = 'Seus dados estão protegidos com criptografia de ponta a ponta',
    backHref = '/',
    backLabel = 'Voltar',
    footer,
}: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Panel — Branding (Desktop only) */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-slate-50 via-violet-50/40 to-slate-50 flex-col justify-between p-12 overflow-hidden">
                {/* Background accents */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(124,58,237,0.07),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(124,58,237,0.05),transparent_50%)]" />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo"
                        width={40}
                        height={40}
                        className="rounded-xl"
                    />
                    <span className="font-jakarta text-2xl font-bold text-slate-900 tracking-tight">Kinevo</span>
                </div>

                {/* Center content: Tagline + Product mockup */}
                <div className="relative z-10 flex flex-col gap-8">
                    <div className="max-w-md">
                        <h2 className="font-jakarta text-4xl font-extrabold text-slate-900 leading-tight tracking-tighter">
                            {tagline}
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                                {taglineAccent}
                            </span>
                        </h2>
                        <p className="font-jakarta mt-4 text-slate-500 text-lg leading-relaxed">
                            {subtitle}
                        </p>
                    </div>

                    {/* Product mockup */}
                    <div className="relative w-full max-w-md">
                        <Image
                            src="/719shots_so.png"
                            alt="Kinevo Dashboard"
                            width={1920}
                            height={1080}
                            className="w-full h-auto drop-shadow-2xl"
                            priority
                        />
                    </div>
                </div>

                {/* Bottom badge */}
                <div className="relative z-10 flex items-center gap-2 text-slate-400 text-sm font-jakarta">
                    <BottomIcon size={14} />
                    <span>{bottomText}</span>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Back button */}
                {backHref && (
                    <div className="p-6">
                        <Link
                            href={backHref}
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" />
                                <path d="M19 12H5" />
                            </svg>
                            <span>{backLabel}</span>
                        </Link>
                    </div>
                )}

                {/* Form container */}
                <div className="flex-1 flex items-center justify-center px-6 pb-12">
                    <div className="w-full max-w-md">
                        {/* Mobile logo */}
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
                            <Image
                                src="/logo-icon.png"
                                alt="Kinevo"
                                width={32}
                                height={32}
                                className="rounded-lg"
                            />
                            <span className="font-jakarta text-xl font-bold text-slate-900 tracking-tight">Kinevo</span>
                        </div>

                        {/* Form card */}
                        {children}

                        {/* Footer (e.g. "Already have an account?") */}
                        {footer}

                        {/* Security badge */}
                        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mt-6">
                            <Lock size={12} />
                            <span>Seus dados estão protegidos com criptografia de ponta a ponta</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
