'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, X, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'kinevo_trainer_profile_banner_dismissed'

interface TrainerProfileBannerProps {
    selfStudentId?: string | null
}

export function TrainerProfileBanner({ selfStudentId }: TrainerProfileBannerProps) {
    const router = useRouter()
    const [isDismissed, setIsDismissed] = useState(true)

    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY)
        if (!dismissed) {
            setIsDismissed(false)
        }
    }, [])

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        setIsDismissed(true)
    }

    const handleNavigate = () => {
        if (selfStudentId) {
            router.push(`/students/${selfStudentId}`)
        } else {
            router.push('/students')
        }
    }

    if (isDismissed) return null

    return (
        <div className="relative rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-600/10 via-violet-500/5 to-transparent p-5 mb-8 overflow-hidden">
            {/* Background accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />

            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors z-10"
            >
                <X size={16} />
            </button>

            <div className="relative z-10 space-y-3">
                {/* Top row: icon + text */}
                <div className="flex items-start gap-3 pr-6">
                    <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center flex-shrink-0 border border-violet-500/20">
                        <Dumbbell size={20} className="text-violet-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-foreground">
                            Seu perfil de treino est{'á'} pronto!
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Prescreva programas para si mesmo e treine pelo App Mobile.
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="pl-[52px]">
                    <button
                        onClick={handleNavigate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/15"
                    >
                        Ver Meu Perfil
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
