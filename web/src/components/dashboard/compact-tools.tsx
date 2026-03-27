'use client'

import { useState } from 'react'
import { Plus, Smartphone, Copy, Check } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'

const IOS_LINK = 'https://apps.apple.com/br/app/kinevo/id6759053587'

interface CompactToolsProps {
    onNewStudent: () => void
}

export function CompactTools({ onNewStudent }: CompactToolsProps) {
    const [copied, setCopied] = useState(false)

    const handleCopyAppLink = async () => {
        await navigator.clipboard.writeText(IOS_LINK)
        useOnboardingStore.getState().completeMilestone('app_link_shared')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const cardClass = "rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-none"

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
                data-onboarding="dashboard-new-student"
                onClick={onNewStudent}
                className={`flex items-center gap-3 p-3 ${cardClass} hover:shadow-apple-hover dark:hover:shadow-none hover:border-[#007AFF] dark:hover:border-k-border-primary transition-all`}
            >
                <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Plus size={16} className="text-[#007AFF] dark:text-violet-400" />
                </div>
                <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-secondary">Novo aluno</span>
            </button>

            <div className={`flex items-center justify-between p-3 ${cardClass}`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Smartphone size={16} className="text-[#86868B] dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-secondary">App Kinevo</span>
                </div>
                <button
                    onClick={handleCopyAppLink}
                    className="text-sm text-[#007AFF] dark:text-k-text-quaternary hover:text-[#0056B3] dark:hover:text-k-text-primary px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                >
                    {copied ? (
                        <>
                            <Check size={12} className="text-[#34C759] dark:text-emerald-400" />
                            <span className="text-[#34C759] dark:text-emerald-400">Copiado</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            Copiar link
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
