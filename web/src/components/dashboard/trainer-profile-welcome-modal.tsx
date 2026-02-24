'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, Smartphone, X } from 'lucide-react'

const STORAGE_KEY = 'kinevo_trainer_profile_welcome_seen'

export function TrainerProfileWelcomeModal() {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const seen = localStorage.getItem(STORAGE_KEY)
        if (!seen) {
            setIsOpen(true)
        }
    }, [])

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        setIsOpen(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleDismiss} />
            <div className="relative bg-surface-card border border-k-border-primary rounded-2xl p-8 max-w-md w-full shadow-2xl">
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Icon */}
                <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-violet-500/20">
                    <Dumbbell className="w-8 h-8 text-violet-400" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-black text-foreground text-center mb-2 tracking-tight">
                    Treine com o Kinevo!
                </h3>
                <p className="text-muted-foreground text-sm text-center mb-6 leading-relaxed">
                    Criamos automaticamente seu perfil de aluno para que você possa usar
                    o App Mobile e treinar com os programas que prescrever para si mesmo.
                </p>

                {/* Steps */}
                <div className="space-y-3 mb-8">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-glass-bg border border-k-border-subtle">
                        <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-black text-white">1</span>
                        </div>
                        <p className="text-sm text-foreground/80">
                            <span className="font-semibold text-foreground">Prescreva treinos</span> para o perfil
                            <span className="text-violet-300 font-semibold"> &quot;Meu Perfil&quot;</span> na aba Alunos
                        </p>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-glass-bg border border-k-border-subtle">
                        <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-black text-white">2</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <p className="text-sm text-foreground/80">
                                <span className="font-semibold text-foreground">Abra o App Mobile</span> com
                                o mesmo email e senha para treinar
                            </p>
                            <Smartphone size={16} className="text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <button
                    onClick={handleDismiss}
                    className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20 text-sm"
                >
                    Entendi!
                </button>
            </div>
        </div>
    )
}
