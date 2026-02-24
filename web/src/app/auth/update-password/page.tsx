'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Lock, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/translate-auth-error'

export default function UpdatePasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            return
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setLoading(true)
        const supabase = createClient()

        const { error } = await supabase.auth.updateUser({
            password: password
        })

        if (error) {
            setError(translateAuthError(error.message))
            setLoading(false)
            return
        }

        // Successfully updated password
        setSuccess(true)
        setLoading(false)

        // Clear session so they have to login with new credentials (optional but secure)
        await supabase.auth.signOut()
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Panel — Branding (Desktop only) */}
            <div className="hidden lg:flex lg:w-[45%] relative bg-[#F9F9FB] flex-col justify-between p-12 overflow-hidden">
                {/* Subtle background accents */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(124,58,237,0.04),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(124,58,237,0.03),transparent_50%)]" />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo"
                        width={36}
                        height={36}
                        className="rounded-lg"
                    />
                    <span className="text-xl font-bold text-slate-900 tracking-tight">Kinevo</span>
                </div>

                {/* Tagline */}
                <div className="relative z-10 max-w-md">
                    <h2 className="text-4xl font-extrabold text-slate-900 leading-tight tracking-tighter">
                        A evolução da sua consultoria
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                            começa aqui.
                        </span>
                    </h2>
                    <p className="mt-4 text-slate-500 text-lg leading-relaxed">
                        Gerencie treinos, acompanhe alunos e escale sua consultoria fitness com a plataforma feita por treinadores.
                    </p>
                </div>

                {/* Bottom decorative element */}
                <div className="relative z-10 flex items-center gap-2 text-slate-400 text-sm">
                    <Lock size={14} />
                    <span>Seus dados estão protegidos com criptografia de ponta a ponta</span>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Form container */}
                <div className="flex-1 flex items-center justify-center px-6 pb-12 pt-12 lg:pt-0">
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
                            <span className="text-xl font-bold text-slate-900 tracking-tight">Kinevo</span>
                        </div>

                        {/* Card */}
                        <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-card">
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold text-slate-900">Redefinir Senha</h1>
                                <p className="text-slate-500 mt-1.5 leading-relaxed">
                                    Crie uma nova senha para acessar sua conta.
                                </p>
                            </div>

                            {success ? (
                                <div className="space-y-6">
                                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-emerald-800">Senha atualizada!</h3>
                                            <p className="text-emerald-600 text-sm mt-1">
                                                Sua nova senha foi salva com sucesso. Você pode voltar a acessar o Kinevo.
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/login"
                                        className="w-full py-3 px-4 flex justify-center bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/15"
                                    >
                                        Ir para o Login
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdatePassword} className="space-y-5">
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                                            Nova Senha
                                        </label>
                                        <input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                                            Confirmar Nova Senha
                                        </label>
                                        <input
                                            id="confirmPassword"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all"
                                            placeholder="Repita a senha"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !password || !confirmPassword}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/15"
                                    >
                                        {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
