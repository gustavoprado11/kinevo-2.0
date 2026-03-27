'use client'

import { Sidebar } from './sidebar'
import { FinancialBadge } from './financial-badge'
import { ThemeSync } from '@/components/theme-sync'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { OnboardingChecklist } from '@/components/onboarding/widgets/onboarding-checklist'
import dynamic from 'next/dynamic'

const AssistantChatPanel = dynamic(
    () => import('@/components/assistant/assistant-chat-panel').then(m => m.AssistantChatPanel),
    { ssr: false }
)
const CommandPaletteWrapper = dynamic(
    () => import('@/components/command-palette').then(m => m.CommandPalette),
    { ssr: false }
)
import { useSidebarStore } from '@/stores/sidebar-store'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'

type ThemePreference = 'light' | 'dark' | 'system'

interface Student {
    id: string
    name: string
    status: string
}

interface AppLayoutProps {
    children: React.ReactNode
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
    trainerTheme?: ThemePreference | null
    onboardingState?: OnboardingState | null
    students?: Student[]
}

export function AppLayout({ children, trainerName, trainerEmail, trainerAvatarUrl, trainerTheme, onboardingState, students }: AppLayoutProps) {
    const isCollapsed = useSidebarStore(state => state.isCollapsed)
    const isChatOpen = useAssistantChatStore(state => state.isOpen)

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

            {/* Main content area — shrinks on xl+ when chat panel is open */}
            <div suppressHydrationWarning className={`bg-surface-primary min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-[68px]' : 'pl-64'} ${isChatOpen ? 'xl:pr-[420px]' : ''}`}>
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

            {/* Command Palette — global, ⌘K to open */}
            <CommandPaletteWrapper students={students} />
        </div>
    )
}
