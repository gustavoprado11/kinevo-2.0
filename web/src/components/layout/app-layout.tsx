import { Sidebar } from './sidebar'
import { Header } from './header'
import { ThemeSync } from '@/components/theme-sync'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { OnboardingChecklist } from '@/components/onboarding/widgets/onboarding-checklist'
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
    return (
        <div className="min-h-screen bg-background text-foreground">
            <ThemeSync trainerTheme={trainerTheme} />
            {/* Sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="pl-64 bg-surface-primary min-h-screen">
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
        </div>
    )
}
