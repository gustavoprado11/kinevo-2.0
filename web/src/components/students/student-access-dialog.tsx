'use client'

import { useState } from 'react'

interface StudentAccessDialogProps {
    isOpen: boolean
    onClose: () => void
    studentData: {
        name: string
        email: string
        password: string
        whatsapp: string | null
    } | null
}

export function StudentAccessDialog({ isOpen, onClose, studentData }: StudentAccessDialogProps) {
    const [copied, setCopied] = useState(false)

    if (!isOpen || !studentData) return null

    const handleCopy = () => {
        const text = `Olá ${studentData.name}, aqui estão seus dados de acesso ao Kinevo:\n\n📧 Login: ${studentData.email}\n🔑 Senha: ${studentData.password}\n\nBaixe o app e comece seus treinos!`
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleWhatsApp = () => {
        const message = encodeURIComponent(
            `Olá ${studentData.name}, aqui estão seus dados de acesso ao Kinevo:\n\n📧 *Login*: ${studentData.email}\n🔑 *Senha*: ${studentData.password}\n\nBaixe o app e comece seus treinos! 🚀`
        )
        const phone = studentData.whatsapp?.replace(/\D/g, '') || ''
        window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-background border border-border rounded-3xl p-8 max-w-sm w-full shadow-2xl overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full" />

                <div className="relative">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>

                    <h3 className="text-xl font-bold text-foreground text-center mb-2">Aluno Criado!</h3>
                    <p className="text-muted-foreground text-sm text-center mb-8">
                        Envie as informações de acesso para o seu aluno agora mesmo.
                    </p>

                    {/* Credentials Card */}
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-8">
                        <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">E-mail / Login</span>
                            <p className="text-foreground font-medium select-all">{studentData.email}</p>
                        </div>
                        <div className="pt-4 border-t border-border">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Senha Provisória</span>
                            <p className="text-2xl font-mono font-bold text-emerald-400 tracking-widest">{studentData.password}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleWhatsApp}
                            className="w-full h-12 bg-[#25D366] hover:bg-[#22c35e] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.411.002 12.048c0 2.12.54 4.189 1.562 6.027L0 24l6.12-1.605a11.803 11.803 0 005.928 1.603h.005c6.637 0 12.046-5.411 12.048-12.05a11.75 11.75 0 00-3.589-8.441" />
                            </svg>
                            Enviar via WhatsApp
                        </button>

                        <button
                            onClick={handleCopy}
                            className={`w-full h-12 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-xl transition-all flex items-center justify-center gap-2 border border-border ${copied ? 'ring-2 ring-emerald-500/50' : ''}`}
                        >
                            {copied ? (
                                <>
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copiado!
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    Copiar Texto
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full pt-4 text-muted-foreground hover:text-foreground/80 text-sm font-medium transition-colors"
                        >
                            Fechar e voltar para a lista
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
