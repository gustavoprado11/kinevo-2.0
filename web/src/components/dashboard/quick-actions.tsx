'use client'

import { useRouter } from 'next/navigation'
import { UserPlus, Dumbbell, ClipboardList, Monitor, Wallet } from 'lucide-react'

interface QuickActionsProps {
    onNewStudent: () => void
}

const actions = [
    {
        id: 'new-student',
        label: 'Novo aluno',
        icon: UserPlus,
        onboardingId: 'dashboard-new-student',
        color: 'text-[#007AFF] dark:text-blue-400',
        bg: 'bg-[#007AFF]/5 dark:bg-blue-500/10',
        hoverBorder: 'hover:border-[#007AFF]/30 dark:hover:border-blue-500/30',
    },
    {
        id: 'new-program',
        label: 'Novo programa',
        icon: Dumbbell,
        href: '/programs/new',
        color: 'text-violet-600 dark:text-violet-400',
        bg: 'bg-violet-500/5 dark:bg-violet-500/10',
        hoverBorder: 'hover:border-violet-500/30 dark:hover:border-violet-500/30',
    },
    {
        id: 'send-form',
        label: 'Enviar avaliação',
        icon: ClipboardList,
        href: '/forms',
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-500/5 dark:bg-teal-500/10',
        hoverBorder: 'hover:border-teal-500/30 dark:hover:border-teal-500/30',
    },
    {
        id: 'training-room',
        label: 'Sala de Treino',
        icon: Monitor,
        href: '/training-room',
        onboardingId: 'dashboard-training-room',
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
        hoverBorder: 'hover:border-emerald-500/30 dark:hover:border-emerald-500/30',
    },
    {
        id: 'sell-plan',
        label: 'Vender plano',
        icon: Wallet,
        href: '/financial/subscriptions',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        hoverBorder: 'hover:border-amber-500/30 dark:hover:border-amber-500/30',
    },
]

export function QuickActions({ onNewStudent }: QuickActionsProps) {
    const router = useRouter()

    const handleClick = (action: typeof actions[number]) => {
        if (action.id === 'new-student') {
            onNewStudent()
        } else if (action.href) {
            router.push(action.href)
        }
    }

    return (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {actions.map((action) => {
                const Icon = action.icon
                return (
                    <button
                        key={action.id}
                        data-onboarding={action.onboardingId}
                        onClick={() => handleClick(action)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl
                            border border-[#D2D2D7] dark:border-k-border-primary
                            bg-white dark:bg-surface-card
                            shadow-apple-card dark:shadow-none
                            text-sm font-medium whitespace-nowrap
                            transition-all duration-200 ease-out
                            hover:shadow-apple-hover dark:hover:shadow-none
                            ${action.hoverBorder}
                            active:scale-[0.97]
                        `}
                    >
                        <div className={`w-7 h-7 rounded-lg ${action.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon size={15} className={action.color} />
                        </div>
                        <span className="text-[#1D1D1F] dark:text-k-text-secondary">{action.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
