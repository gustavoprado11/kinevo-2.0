import { Sidebar } from './sidebar'
import { Header } from './header'

interface AppLayoutProps {
    children: React.ReactNode
    trainerName: string
    trainerEmail?: string
}

export function AppLayout({ children, trainerName, trainerEmail }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-gray-900">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="pl-60">
                {/* Header */}
                <Header trainerName={trainerName} trainerEmail={trainerEmail} />

                {/* Page content */}
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
