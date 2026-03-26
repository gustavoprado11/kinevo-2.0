'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, Mail, User, AlertCircle } from 'lucide-react'
import { submitAndroidTester } from './actions'

type FormState = 'idle' | 'success' | 'duplicate'

export function AndroidTesterForm() {
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [formState, setFormState] = useState<FormState>('idle')
    const [isPending, startTransition] = useTransition()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const trimmed = email.trim().toLowerCase()
        if (!trimmed) {
            setError('Informe seu e-mail.')
            return
        }
        if (!/@(gmail\.com|googlemail\.com)$/i.test(trimmed)) {
            setError('Use seu e-mail do Google (@gmail.com).')
            return
        }

        startTransition(async () => {
            const result = await submitAndroidTester(trimmed, name)
            if (result.status === 'success') {
                setFormState('success')
            } else if (result.status === 'duplicate') {
                setFormState('duplicate')
            } else {
                setError(result.message)
            }
        })
    }

    if (formState === 'success') {
        return (
            <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h2 className="font-jakarta text-lg font-bold text-white mb-2">Pronto!</h2>
                <p className="text-[#94a3b8] text-sm leading-relaxed">
                    Seu e-mail foi cadastrado. Você receberá acesso em até <strong className="text-white">24 horas</strong>.
                    Fique de olho no e-mail para o convite do Google Play.
                </p>
            </div>
        )
    }

    if (formState === 'duplicate') {
        return (
            <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 mb-4">
                    <AlertCircle className="w-7 h-7 text-amber-400" />
                </div>
                <h2 className="font-jakarta text-lg font-bold text-white mb-2">E-mail já cadastrado!</h2>
                <p className="text-[#94a3b8] text-sm leading-relaxed">
                    Este e-mail já está na fila. Aguarde a liberação do acesso.
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
                <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-[2px] text-white/45 mb-2">
                    E-mail do Google *
                </label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
                    <input
                        id="email"
                        type="email"
                        required
                        placeholder="seunome@gmail.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null) }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#475569] outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/30 transition-colors"
                    />
                </div>
            </div>

            {/* Name (optional) */}
            <div>
                <label htmlFor="name" className="block text-[11px] font-semibold uppercase tracking-[2px] text-white/45 mb-2">
                    Seu nome <span className="text-white/25">(opcional)</span>
                </label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
                    <input
                        id="name"
                        type="text"
                        placeholder="Nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#475569] outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/30 transition-colors"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                </p>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={isPending}
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3.5 transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] flex items-center justify-center gap-2"
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cadastrando...
                    </>
                ) : (
                    'Solicitar Acesso'
                )}
            </button>

            <p className="text-[11px] text-[#475569] text-center leading-relaxed">
                O e-mail precisa ser uma conta Google (Gmail) para funcionar com o Google Play.
            </p>
        </form>
    )
}
