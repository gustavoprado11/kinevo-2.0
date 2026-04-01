'use client'

import { Sidebar } from './sidebar'
import { FinancialBadge } from './financial-badge'
import { ThemeSync } from '@/components/theme-sync'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { OnboardingChecklist } from '@/components/onboarding/widgets/onboarding-checklist'
import dynamic from 'next/dynamic'

const UnifiedCommunicationPanel = dynamic(
    () => import('@/components/communication/unified-panel').then(m => m.UnifiedCommunicationPanel),
    { ssr: false }
)
import { useSidebarStore } from '@/stores/sidebar-store'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'

type ThemePreference = 'light' | 'dark' | 'system'

interface AppLayoutProps {
    children: React.ReactNode
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
    trainerTheme?: ThemePreference | null
    onboardingState?: OnboardingState | null
}

export function AppLayout({ children, trainerName, trainerEmail, trainerAvatarUrl, trainerTheme, onboardingState }: AppLayoutProps) {
    const isCollapsed = useSidebarStore(state => state.isCollapsed)

    // Zustand persist restores from localStorage on mount — server always renders
    // with the default (false). suppressHydrationWarning on the affected element
    // prevents React #418 when persisted state differs from default.
    return (
        <div className="min-h-screen bg-background text-foreground">
            <ThemeSync trainerTheme={trainerTheme} />
            {/* Sidebar */}
            <Sidebar
                financialBadge={<FinancialBadge />}
                trainerName={trainerName}
                trainerEmail={trainerEmail}
                trainerAvatarUrl={trainerAvatarUrl}
            />

            {/* Main content area */}
            <div suppressHydrationWarning className={`bg-surface-primary min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-[68px]' : 'pl-64'}`}>
                {/* Page content */}
                <main className="p-8">
                    <OnboardingProvider initialState={onboardingState ?? null}>
                        {children}
                    </OnboardingProvider>
                </main>
            </div>

            {/* Onboarding Checklist Widget — floating, all pages */}
            <OnboardingChecklist />

            {/* Unified Communication Panel — global, slides in from right */}
            <UnifiedCommunicationPanel />
        </div>
    )
}
