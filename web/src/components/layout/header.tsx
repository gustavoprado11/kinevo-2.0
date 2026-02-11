'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface HeaderProps {
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
}

export function Header({ trainerName, trainerEmail, trainerAvatarUrl }: HeaderProps) {
    const router = useRouter()

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
        <header className="h-16 bg-background backdrop-blur-sm border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
            {/* Left side - can add breadcrumbs or page title later */}
            <div />

            {/* Right side - User menu */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center ring-2 ring-border">
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
                        <p className="text-sm font-medium text-foreground leading-tight">{trainerName}</p>
                        {trainerEmail && (
                            <p className="text-xs text-muted-foreground leading-tight">{trainerEmail}</p>
                        )}
                    </div>
                </div>

                {/* Logout button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 gap-2"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sair</span>
                </Button>
            </div>
        </header>
    )
}
