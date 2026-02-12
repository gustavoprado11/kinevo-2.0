'use client'


import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Dumbbell, Calendar, Settings } from 'lucide-react'

interface NavItem {
    name: string
    href: string
    icon: React.ElementType
}

const navigation: NavItem[] = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        name: 'Alunos',
        href: '/students',
        icon: Users,
    },
    {
        name: 'Exercícios',
        href: '/exercises',
        icon: Dumbbell,
    },
    {
        name: 'Programas',
        href: '/programs',
        icon: Calendar,
    },
    {
        name: 'Configurações',
        href: '/settings',
        icon: Settings,
    },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="sidebar-container fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-k-border-subtle bg-surface-sidebar/60 backdrop-blur-2xl transition-all duration-300">
            {/* Header / Logo */}
            <div className="px-6 pt-8 pb-8 flex items-center">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-glass-bg-active group-hover:bg-glass-bg-hover transition-colors">
                        <Image
                            src="/logo-icon.png"
                            alt="Kinevo Logo"
                            width={20}
                            height={20}
                            className="opacity-90"
                        />
                    </div>
                    <span className="text-lg font-semibold text-foreground/90 tracking-tight">Kinevo</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`
                                relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium tracking-tight transition-all duration-200 ease-out group
                                ${isActive
                                    ? 'bg-glass-bg-active text-foreground'
                                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-glass-bg'
                                }
                            `}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-violet-500 rounded-r-full shadow-sm shadow-purple-500/50" />
                            )}
                            <Icon
                                size={18}
                                strokeWidth={1.5}
                                className={`transition-colors duration-200 ${isActive ? 'text-violet-400' : 'text-muted-foreground/60 group-hover:text-foreground'}`}
                            />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="px-6 py-6 border-t border-k-border-subtle">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground/40 tracking-wider uppercase">
                    Kinevo 2.0
                </div>
            </div>
        </aside>
    )
}
