'use client'

import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/auth-layout'
import { signupTrainer } from '@/actions/auth/signup-trainer'
import { paidTierFromParam, tierDisplay } from '@/lib/billing/tiers'

// Public Turnstile site key. When unset (operator hasn't enabled CAPTCHA
// yet), the widget block below is short-circuited and the server action
// also skips verification — see lib/auth/turnstile.ts.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: {
                sitekey: string
                callback?: (token: string) => void
                'expired-callback'?: () => void
                'error-callback'?: () => void
                theme?: 'light' | 'dark' | 'auto'
            }) => string
            reset: (widgetId?: string) => void
        }
    }
}

function getPasswordStrength(password: string): { level: number; label: string } {
    if (password.length === 0) return { level: 0, label: '' }
    if (password.length < 8) return { level: 1, label: 'Muito curta' }

    const hasUppercase = /[A-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSymbol = /[^A-Za-z0-9]/.test(password)
    const mixCount = [hasUppercase, hasNumber, hasSymbol].filter(Boolean).length

    if (password.length >= 12 && mixCount >= 2) return { level: 4, label: 'Forte' }
    if (password.length >= 10 && mixCount >= 1) return { level: 3, label: 'Boa' }
    return { level: 2, label: 'Razoável' }
}

const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']
const strengthTextColors = ['', 'text-red-600', 'text-amber-600', 'text-emerald-600', 'text-emerald-700']

export default function SignupPage() {
    return (
        <Suspense fallback={null}>
            <SignupPageInner />
        </Suspense>
    )
}

function SignupPageInner() {
    const searchParams = useSearchParams()
    const isFromMobile = searchParams?.get('ref') === 'mobile'
    // Tier escolhido na landing (?tier=essencial|pro_ia|premium_ia). Sem tier =
    // entrada Gratuita (sem checkout, sem cartão).
    const selectedTier = paidTierFromParam(searchParams?.get('tier'))
    const selectedPlan = selectedTier ? tierDisplay(selectedTier) : null
    // Intenção de estúdio (?intent=studio, CTA do StudioBanner da landing):
    // pós-cadastro vai direto pro fluxo de criação do estúdio (nome + faixa →
    // checkout por org), em vez do dashboard/checkout solo. Enum fixo — não é
    // um redirect arbitrário.
    const isStudioIntent = searchParams?.get('intent') === 'studio'
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    // Honeypot — invisible to users, automated form-fillers populate it.
    // The server action rejects the request when this is non-empty.
    const [honeypot, setHoneypot] = useState('')
    const [turnstileToken, setTurnstileToken] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
    const turnstileWidgetIdRef = useRef<string | null>(null)

    const strength = useMemo(() => getPasswordStrength(password), [password])

    // Render the Turnstile widget when the script has loaded and the site
    // key is configured. The widget calls back with a token we send to
    // the server action; on expiry/error we wipe the token so submission
    // is blocked until the user re-solves.
    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) return
        if (!turnstileContainerRef.current) return

        let cancelled = false
        const tryRender = () => {
            if (cancelled) return
            if (!window.turnstile) {
                // Script hasn't finished loading; retry shortly.
                setTimeout(tryRender, 200)
                return
            }
            if (turnstileWidgetIdRef.current) return
            const id = window.turnstile.render(turnstileContainerRef.current!, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: 'light',
                callback: (token: string) => setTurnstileToken(token),
                'expired-callback': () => setTurnstileToken(''),
                'error-callback': () => setTurnstileToken(''),
            })
            turnstileWidgetIdRef.current = id
        }
        tryRender()
        return () => { cancelled = true }
    }, [])

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        if (password.length < 8) {
            setError('A senha deve ter pelo menos 8 caracteres.')
            return
        }

        if (TURNSTILE_SITE_KEY && !turnstileToken) {
            setError('Aguarde a verificação anti-robô completar antes de continuar.')
            return
        }

        setLoading(true)

        // Step 1+2 — server action: rate limit, honeypot, Turnstile,
        // HIBP/common-password, blocklist, signUp, trainer insert. All in
        // one round-trip on the server.
        const result = await signupTrainer({ name, email, password, honeypot, turnstileToken })

        if (!result.success) {
            setError(result.error || 'Erro ao criar conta.')
            setLoading(false)
            // Reset captcha so the user can retry without reloading.
            if (window.turnstile && turnstileWidgetIdRef.current) {
                window.turnstile.reset(turnstileWidgetIdRef.current)
                setTurnstileToken('')
            }
            return
        }

        // Step 3 — destino pós-cadastro:
        //   - intenção de estúdio → fluxo de criação do estúdio (billing por org);
        //   - entrada Gratuita (sem ?tier=) → direto pro dashboard, SEM cartão. O
        //     treinador experimenta o produto e faz upgrade quando quiser (Caminho B);
        //   - tier pago escolhido na landing → Stripe Checkout daquele plano.
        if (isStudioIntent) {
            window.location.href = '/estudio/criar'
            return
        }
        if (!selectedTier) {
            window.location.href = '/dashboard'
            return
        }

        // The server action plumbed the auth session cookie back to the browser,
        // so this fetch is now authenticated and the API route will find the trainer.
        try {
            const checkoutUrl = isFromMobile
                ? '/api/stripe/checkout?source=mobile'
                : '/api/stripe/checkout'
            const res = await fetch(checkoutUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier: selectedTier }),
            })
            const json = await res.json()

            if (!res.ok || !json.url) {
                setError('Erro ao iniciar pagamento. Tente novamente.')
                setLoading(false)
                return
            }

            window.location.href = json.url
        } catch {
            setError('Erro de conexão. Tente novamente.')
            setLoading(false)
        }
    }

    return (
        <>
            {TURNSTILE_SITE_KEY && (
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    async
                    defer
                />
            )}
            <AuthLayout
            tagline="A ferramenta à altura"
            taglineAccent="do seu trabalho."
            subtitle="Sistema completo para prescrição, acompanhamento e pagamentos. Comece grátis."
            backHref="/"
            backLabel="Voltar"
            footer={
                <p className="text-center text-sm text-slate-500 mt-6">
                    Já tem uma conta?{' '}
                    <Link href="/login" className="text-violet-600 hover:text-violet-500 font-medium transition-colors">
                        Entrar
                    </Link>
                </p>
            }
        >
            <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-elevated">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Crie sua conta</h1>
                    <p className="text-slate-500 mt-1.5">Comece a transformar sua consultoria hoje</p>
                    {isStudioIntent ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
                            Kinevo Estúdios · você escolhe a faixa no próximo passo
                        </div>
                    ) : selectedPlan && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
                            Plano {selectedPlan.name} · {selectedPlan.price}
                            {selectedPlan.priceSuffix}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSignup} className="space-y-5">
                    {/* Honeypot — invisible to humans, auto-filled by naive bots.
                        Triple defense: visually hidden, aria-hidden so screen readers
                        skip it, and tabindex=-1 so keyboard users never land here.
                        Real users keep this empty; bots that fill every field get
                        rejected silently by the server action. */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                        <label htmlFor="kinevo_website_url">Website (não preencha)</label>
                        <input
                            id="kinevo_website_url"
                            name="kinevo_website_url"
                            type="text"
                            tabIndex={-1}
                            autoComplete="off"
                            value={honeypot}
                            onChange={(e) => setHoneypot(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                            Nome completo
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                            Senha
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                            placeholder="••••••••"
                        />
                        {/* Password strength indicator */}
                        {password.length > 0 && (
                            <div className="mt-2.5">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div
                                            key={i}
                                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                i <= strength.level
                                                    ? strengthColors[strength.level]
                                                    : 'bg-slate-200'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <p className={`text-xs mt-1 font-medium ${strengthTextColors[strength.level]}`}>
                                    {strength.label}
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                            Confirmar senha
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                            placeholder="••••••••"
                        />
                    </div>

                    {/* Turnstile widget mounts here. When NEXT_PUBLIC_TURNSTILE_SITE_KEY
                        is unset (current state), this stays empty and the form behaves
                        as before — see useEffect above + lib/auth/turnstile.ts. */}
                    {TURNSTILE_SITE_KEY && (
                        <div ref={turnstileContainerRef} className="flex justify-center" />
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/15"
                    >
                        {loading
                            ? 'Criando conta...'
                            : isStudioIntent
                              ? 'Criar conta e montar o estúdio'
                              : selectedTier
                                ? 'Criar conta e assinar'
                                : 'Criar conta grátis'}
                    </button>

                    <p className="text-center text-sm text-slate-400">
                        {isStudioIntent
                            ? 'A partir de R$ 219,90/mês · cancele quando quiser'
                            : selectedPlan
                              ? `${selectedPlan.price}${selectedPlan.priceSuffix ?? ''} · cancele quando quiser`
                              : 'Plano Gratuito — sem cartão. Faça upgrade quando quiser.'}
                    </p>
                </form>
            </div>
        </AuthLayout>
        </>
    )
}
