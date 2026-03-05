'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/translate-auth-error'
import { AuthLayout } from '@/components/auth/auth-layout'

export default function UpdatePasswordPage() {
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
        <AuthLayout
            tagline="A evolução da sua consultoria"
            taglineAccent="começa aqui."
            subtitle="Gerencie treinos, acompanhe alunos e escale sua consultoria fitness com a plataforma feita por treinadores."
            bottomIcon={Sparkles}
            bottomText="Mais de 1.000 treinadores já transformaram suas consultorias"
            backHref={null}
        >
            <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-elevated">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Redefinir senha</h1>
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
                            className="w-full py-3 px-4 flex justify-center bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/15"
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
                                Nova senha
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                                Confirmar nova senha
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                                placeholder="Repita a senha"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password || !confirmPassword}
                            className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/15"
                        >
                            {loading ? 'Salvando...' : 'Salvar nova senha'}
                        </button>
                    </form>
                )}
            </div>
        </AuthLayout>
    )
}
