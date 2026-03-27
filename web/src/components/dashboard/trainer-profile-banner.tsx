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
        <div className="relative rounded-xl border border-[#D2D2D7] dark:border-violet-500/20 bg-white dark:bg-gradient-to-r dark:from-violet-600/10 dark:via-violet-500/5 dark:to-transparent p-5 mb-8 overflow-hidden shadow-apple-card dark:shadow-none">
            {/* Background accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5F5F7] dark:bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-2 text-[#AEAEB2] dark:text-muted-foreground/40 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-white/5 rounded-lg transition-colors z-sticky"
            >
                <X size={16} />
            </button>

            <div className="relative z-sticky space-y-3">
                {/* Top row: icon + text */}
                <div className="flex items-start gap-3 pr-6">
                    <div className="w-10 h-10 bg-[#F5F5F7] dark:bg-violet-500/15 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#E8E8ED] dark:border-violet-500/20">
                        <Dumbbell size={20} className="text-[#007AFF] dark:text-violet-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-[#1D1D1F] dark:text-foreground">
                            Seu perfil de treino est{'á'} pronto!
                        </h4>
                        <p className="text-xs text-[#6E6E73] dark:text-muted-foreground mt-0.5">
                            Prescreva programas para si mesmo e treine pelo App Mobile.
                        </p>
                    </div>
                </div>

                {/* CTA */}
                <div className="pl-[52px]">
                    <button
                        onClick={handleNavigate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0066D6] dark:hover:bg-violet-500 text-white text-xs font-semibold rounded-full dark:rounded-xl transition-all"
                    >
                        Ver Meu Perfil
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
