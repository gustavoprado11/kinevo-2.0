'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/translate-auth-error'
import { checkTrainerEmail } from './actions/check-trainer-email'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)
        setLoading(true)

        const supabase = createClient()

        // 1. Check if the email exists in the trainers table securely via Server Action
        const { exists } = await checkTrainerEmail(email)

        if (!exists) {
            setError('Nenhum treinador encontrado com este e-mail.')
            setLoading(false)
            return
        }

        // 2. We can now safely send the email
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/update-password`,
        })

        if (error) {
            setError(translateAuthError(error.message))
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)
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
                {/* Back button */}
                <div className="p-6">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        <span>Voltar para o Login</span>
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
                            <span className="text-xl font-bold text-slate-900 tracking-tight">Kinevo</span>
                        </div>

                        {/* Card */}
                        <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-card">
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold text-slate-900">Recuperar Senha</h1>
                                <p className="text-slate-500 mt-1.5 leading-relaxed">
                                    Digite o endereço de e-mail associado à sua conta e enviaremos um link para você redefinir sua senha.
                                </p>
                            </div>

                            {success ? (
                                <div className="space-y-6">
                                    <div className="bg-[#e8f5ed] border border-[#a7d7ba] p-8 rounded-[20px] flex flex-col items-center justify-center text-center gap-4">
                                        <div className="w-16 h-16 bg-[#d1ebd9] rounded-full flex items-center justify-center text-[#065f46] mb-2">
                                            <Mail size={32} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-[#064e3b] mb-2">E-mail enviado!</h3>
                                            <p className="text-[#047857] text-sm leading-relaxed max-w-[280px] mx-auto">
                                                Verifique sua caixa de entrada (e a pasta de spam) para encontrar o link de redefinição de senha.
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/login"
                                        className="w-full py-4 px-4 flex justify-center bg-[#f4f5f7] hover:bg-[#e4e5e9] text-[#334155] font-semibold rounded-2xl transition-all"
                                    >
                                        Voltar para o Login
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleResetPassword} className="space-y-5">
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                                            E-mail
                                        </label>
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all"
                                            placeholder="seu@email.com"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !email}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/15"
                                    >
                                        {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
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
