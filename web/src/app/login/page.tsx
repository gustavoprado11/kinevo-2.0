'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
            setError(error.message)
            setLoading(false)
            return
        }

        router.push('/dashboard')
        router.refresh()
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
                        A evolução da sua consultoria
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
                            começa aqui.
                        </span>
                    </h2>
                    <p className="mt-4 text-slate-400 text-lg leading-relaxed">
                        Gerencie treinos, acompanhe alunos e escale sua consultoria fitness com a plataforma feita por treinadores.
                    </p>
                </div>

                {/* Bottom decorative element */}
                <div className="relative z-10 flex items-center gap-2 text-slate-500 text-sm">
                    <Lock size={14} />
                    <span>Seus dados estão protegidos com criptografia de ponta a ponta</span>
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
                                <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
                                <p className="text-slate-400 mt-1.5">Entre na sua conta para continuar</p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-5">
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                                        {error}
                                    </div>
                                )}

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

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
                                >
                                    {loading ? 'Entrando...' : 'Entrar'}
                                </button>
                            </form>
                        </div>

                        <p className="text-center text-sm text-slate-500 mt-6">
                            Não tem uma conta?{' '}
                            <Link href="/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                                Criar conta
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
