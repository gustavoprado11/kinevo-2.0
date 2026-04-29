'use client'

import { useState } from 'react'
import { Smartphone, Copy, Check, ExternalLink } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'

const IOS_LINK = 'https://apps.apple.com/br/app/kinevo/id6759053587'
const ANDROID_LINK = 'https://play.google.com/store/apps/details?id=com.kinevo.mobile'

export function AppDownloadCard() {
    const [copied, setCopied] = useState<'ios' | 'android' | null>(null)

    const handleCopy = async (platform: 'ios' | 'android', link: string) => {
        await navigator.clipboard.writeText(link)
        useOnboardingStore.getState().completeMilestone('app_link_shared')
        setCopied(platform)
        setTimeout(() => setCopied(null), 2000)
    }

    return (
        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                    <Smartphone size={18} className="text-violet-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">App Mobile</h3>
                    <p className="text-[11px] text-muted-foreground">Compartilhe com seus alunos</p>
                </div>
            </div>

            {/* iOS */}
            <div className="space-y-2.5">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-glass-bg border border-k-border-subtle">
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-muted-foreground/60 mb-1">
                            iOS (App Store)
                        </p>
                        <p className="text-xs text-foreground/80 truncate">{IOS_LINK}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => handleCopy('ios', IOS_LINK)}
                            className="p-2 text-muted-foreground/60 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                            title="Copiar link"
                        >
                            {copied === 'ios' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <a
                            href={IOS_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-muted-foreground/60 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                            title="Abrir na App Store"
                        >
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>

                {/* Android */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-glass-bg border border-k-border-subtle">
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-muted-foreground/60 mb-1">
                            Android (Play Store)
                        </p>
                        <p className="text-xs text-foreground/80 truncate">{ANDROID_LINK}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => handleCopy('android', ANDROID_LINK)}
                            className="p-2 text-muted-foreground/60 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                            title="Copiar link"
                        >
                            {copied === 'android' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <a
                            href={ANDROID_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-muted-foreground/60 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                            title="Abrir na Play Store"
                        >
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
