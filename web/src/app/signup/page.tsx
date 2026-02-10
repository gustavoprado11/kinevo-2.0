'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Sparkles } from 'lucide-react'

export default function SignupPage() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            return
        }

        setLoading(true)

        const supabase = createClient()

        // 1. Create auth user
        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
        })

        if (signUpError) {
            setError(signUpError.message)
            setLoading(false)
            return
        }

        if (!data.user) {
            setError('Erro ao criar conta. Tente novamente.')
            setLoading(false)
            return
        }

        // 2. Create trainer record
        const { error: trainerError } = await supabase.from('trainers').insert({
            auth_user_id: data.user.id,
            name,
            email,
        })

        if (trainerError) {
            setError('Erro ao configurar conta de treinador.')
            setLoading(false)
            return
        }

        // 3. Redirect to Stripe Checkout
        try {
            const res = await fetch('/api/stripe/checkout', { method: 'POST' })
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
        <div className="min-h-screen flex bg-slate-950">
            {/* Left Panel — Branding (Desktop only) */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-slate-900 flex-col justify-between p-12 overflow-hidden">
                {/* Subtle background texture */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(124,58,237,0.08),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.06),transparent_50%)]" />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo"
                        width={36}
                        height={36}
                        className="rounded-lg"
                    />
                    <span className="text-xl font-bold text-white tracking-tight">Kinevo</span>
                </div>

                {/* Tagline */}
                <div className="relative z-10 max-w-md">
                    <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
                        Junte-se à elite
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
                            dos treinadores.
                        </span>
                    </h2>
                    <p className="mt-4 text-slate-400 text-lg leading-relaxed">
                        Comece com 7 dias grátis. Sem compromisso, cancele quando quiser.
                    </p>
                </div>

                {/* Bottom decorative element */}
                <div className="relative z-10 flex items-center gap-2 text-slate-500 text-sm">
                    <Sparkles size={14} />
                    <span>Mais de 1.000 treinadores já transformaram suas consultorias</span>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Back button */}
                <div className="p-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        <span>Voltar</span>
                    </Link>
                </div>

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
                            <span className="text-xl font-bold text-white tracking-tight">Kinevo</span>
                        </div>

                        {/* Card */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold text-white">Crie sua conta</h1>
                                <p className="text-slate-400 mt-1.5">Comece a transformar sua consultoria hoje</p>
                            </div>

                            <form onSubmit={handleSignup} className="space-y-5">
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                                        Nome completo
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                                        placeholder="Seu nome"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                                        placeholder="seu@email.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                                        Senha
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                        Confirmar senha
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                                >
                                    {loading ? 'Criando conta...' : 'Criar conta e começar trial'}
                                </button>

                                <p className="text-center text-sm text-slate-500">
                                    7 dias grátis, depois R$ 39,90/mês
                                </p>
                            </form>
                        </div>

                        <p className="text-center text-sm text-slate-500 mt-6">
                            Já tem uma conta?{' '}
                            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                                Entrar
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
