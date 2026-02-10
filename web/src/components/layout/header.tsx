'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
        <header className="h-16 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800/50 flex items-center justify-between px-6 sticky top-0 z-20">
            {/* Left side - can add breadcrumbs or page title later */}
            <div />

            {/* Right side - User menu */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center ring-2 ring-gray-800">
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
                        <p className="text-sm font-medium text-white leading-tight">{trainerName}</p>
                        {trainerEmail && (
                            <p className="text-xs text-gray-500 leading-tight">{trainerEmail}</p>
                        )}
                    </div>
                </div>

                {/* Logout button */}
                <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="hidden sm:inline">Sair</span>
                </button>
            </div>
        </header>
    )
}
