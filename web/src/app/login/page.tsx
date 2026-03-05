'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/translate-auth-error'
import { AuthLayout } from '@/components/auth/auth-layout'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const supabase = createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(translateAuthError(error.message))
            setLoading(false)
            return
        }

        router.push('/dashboard')
        router.refresh()
    }

    return (
        <AuthLayout
            tagline="A evolução da sua consultoria"
            taglineAccent="começa aqui."
            subtitle="Gerencie treinos, acompanhe alunos e escale sua consultoria fitness com a plataforma feita por treinadores."
            bottomIcon={Sparkles}
            bottomText="Mais de 1.000 treinadores já transformaram suas consultorias"
            backHref="/"
            backLabel="Voltar"
            footer={
                <p className="text-center text-sm text-slate-500 mt-6">
                    Não tem uma conta?{' '}
                    <Link href="/signup" className="text-violet-600 hover:text-violet-500 font-medium transition-colors">
                        Criar conta
                    </Link>
                </p>
            }
        >
            <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-elevated">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Bem-vindo de volta</h1>
                    <p className="text-slate-500 mt-1.5">Entre na sua conta para continuar</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

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
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                                Senha
                            </label>
                            <Link href="/auth/forgot-password" className="text-sm text-violet-600 hover:text-violet-500 font-medium transition-colors">
                                Esqueceu a senha?
                            </Link>
                        </div>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </AuthLayout>
    )
}
