'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Dumbbell, Calendar, Wallet, Settings, FileText, PanelLeftClose, PanelLeftOpen, MessageSquarePlus, Headphones } from 'lucide-react'
import { useSidebarStore, shouldAutoCollapse } from '@/stores/sidebar-store'
import { FeedbackModal } from '@/components/feedback/feedback-modal'

interface NavItem {
    name: string
    href: string
    icon: React.ElementType
    onboardingId?: string
}

interface SidebarProps {
    financialBadge?: React.ReactNode
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
        name: 'Exercícios',
        href: '/exercises',
        icon: Dumbbell,
        onboardingId: 'sidebar-exercises',
    },
    {
        name: 'Programas',
        href: '/programs',
        icon: Calendar,
        onboardingId: 'sidebar-programs',
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
    {
        name: 'Configurações',
        href: '/settings',
        icon: Settings,
        onboardingId: 'sidebar-settings',
    },
]

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5531999064997'

export function Sidebar({ financialBadge }: SidebarProps = {}) {
    const pathname = usePathname()
    const { isCollapsed, isAutoCollapsed, toggle, setAutoCollapse, expand } = useSidebarStore()
    const [feedbackOpen, setFeedbackOpen] = useState(false)

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
            {/* Header / Logo */}
            <div className={`pt-8 pb-8 flex items-center ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}>
                <Link href="/dashboard" className="flex items-center gap-3 group overflow-hidden">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo Logo"
                        width={32}
                        height={32}
                        className="rounded-lg shrink-0"
                    />
                    <span
                        className={`text-lg font-semibold text-[#1D1D1F] dark:text-foreground/90 tracking-tight whitespace-nowrap transition-all duration-300 ${
                            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                        }`}
                    >
                        Kinevo
                    </span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = item.icon
                    return (
                        <div key={item.name} className="relative group/nav">
                            <Link
                                href={item.href}
                                data-onboarding={item.onboardingId}
                                className={`
                                    relative flex items-center gap-3 py-2 rounded-lg text-sm tracking-tight transition-all duration-200 ease-out group
                                    ${isCollapsed ? 'justify-center px-0' : 'px-3'}
                                    ${isActive
                                        ? 'bg-[#007AFF]/10 dark:bg-glass-bg-active text-[#007AFF] dark:text-foreground font-semibold'
                                        : 'text-[#6E6E73] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg font-medium'
                                    }
                                `}
                            >
                                {isActive && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[#007AFF] dark:bg-violet-500 rounded-r-full" />
                                )}
                                <Icon
                                    size={18}
                                    strokeWidth={1.5}
                                    className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`}
                                />
                                <span
                                    className={`whitespace-nowrap transition-all duration-300 ${
                                        isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 flex-1'
                                    }`}
                                >
                                    {item.name}
                                </span>
                                {!isCollapsed && item.name === 'Financeiro' && financialBadge}
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
            </nav>

            {/* Footer: Feedback & Support */}
            <div className={`border-t border-[#E8E8ED] dark:border-k-border-subtle pt-2 pb-1 space-y-0.5 ${isCollapsed ? 'px-2' : 'px-4'}`}>
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
            </div>

            {/* Toggle Button */}
            <div className={`border-t border-[#E8E8ED] dark:border-k-border-subtle py-3 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                <button
                    onClick={toggle}
                    className={`flex items-center gap-3 w-full py-2 rounded-lg text-sm transition-all duration-200 ease-out text-[#AEAEB2] dark:text-muted-foreground/40 hover:text-[#6E6E73] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${
                        isCollapsed ? 'justify-center px-0' : 'px-3'
                    }`}
                    title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                    {isCollapsed ? (
                        <PanelLeftOpen size={18} strokeWidth={1.5} className="shrink-0" />
                    ) : (
                        <>
                            <PanelLeftClose size={18} strokeWidth={1.5} className="shrink-0" />
                            <span className="whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100">Recolher</span>
                        </>
                    )}
                </button>
            </div>

            {/* Feedback Modal */}
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </aside>
    )
}
