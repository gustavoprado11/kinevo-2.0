'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/translate-auth-error'
import { checkTrainerEmail } from './actions/check-trainer-email'
import { AuthLayout } from '@/components/auth/auth-layout'

export default function ForgotPasswordPage() {
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
        <AuthLayout
            tagline="A evolução da sua consultoria"
            taglineAccent="começa aqui."
            subtitle="Gerencie treinos, acompanhe alunos e escale sua consultoria fitness com a plataforma feita por treinadores."
            bottomIcon={Sparkles}
            bottomText="Mais de 1.000 treinadores já transformaram suas consultorias"
            backHref="/login"
            backLabel="Voltar para o Login"
        >
            <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-elevated">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Recuperar senha</h1>
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
                                className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !email}
                            className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/15"
                        >
                            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                        </button>
                    </form>
                )}
            </div>
        </AuthLayout>
    )
}
