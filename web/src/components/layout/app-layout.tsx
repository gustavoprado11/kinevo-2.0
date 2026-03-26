'use client'

import { Sidebar } from './sidebar'
import { Header } from './header'
import { FinancialBadge } from './financial-badge'
import { ThemeSync } from '@/components/theme-sync'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { OnboardingChecklist } from '@/components/onboarding/widgets/onboarding-checklist'
import { AssistantChatPanel } from '@/components/assistant/assistant-chat-panel'
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

    return (
        <div className="min-h-screen bg-background text-foreground">
            <ThemeSync trainerTheme={trainerTheme} />
            {/* Sidebar */}
            <Sidebar
                financialBadge={<FinancialBadge />}
            />

            {/* Main content area */}
            <div className={`bg-surface-primary min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-[68px]' : 'pl-64'}`}>
                {/* Header */}
                <Header trainerName={trainerName} trainerEmail={trainerEmail} trainerAvatarUrl={trainerAvatarUrl} />

                {/* Page content */}
                <main className="p-8">
                    <OnboardingProvider initialState={onboardingState ?? null}>
                        {children}
                    </OnboardingProvider>
                </main>
            </div>

            {/* Onboarding Checklist Widget — floating, all pages */}
            <OnboardingChecklist />

            {/* Assistant Chat Panel — global, slides in from right */}
            <AssistantChatPanel />
        </div>
    )
}
