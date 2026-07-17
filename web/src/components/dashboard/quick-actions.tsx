'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Dumbbell, ClipboardList, Share2, Wallet } from 'lucide-react'
import { AppLinksDialog } from '@/components/onboarding/widgets/app-links-dialog'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useStudioState } from '@/hooks/use-studio-state'

interface QuickActionsProps {
    onNewStudent: () => void
}

// Fase de varredura do redesign: os chips de ícone coloridos (um matiz por
// ação) saíram — atalho é navegação, não festa de cor. Ícone em tinta,
// destaque só no hover.
const actions = [
    { id: 'new-student', label: 'Novo aluno', icon: UserPlus, onboardingId: 'dashboard-new-student' },
    { id: 'new-program', label: 'Novo programa', icon: Dumbbell, href: '/programs/new' },
    { id: 'send-form', label: 'Enviar avaliação', icon: ClipboardList, href: '/forms' },
    { id: 'share-app', label: 'Compartilhar aplicativo', icon: Share2, onboardingId: 'dashboard-share-app' },
    { id: 'sell-plan', label: 'Vender plano', icon: Wallet, href: '/financial/subscriptions' },
]

export function QuickActions({ onNewStudent }: QuickActionsProps) {
    const router = useRouter()
    const [shareOpen, setShareOpen] = useState(false)
    // Estúdio não cobra alunos por aqui — some "Vender plano".
    const { isStudioAccount } = useStudioState()
    const visibleActions = actions.filter(a => !(a.id === 'sell-plan' && isStudioAccount))

    const handleClick = (action: typeof actions[number]) => {
        if (action.id === 'new-student') {
            onNewStudent()
        } else if (action.id === 'share-app') {
            useOnboardingStore.getState().completeMilestone('app_link_shared')
            setShareOpen(true)
        } else if (action.href) {
            router.push(action.href)
        }
    }

    return (
        <>
        <nav aria-label="Ações rápidas" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {visibleActions.map((action) => {
                const Icon = action.icon
                return (
                    <button
                        key={action.id}
                        data-onboarding={action.onboardingId}
                        onClick={() => handleClick(action)}
                        className="group flex items-center gap-2 px-3.5 py-2 rounded-control border border-k-border-primary bg-surface-card text-sm font-medium whitespace-nowrap cursor-pointer transition-colors hover:bg-surface-inset"
                    >
                        <Icon
                            size={15}
                            strokeWidth={1.7}
                            className="flex-shrink-0 text-k-text-tertiary transition-colors group-hover:text-k-text-secondary"
                            aria-hidden="true"
                        />
                        <span className="text-k-text-secondary transition-colors group-hover:text-k-text-primary">{action.label}</span>
                    </button>
                )
            })}
        </nav>

        <AppLinksDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} />
        </>
    )
}
