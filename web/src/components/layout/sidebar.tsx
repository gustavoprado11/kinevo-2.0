'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard, Users, Dumbbell, Calendar, Wallet, FileText,
    PanelLeftClose, MessageSquarePlus, Headphones, MessageCircle,
    LogOut, BookOpen, ChevronRight, Settings,
} from 'lucide-react'
import { useSidebarStore, shouldAutoCollapse } from '@/stores/sidebar-store'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { MessagesBadge } from '@/components/messages/messages-badge'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
    name: string
    href: string
    icon: React.ElementType
    onboardingId?: string
}

interface SidebarProps {
    financialBadge?: React.ReactNode
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
}

const navigation: NavItem[] = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        onboardingId: 'sidebar-dashboard',
    },
    {
        name: 'Alunos',
        href: '/students',
        icon: Users,
        onboardingId: 'sidebar-students',
    },
    {
        name: 'Mensagens',
        href: '/messages',
        icon: MessageCircle,
    },
    {
        name: 'Avaliações',
        href: '/forms',
        icon: FileText,
        onboardingId: 'sidebar-forms',
    },
    {
        name: 'Financeiro',
        href: '/financial',
        icon: Wallet,
        onboardingId: 'sidebar-financial',
    },
]

const bibliotecaItems: NavItem[] = [
    {
        name: 'Programas',
        href: '/programs',
        icon: Calendar,
        onboardingId: 'sidebar-programs',
    },
    {
        name: 'Exercícios',
        href: '/exercises',
        icon: Dumbbell,
        onboardingId: 'sidebar-exercises',
    },
]

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5531999064997'

export function Sidebar({ financialBadge, trainerName, trainerEmail, trainerAvatarUrl }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { isCollapsed, isAutoCollapsed, toggle, setAutoCollapse, expand } = useSidebarStore()
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    const [bibliotecaOpen, setBibliotecaOpen] = useState(true)
    const [profileOpen, setProfileOpen] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)

    const initials = trainerName
        .split(' ')
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

    // Close profile popover on outside click
    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
            setProfileOpen(false)
        }
    }, [])

    useEffect(() => {
        if (profileOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [profileOpen, handleClickOutside])

    // Auto-collapse/expand based on route
    useEffect(() => {
        const shouldCollapse = shouldAutoCollapse(pathname)

        if (shouldCollapse && !isCollapsed) {
            setAutoCollapse(true)
        } else if (!shouldCollapse && isAutoCollapsed) {
            expand()
        }
    }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <aside
            suppressHydrationWarning
            className={`sidebar-container fixed inset-y-0 left-0 z-sidebar flex flex-col border-r border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-sidebar/60 dark:backdrop-blur-2xl transition-all duration-300 ease-in-out ${
                isCollapsed ? 'w-[68px]' : 'w-64'
            }`}
        >
            {/* Header / Logo + Toggle */}
            <div className={`pt-8 pb-8 flex items-center ${isCollapsed ? 'px-0 justify-center' : 'px-6 justify-between'}`}>
                {isCollapsed ? (
                    <button
                        onClick={toggle}
                        className="flex items-center justify-center rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                        title="Expandir menu"
                    >
                        <Image
                            src="/logo-icon.png"
                            alt="Kinevo Logo"
                            width={32}
                            height={32}
                            className="rounded-lg"
                        />
                    </button>
                ) : (
                    <>
                        <Link href="/dashboard" className="flex items-center gap-3 group overflow-hidden">
                            <Image
                                src="/logo-icon.png"
                                alt="Kinevo Logo"
                                width={32}
                                height={32}
                                className="rounded-lg shrink-0"
                            />
                            <span className="text-lg font-semibold text-[#1D1D1F] dark:text-foreground/90 tracking-tight whitespace-nowrap">
                                Kinevo
                            </span>
                        </Link>
                        <button
                            onClick={toggle}
                            className="p-1.5 rounded-lg text-[#AEAEB2] dark:text-muted-foreground/40 hover:text-[#6E6E73] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                            title="Recolher menu"
                        >
                            <PanelLeftClose size={18} strokeWidth={1.5} />
                        </button>
                    </>
                )}
            </div>

            {/* Navigation */}
            <nav className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {navigation.map((item) => {
                    const active = isActive(item.href)
                    const Icon = item.icon
                    return (
                        <div key={item.name} className="relative group/nav">
                            <Link
                                href={item.href}
                                data-onboarding={item.onboardingId}
                                className={`
                                    relative flex items-center gap-3 py-2 rounded-lg text-sm tracking-tight transition-all duration-200 ease-out group
                                    ${isCollapsed ? 'justify-center px-0' : 'px-3'}
                                    ${active
                                        ? 'bg-[#007AFF]/10 dark:bg-glass-bg-active text-[#007AFF] dark:text-foreground font-semibold'
                                        : 'text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg font-medium'
                                    }
                                `}
                            >
                                {active && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[#007AFF] dark:bg-violet-500 rounded-r-full" />
                                )}
                                <Icon
                                    size={18}
                                    strokeWidth={1.5}
                                    className={`shrink-0 transition-colors duration-200 ${active ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`}
                                />
                                <span
                                    className={`whitespace-nowrap transition-all duration-300 ${
                                        isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 flex-1'
                                    }`}
                                >
                                    {item.name}
                                </span>
                                {!isCollapsed && item.name === 'Financeiro' && financialBadge}
                                {!isCollapsed && item.name === 'Mensagens' && <MessagesBadge />}
                            </Link>

                            {/* Tooltip — only when collapsed */}
                            {isCollapsed && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                    {item.name}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Bibliotecas accordion */}
                <div className="mt-1">
                    <button
                        onClick={() => !isCollapsed && setBibliotecaOpen(b => !b)}
                        className={`group/nav relative flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                        <BookOpen size={18} strokeWidth={1.5} className="shrink-0 text-[#AEAEB2] dark:text-muted-foreground/60" />
                        {!isCollapsed && (
                            <>
                                <span className="flex-1 text-left">Bibliotecas</span>
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${bibliotecaOpen ? 'rotate-90' : ''}`} />
                            </>
                        )}
                        {isCollapsed && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                Bibliotecas
                            </div>
                        )}
                    </button>

                    {(bibliotecaOpen || isCollapsed) && (
                        <div className={`mt-0.5 space-y-0.5 ${!isCollapsed ? 'pl-3' : ''}`}>
                            {bibliotecaItems.map(item => {
                                const active = isActive(item.href)
                                return (
                                    <div key={item.name} className="relative group/nav">
                                        <Link
                                            href={item.href}
                                            data-onboarding={item.onboardingId}
                                            className={`relative flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                                active
                                                    ? 'bg-[#007AFF]/10 dark:bg-glass-bg-active text-[#007AFF] dark:text-foreground font-semibold'
                                                    : 'text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                            } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                                        >
                                            <item.icon size={18} strokeWidth={1.5} className={`shrink-0 transition-colors duration-200 ${active ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60'}`} />
                                            {!isCollapsed && <span>{item.name}</span>}
                                        </Link>
                                        {isCollapsed && (
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                                {item.name}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Configurações */}
                <div className="relative group/nav">
                    <Link
                        href="/settings"
                        className={`relative flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isActive('/settings')
                                ? 'bg-[#007AFF]/10 dark:bg-glass-bg-active text-[#007AFF] dark:text-foreground font-semibold'
                                : 'text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                        } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                        <Settings size={18} strokeWidth={1.5} className={`shrink-0 transition-colors ${
                            isActive('/settings')
                                ? 'text-[#007AFF] dark:text-foreground'
                                : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover/nav:text-[#6E6E73] dark:group-hover/nav:text-foreground'
                        }`} />
                        {!isCollapsed && <span>Configurações</span>}
                    </Link>
                    {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            Configurações
                        </div>
                    )}
                </div>
            </nav>

            {/* Footer */}
            <div className={`border-t border-[#E8E8ED] dark:border-k-border-subtle pt-2 pb-1 space-y-1 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {/* Feedback */}
                <div className="relative group/nav">
                    <button
                        onClick={() => setFeedbackOpen(true)}
                        className={`flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                            isCollapsed ? 'justify-center px-0' : 'px-3'
                        }`}
                    >
                        <MessageSquarePlus size={18} strokeWidth={1.5} className="shrink-0 text-[#AEAEB2] dark:text-muted-foreground/60 group-hover/nav:text-[#6E6E73] dark:group-hover/nav:text-foreground transition-colors" />
                        <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                            Feedback e Bugs
                        </span>
                    </button>
                    {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            Feedback e Bugs
                        </div>
                    )}
                </div>

                {/* Support */}
                <div className="relative group/nav">
                    <button
                        onClick={() => window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Kinevo.')}`, '_blank')}
                        className={`flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                            isCollapsed ? 'justify-center px-0' : 'px-3'
                        }`}
                    >
                        <Headphones size={18} strokeWidth={1.5} className="shrink-0 text-[#AEAEB2] dark:text-muted-foreground/60 group-hover/nav:text-[#6E6E73] dark:group-hover/nav:text-foreground transition-colors" />
                        <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                            Suporte
                        </span>
                    </button>
                    {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            Suporte
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle my-1" />

                {/* Profile with popover */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setProfileOpen(o => !o)}
                        className={`flex items-center gap-3 w-full py-2 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center ring-2 ring-[#E8E8ED] dark:ring-border flex-shrink-0">
                            {trainerAvatarUrl ? (
                                <Image src={trainerAvatarUrl} alt="Avatar" width={32} height={32} className="w-8 h-8 rounded-full object-cover" unoptimized />
                            ) : (
                                <span className="text-white text-xs font-medium">{initials}</span>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground leading-tight truncate">{trainerName}</p>
                                {trainerEmail && (
                                    <p className="text-xs text-[#86868B] dark:text-muted-foreground leading-tight truncate">{trainerEmail}</p>
                                )}
                            </div>
                        )}
                    </button>

                    {/* Collapsed tooltip */}
                    {isCollapsed && !profileOpen && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            {trainerName}
                        </div>
                    )}

                    {/* Profile popover */}
                    {profileOpen && (
                        <div className={`absolute bottom-full mb-2 w-56 bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-primary rounded-xl shadow-xl z-modal overflow-hidden ${isCollapsed ? 'left-full ml-2' : 'left-0'}`}>
                            <div className="px-4 py-3 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                                <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground truncate">{trainerName}</p>
                                {trainerEmail && (
                                    <p className="text-xs text-[#86868B] dark:text-muted-foreground truncate">{trainerEmail}</p>
                                )}
                            </div>
                            <div className="py-1">
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#FF3B30] hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                                >
                                    <LogOut size={16} strokeWidth={1.5} />
                                    Sair
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Modal */}
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </aside>
    )
}
