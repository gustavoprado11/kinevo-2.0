'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { fetchTrainerThemePreference } from '@/lib/theme/seed-theme'
import { translateAuthError } from '@/lib/translate-auth-error'
import { AuthLayout, authInputClass, authLabelClass, authButtonClass } from '@/components/auth/auth-layout'

// Aceita apenas caminhos internos ("/oauth/authorize?...") para evitar
// open-redirect. Rejeita URLs absolutas, "//host" e "/\host".
function safeRedirect(raw: string | null): string {
    if (!raw) return '/dashboard'
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
        return '/dashboard'
    }
    return raw
}

function LoginForm() {
    const router = useRouter()
    const { setTheme } = useTheme()
    const searchParams = useSearchParams()
    const redirectTo = safeRedirect(searchParams.get('redirect'))
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const supabase = createClient()

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(translateAuthError(error.message))
            setLoading(false)
            return
        }

        // Aplica o tema do treinador ANTES de navegar: num navegador novo o
        // next-themes não tem nada no localStorage e a área logada pintava clara
        // até o ThemeSync corrigir (flash). O /login é forçado light, então o
        // setTheme aqui não muda esta tela — só o destino. Ver seed-theme.ts.
        if (data.user) {
            const trainerTheme = await fetchTrainerThemePreference(supabase, data.user.id)
            if (trainerTheme) setTheme(trainerTheme)
        }

        router.push(redirectTo)
        router.refresh()
    }

    return (
        <AuthLayout
            tagline="Seus alunos merecem"
            taglineAccent="uma experiência profissional."
            subtitle="Prescreva com precisão, acompanhe cada aluno de perto e receba sem perder dinheiro com taxas."
            backHref="/"
            backLabel="Voltar"
            footer={
                <p className="text-sm text-[#8A8580] mt-6 pt-5 border-t border-[#E7E5E4]">
                    Não tem uma conta?{' '}
                    <Link href="/signup" className="text-[#6D28D9] hover:text-[#5B21B6] font-semibold transition-colors">
                        Criar conta
                    </Link>
                </p>
            }
        >
            <div>
                <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-[#1C1917]">Bem-vindo de volta</h1>
                <p className="text-[#8A8580] text-[14.5px] mt-1.5">Entre na sua conta para continuar</p>

                <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-7">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-3 rounded-[9px] text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className={authLabelClass}>
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={authInputClass}
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="password" className="block text-[13px] font-semibold text-[#57534E]">
                                Senha
                            </label>
                            <Link href="/auth/forgot-password" className="text-[12.5px] text-[#6D28D9] hover:text-[#5B21B6] font-semibold transition-colors">
                                Esqueceu a senha?
                            </Link>
                        </div>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={authInputClass}
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" disabled={loading} className={`${authButtonClass} mt-1`}>
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </AuthLayout>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    )
}
