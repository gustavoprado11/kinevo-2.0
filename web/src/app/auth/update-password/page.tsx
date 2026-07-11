'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, TimerOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updatePasswordSecure } from '@/actions/auth/update-password'
import { AuthLayout } from '@/components/auth/auth-layout'

/** Estado do link de recovery: validando → utilizável | inválido/expirado. */
type LinkState = 'checking' | 'ready' | 'invalid'

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [linkState, setLinkState] = useState<LinkState>('checking')

    // AC1: valida o link NA CHEGADA. Antes, a página assumia sessão de
    // recovery presente e o usuário só descobria o link expirado/aberto em
    // outro dispositivo (PKCE sem code_verifier) no submit, com erro genérico.
    useEffect(() => {
        const supabase = createClient()

        // Supabase devolve erros de link no hash (#error=...&error_code=otp_expired)
        // ou na query, dependendo do fluxo.
        const url = new URL(window.location.href)
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
        const errParam = url.searchParams.get('error') ?? hashParams.get('error')
        if (errParam) {
            setLinkState('invalid')
            return
        }

        let decided = false
        const decide = (hasSession: boolean) => {
            if (decided) return
            decided = true
            setLinkState(hasSession ? 'ready' : 'invalid')
        }

        // O exchange do ?code= roda async no client — escuta o evento e dá
        // uma margem antes de declarar o link inválido.
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) decide(true)
        })
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) decide(true)
        })
        const fallback = setTimeout(() => {
            supabase.auth.getSession().then(({ data }) => decide(!!data.session))
        }, 2500)

        return () => {
            sub.subscription.unsubscribe()
            clearTimeout(fallback)
        }
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        // AC4: política alinhada com o signup (8+; HIBP roda na action).
        if (password.length < 8) {
            setError('A senha deve ter pelo menos 8 caracteres.')
            return
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setLoading(true)

        const result = await updatePasswordSecure(password)

        if (!result.success) {
            setError(result.error ?? 'Não foi possível salvar a nova senha.')
            setLoading(false)
            return
        }

        // Successfully updated password
        setSuccess(true)
        setLoading(false)

        // Clear session so they have to login with new credentials (optional but secure)
        const supabase = createClient()
        await supabase.auth.signOut()
    }

    return (
        <AuthLayout
            tagline="Seus alunos merecem"
            taglineAccent="uma experiência profissional."
            subtitle="Prescreva com precisão, acompanhe cada aluno de perto e receba sem perder dinheiro com taxas."
            backHref={null}
        >
            <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-apple-elevated">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Redefinir senha</h1>
                    <p className="text-slate-500 mt-1.5 leading-relaxed">
                        Crie uma nova senha para acessar sua conta.
                    </p>
                </div>

                {linkState === 'checking' && !success ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 size={22} className="animate-spin text-violet-500" />
                        <p className="text-sm">Validando seu link de redefinição…</p>
                    </div>
                ) : linkState === 'invalid' && !success ? (
                    <div className="space-y-6">
                        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-2">
                                <TimerOff size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-amber-800">Link inválido ou expirado</h3>
                                <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                                    Links de redefinição valem por pouco tempo e funcionam
                                    apenas no navegador em que foram abertos. Peça um novo
                                    link e abra-o neste mesmo dispositivo.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/auth/forgot-password"
                            className="w-full py-3 px-4 flex justify-center bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/15"
                        >
                            Pedir novo link
                        </Link>
                    </div>
                ) : success ? (
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
                                minLength={8}
                                className="w-full px-4 py-3 bg-[#F9F9FB] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                                placeholder="Mínimo 8 caracteres"
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
                                minLength={8}
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
