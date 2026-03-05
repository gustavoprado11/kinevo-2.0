'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { translateAuthError } from '@/lib/translate-auth-error'
import { AuthLayout } from '@/components/auth/auth-layout'

function getPasswordStrength(password: string): { level: number; label: string } {
    if (password.length === 0) return { level: 0, label: '' }
    if (password.length < 6) return { level: 1, label: 'Fraca' }

    const hasUppercase = /[A-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSymbol = /[^A-Za-z0-9]/.test(password)
    const mixCount = [hasUppercase, hasNumber, hasSymbol].filter(Boolean).length

    if (password.length >= 10 && mixCount >= 2) return { level: 4, label: 'Forte' }
    if (password.length >= 8 && mixCount >= 1) return { level: 3, label: 'Boa' }
    return { level: 2, label: 'Razoável' }
}

const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']
const strengthTextColors = ['', 'text-red-600', 'text-amber-600', 'text-emerald-600', 'text-emerald-700']

export default function SignupPage() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const strength = useMemo(() => getPasswordStrength(password), [password])

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
            setError(translateAuthError(signUpError.message))
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
            console.error('Trainer insert error:', trainerError)
            setError(translateAuthError(trainerError.message))
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
        <AuthLayout
            tagline="Junte-se à elite"
            taglineAccent="dos treinadores."
            subtitle="Comece com 7 dias grátis. Sem compromisso, cancele quando quiser."
            bottomIcon={Sparkles}
            bottomText="Mais de 1.000 treinadores já transformaram suas consultorias"
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
                </div>

                <form onSubmit={handleSignup} className="space-y-5">
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/15"
                    >
                        {loading ? 'Criando conta...' : 'Criar conta e começar trial'}
                    </button>

                    <p className="text-center text-sm text-slate-400">
                        7 dias grátis, depois R$ 39,90/mês
                    </p>
                </form>
            </div>
        </AuthLayout>
    )
}
