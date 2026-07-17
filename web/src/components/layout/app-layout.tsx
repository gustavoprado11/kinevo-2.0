'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { AssistantNavSidebar } from './assistant-nav-sidebar'
import { FinancialBadge } from './financial-badge'
import { ThemeSync } from '@/components/theme-sync'
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider'
import { OnboardingChecklist } from '@/components/onboarding/widgets/onboarding-checklist'
import dynamic from 'next/dynamic'

const UnifiedCommunicationPanel = dynamic(
    () => import('@/components/communication/unified-panel').then(m => m.UnifiedCommunicationPanel),
    { ssr: false }
)
const CommandPaletteWrapper = dynamic(
    () => import('@/components/command-palette').then(m => m.CommandPalette),
    { ssr: false }
)
import { useSidebarStore } from '@/stores/sidebar-store'
import { useCommunicationStore } from '@/stores/communication-store'
import { useAiAccessState } from '@/hooks/use-ai-access'
import type {
    OnboardingState,
    TrainerModalityFocus,
} from '@kinevo/shared/types/onboarding'

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
    trainerModalityFocus?: TrainerModalityFocus
    students?: Student[]
    /**
     * Classe do <main>. Default `p-8`. A home conversacional do Assistente passa
     * full-bleed (`p-0 h-[100dvh] overflow-hidden`) para gerenciar a própria
     * altura/scroll dentro da casca única.
     */
    mainClassName?: string
}

// A home do Assistente é a conversa em tela cheia: lá o dock NÃO aparece (seria
// um segundo chat). Nas demais telas o dock é a apresentação "docked".
const ASSISTANT_HOME_PREFIX = '/assistente'
// Marca, por sessão do navegador, que o treinador fechou o dock no modo
// Assistente — para não reabri-lo automaticamente a cada navegação/reload.
const DOCK_DISMISSED_KEY = 'kinevo:assistant-dock-dismissed'

export function AppLayout({ children, trainerName, trainerEmail, trainerAvatarUrl, trainerTheme, onboardingState, trainerModalityFocus, students, mainClassName = 'p-8' }: AppLayoutProps) {
    const pathname = usePathname()
    const isCollapsed = useSidebarStore(state => state.isCollapsed)
    const isChatOpen = useCommunicationStore(state => state.isOpen)
    const closePanel = useCommunicationStore(state => state.closePanel)

    const isAssistantHome = pathname?.startsWith(ASSISTANT_HOME_PREFIX) ?? false

    // Modo de trabalho (classic|assistant). Só o ModeToggle altera o homeStyle —
    // aqui é leitura. O cache entra pós-hidratação (ver useAiAccessState): ler no
    // lazy init trocava a sidebar INTEIRA na hidratação, contra o HTML do servidor.
    const { aiAllowed, homeStyle } = useAiAccessState()
    const assistantMode = aiAllowed && homeStyle === 'assistant'

    // Auto-abertura do dock desativada: no modo Assistente a AssistantNavSidebar
    // (rail persistente em todas as abas) já é a navegação para o chat. O dock
    // segue disponível sob demanda (launcher / ⌘K), como overlay.
    const handleDockDismiss = () => {
        try { sessionStorage.setItem(DOCK_DISMISSED_KEY, '1') } catch { /* noop */ }
        closePanel()
    }

    // Sem reserva de espaço: o dock, quando aberto manualmente, fica como overlay.
    const docked = false
    const reserveChatSpace = docked && isChatOpen

    // Zustand persist restores from localStorage on mount — server always renders
    // with the default (false). suppressHydrationWarning on the affected element
    // prevents React #418 when persisted state differs from default.
    return (
        <div className="min-h-screen bg-background text-foreground">
            <ThemeSync trainerTheme={trainerTheme} />
            {/* Sidebar — global no Clássico; no Assistente, a sidebar conversa-first
                persiste em TODAS as abas (com a aba atual em destaque). */}
            {assistantMode ? (
                <AssistantNavSidebar
                    trainerName={trainerName}
                    trainerEmail={trainerEmail}
                    trainerAvatarUrl={trainerAvatarUrl}
                />
            ) : (
                <Sidebar
                    financialBadge={<FinancialBadge />}
                    trainerName={trainerName}
                    trainerEmail={trainerEmail}
                    trainerAvatarUrl={trainerAvatarUrl}
                />
            )}

            {/* Main content area — shrinks on xl+ when the docked chat is open */}
            <div suppressHydrationWarning className={`bg-surface-primary min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-[68px]' : 'pl-64'} ${reserveChatSpace ? 'xl:pr-[420px]' : ''}`}>
                {/* Page content */}
                <main className={mainClassName}>
                    <OnboardingProvider initialState={onboardingState ?? null} trainerModalityFocus={trainerModalityFocus}>
                        {children}
                    </OnboardingProvider>
                </main>
            </div>

            {/* Onboarding Checklist Widget — floating, all pages */}
            <OnboardingChecklist />

            {/* Dock do Assistente — painel ancorado à direita. Some na home (que já
                é o chat em tela cheia). Docked (persistente, sem backdrop) no modo
                Assistente; overlay no Clássico. */}
            {!isAssistantHome && (
                <UnifiedCommunicationPanel docked={docked} onDockDismiss={handleDockDismiss} />
            )}

            {/* Command Palette — global, ⌘K to open */}
            <CommandPaletteWrapper students={students} />

            {/* Fase 2 do redesign: o launcher flutuante (FAB) saiu — o dock do
                Assistente abre pelo item da sidebar e pela paleta ⌘K. */}
        </div>
    )
}
