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
        hoverBg: 'group-hover:bg-[#007AFF]/15 dark:group-hover:bg-blue-500/20',
        hoverBorder: 'hover:border-[#007AFF]/40 dark:hover:border-blue-500/40',
        hoverRing: 'hover:shadow-[0_4px_14px_rgba(0,122,255,0.18)]',
    },
    {
        id: 'new-program',
        label: 'Novo programa',
        icon: Dumbbell,
        href: '/programs/new',
        color: 'text-violet-600 dark:text-violet-400',
        bg: 'bg-violet-500/5 dark:bg-violet-500/10',
        hoverBg: 'group-hover:bg-violet-500/15 dark:group-hover:bg-violet-500/20',
        hoverBorder: 'hover:border-violet-500/40 dark:hover:border-violet-500/40',
        hoverRing: 'hover:shadow-[0_4px_14px_rgba(139,92,246,0.18)]',
    },
    {
        id: 'send-form',
        label: 'Enviar avaliação',
        icon: ClipboardList,
        href: '/forms',
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-500/5 dark:bg-teal-500/10',
        hoverBg: 'group-hover:bg-teal-500/15 dark:group-hover:bg-teal-500/20',
        hoverBorder: 'hover:border-teal-500/40 dark:hover:border-teal-500/40',
        hoverRing: 'hover:shadow-[0_4px_14px_rgba(20,184,166,0.18)]',
    },
    {
        id: 'training-room',
        label: 'Sala de Treino',
        icon: Monitor,
        href: '/training-room',
        onboardingId: 'dashboard-training-room',
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
        hoverBg: 'group-hover:bg-emerald-500/15 dark:group-hover:bg-emerald-500/20',
        hoverBorder: 'hover:border-emerald-500/40 dark:hover:border-emerald-500/40',
        hoverRing: 'hover:shadow-[0_4px_14px_rgba(16,185,129,0.18)]',
    },
    {
        id: 'sell-plan',
        label: 'Vender plano',
        icon: Wallet,
        href: '/financial/subscriptions',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        hoverBg: 'group-hover:bg-amber-500/15 dark:group-hover:bg-amber-500/20',
        hoverBorder: 'hover:border-amber-500/40 dark:hover:border-amber-500/40',
        hoverRing: 'hover:shadow-[0_4px_14px_rgba(245,158,11,0.18)]',
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
        <nav aria-label="Ações rápidas" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {actions.map((action) => {
                const Icon = action.icon
                return (
                    <button
                        key={action.id}
                        data-onboarding={action.onboardingId}
                        onClick={() => handleClick(action)}
                        className={`
                            group relative flex items-center gap-2 px-4 py-2.5 rounded-xl
                            border border-[#D2D2D7] dark:border-k-border-primary
                            bg-white dark:bg-surface-card
                            shadow-apple-card dark:shadow-none
                            text-sm font-medium whitespace-nowrap cursor-pointer
                            transition-[transform,box-shadow,border-color] duration-200 ease-out
                            hover:-translate-y-0.5
                            ${action.hoverBorder}
                            ${action.hoverRing}
                            active:translate-y-0 active:scale-[0.98] active:transition-transform active:duration-75
                        `}
                    >
                        <div
                            className={`w-7 h-7 rounded-lg ${action.bg} ${action.hoverBg} flex items-center justify-center flex-shrink-0 transition-colors duration-200`}
                            aria-hidden="true"
                        >
                            <Icon size={15} className={`${action.color} transition-transform duration-200 group-hover:scale-110`} />
                        </div>
                        <span className="text-[#1D1D1F] dark:text-k-text-secondary">{action.label}</span>
                    </button>
                )
            })}
        </nav>
    )
}
