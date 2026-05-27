'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Inbox, Globe } from 'lucide-react'

const TABS = [
    { href: '/marketing', label: 'Visão geral', icon: BarChart3, exact: true },
    { href: '/marketing/leads', label: 'Leads', icon: Inbox, exact: false },
    { href: '/marketing/landing', label: 'Landing', icon: Globe, exact: false },
] as const

export function MarketingTabs() {
    const pathname = usePathname()
    return (
        <div className="mx-auto max-w-[1500px] -mb-px">
            <nav className="flex flex-wrap gap-1 border-b border-k-border-subtle">
                {TABS.map((t) => {
                    const active = t.exact
                        ? pathname === t.href
                        : pathname === t.href || pathname.startsWith(`${t.href}/`)
                    const Icon = t.icon
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            className={
                                active
                                    ? 'inline-flex items-center gap-1.5 border-b-2 border-violet-600 px-3 py-2.5 text-sm font-bold text-violet-700 dark:text-violet-300 -mb-px'
                                    : 'inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-k-text-tertiary hover:text-k-text-secondary'
                            }
                        >
                            <Icon size={14} strokeWidth={2} />
                            {t.label}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
