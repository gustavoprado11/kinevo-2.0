'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Sparkles } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

interface HeaderProps {
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
}

export function Header({ trainerName, trainerEmail, trainerAvatarUrl }: HeaderProps) {
    const router = useRouter()
    const openChat = useAssistantChatStore(s => s.openChat)

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    // Get initials for avatar
    const initials = trainerName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    return (
        <header className="h-16 bg-white dark:bg-surface-card border-b border-[#E8E8ED] dark:border-k-border-subtle flex items-center justify-between px-6 sticky top-0 z-header">
            {/* Left side - can add breadcrumbs or page title later */}
            <div />

            {/* Right side - User menu */}
            <div className="flex items-center gap-4">
                {/* Assistant */}
                <button
                    onClick={() => openChat()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors text-sm font-medium"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Assistente</span>
                </button>

                {/* Notifications */}
                <NotificationBell />

                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center ring-2 ring-[#E8E8ED] dark:ring-border">
                        {trainerAvatarUrl ? (
                            <Image
                                src={trainerAvatarUrl}
                                alt="Avatar do treinador"
                                width={36}
                                height={36}
                                className="w-9 h-9 rounded-full object-cover"
                                unoptimized
                            />
                        ) : (
                            <span className="text-white text-sm font-medium">{initials}</span>
                        )}
                    </div>

                    {/* Name & Email */}
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground leading-tight">{trainerName}</p>
                        {trainerEmail && (
                            <p className="text-xs text-[#86868B] dark:text-muted-foreground leading-tight">{trainerEmail}</p>
                        )}
                    </div>
                </div>

                {/* Logout button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-[#86868B] dark:text-slate-400 hover:text-[#FF3B30] dark:hover:text-slate-100 gap-2"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sair</span>
                </Button>
            </div>
        </header>
    )
}
