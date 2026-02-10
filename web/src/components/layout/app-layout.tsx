import { Sidebar } from './sidebar'
import { Header } from './header'
import { ThemeSync } from '@/components/theme-sync'

type ThemePreference = 'light' | 'dark' | 'system'

interface AppLayoutProps {
    children: React.ReactNode
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
    trainerTheme?: ThemePreference | null
}

export function AppLayout({ children, trainerName, trainerEmail, trainerAvatarUrl, trainerTheme }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <ThemeSync trainerTheme={trainerTheme} />
            {/* Sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="pl-60">
                {/* Header */}
                <Header trainerName={trainerName} trainerEmail={trainerEmail} trainerAvatarUrl={trainerAvatarUrl} />

                {/* Page content */}
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
