'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, X, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'kinevo_trainer_profile_banner_dismissed'

interface TrainerProfileBannerProps {
    selfStudentId?: string | null
}

// Redesign "ferramenta profissional": painel hairline tokenizado (sem sombra
// apple, sem gradiente violeta no dark, sem círculo decorativo) — o CTA
// primário é o único elemento em violeta.
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
        <div className="relative rounded-panel border border-k-border-subtle bg-surface-card p-5 mb-8">
            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-2 text-k-text-quaternary hover:text-k-text-primary hover:bg-surface-inset rounded-control transition-colors z-sticky"
                title="Dispensar"
            >
                <X size={16} />
            </button>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pr-8">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 bg-surface-inset rounded-control flex items-center justify-center flex-shrink-0 border border-k-border-subtle">
                        <Dumbbell size={17} strokeWidth={1.7} className="text-k-text-secondary" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-k-text-primary">
                            Seu perfil de treino est{'á'} pronto!
                        </h4>
                        <p className="text-xs text-k-text-tertiary mt-0.5">
                            Prescreva programas para si mesmo e treine pelo App Mobile.
                        </p>
                    </div>
                </div>

                {/* CTA — a única cor do painel */}
                <button
                    onClick={handleNavigate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-control transition-opacity flex-shrink-0"
                >
                    Ver meu perfil
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    )
}
