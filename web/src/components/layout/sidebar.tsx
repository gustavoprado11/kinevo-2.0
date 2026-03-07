'use client'


import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Dumbbell, Calendar, Wallet, Settings, FileText } from 'lucide-react'

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

export function Sidebar({ financialBadge }: SidebarProps = {}) {
    const pathname = usePathname()

    return (
        <aside className="sidebar-container fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-sidebar/60 dark:backdrop-blur-2xl transition-all duration-300">
            {/* Header / Logo */}
            <div className="px-6 pt-8 pb-8 flex items-center">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo Logo"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-lg font-semibold text-[#1D1D1F] dark:text-foreground/90 tracking-tight">Kinevo</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            data-onboarding={item.onboardingId}
                            className={`
                                relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm tracking-tight transition-all duration-200 ease-out group
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
                                className={`transition-colors duration-200 ${isActive ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`}
                            />
                            <span className="flex-1">{item.name}</span>
                            {item.name === 'Financeiro' && financialBadge}
                        </Link>
                    )
                })}
            </nav>

        </aside>
    )
}
