'use client'

import { useRouter } from 'next/navigation'
import { Monitor } from 'lucide-react'

interface DashboardHeaderProps {
    trainerName: string
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
}

function formatDate(): string {
    const raw = new Date().toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    })
    // "sex., 28 de fev." → "Sex, 28 de fev"
    return raw
        .replace(/\./g, '')
        .replace(/^(\w)/, (_, c: string) => c.toUpperCase())
        .replace(/\s+/g, ' ')
        .trim()
}

export function DashboardHeader({ trainerName }: DashboardHeaderProps) {
    const router = useRouter()
    const firstName = trainerName.split(' ')[0]

    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">
                    {getGreeting()}, {firstName}
                </h1>
                <span className="text-sm text-k-text-tertiary">{formatDate()}</span>
            </div>
            <button
                data-onboarding="dashboard-training-room"
                onClick={() => router.push('/training-room')}
                className="flex items-center gap-2 px-5 py-2 bg-[#007AFF] dark:bg-transparent border-0 dark:border dark:border-k-border-primary text-white dark:text-k-text-secondary hover:bg-[#0066D6] dark:hover:bg-glass-bg dark:hover:text-k-text-primary text-sm font-medium rounded-full dark:rounded-xl transition-colors"
            >
                <Monitor size={16} className="text-white dark:text-emerald-400" />
                Sala de Treino
            </button>
        </div>
    )
}
