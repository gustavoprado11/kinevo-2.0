'use client'

import { useEffect, useState, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
    MessageSquarePlus, Headphones,
    LogOut, BookOpen, ChevronRight, ChevronLeft, Settings, Sparkles,
} from 'lucide-react'
import { useSidebarStore, shouldAutoCollapse } from '@/stores/sidebar-store'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { createClient } from '@/lib/supabase/client'
import { setCachedHomeStyle } from '@/components/assistant/command-bar/command-bar'
import { useAiAccessState } from '@/hooks/use-ai-access'
import { useStudioState } from '@/hooks/use-studio-state'
import { setHomeStyle } from '@/actions/assistant/set-home-style'
import { MAIN_NAV, BIBLIOTECA_NAV as bibliotecaItems, type NavItem } from '@/components/layout/nav-items'
import { ModeToggle } from '@/components/layout/mode-toggle'
import { useCommunicationStore } from '@/stores/communication-store'
import { Building2 } from 'lucide-react'

interface SidebarProps {
    financialBadge?: React.ReactNode
    trainerName: string
    trainerEmail?: string
    trainerAvatarUrl?: string | null
}

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5531999064997'

export function Sidebar({ financialBadge, trainerName, trainerEmail, trainerAvatarUrl }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { isCollapsed, isAutoCollapsed, toggle, setAutoCollapse, expand } = useSidebarStore()
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    // Aberto quando a rota atual é uma das bibliotecas: a sidebar remonta a cada
    // navegação, e sem isso o accordion recolhia e escondia o item ativo.
    const [bibliotecaOpen, setBibliotecaOpen] = useState(
        () => pathname.startsWith('/programs') || pathname.startsWith('/exercises')
    )
    const [profileOpen, setProfileOpen] = useState(false)
    // Gate de IA (mostra o item "Assistente IA" e o ModeToggle) + modo de Início
    // (classic|assistant), que dirige o pill e o destino do "Dashboard". O cache é
    // aplicado pós-hidratação e confirmado por fetch — ver useAiAccessState.
    const { aiAllowed, consultoriaAllowed, homeStyle, setHomeStyle: setHomeStyleState } = useAiAccessState()
    const [switchingAssistant, startSwitch] = useTransition()
    const profileRef = useRef<HTMLDivElement>(null)
    const openChat = useCommunicationStore(s => s.openChat)

    const assistantMode = homeStyle === 'assistant'

    // Estúdios: conta de estúdio esconde Financeiro; gestor ganha o item "Estúdio".
    const { isStudioAccount, isManager } = useStudioState()

    // Consultoria IA é beta fechado (migration 251): fora do allowlist, o item nem
    // existe na navegação. Financeiro some para contas de estúdio (Fase 4).
    const STUDIO_NAV: NavItem = { name: 'Estúdio', href: '/estudio/treinadores', icon: Building2 }
    const navigation: NavItem[] = [
        // Gestor: "Estúdio" no topo (painel do estúdio).
        ...(isManager ? [STUDIO_NAV] : []),
        ...MAIN_NAV.filter(n => {
            if (n.href === '/consultoria' && !consultoriaAllowed) return false
            if (n.href === '/financial' && isStudioAccount) return false
            // Decisão 16/jul: conta de estúdio não tem Marketing (aquisição é
            // pessoal do personal; o estúdio capta fora da plataforma).
            if (n.href === '/marketing' && isStudioAccount) return false
            return true
        }),
    ]

    // Aquece a rota do Assistente p/ a troca de modo ser instantânea.
    useEffect(() => {
        if (aiAllowed) router.prefetch('/assistente')
    }, [aiAllowed, router])

    const initials = trainerName
        .split(' ')
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase()

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Toggle de modo de trabalho (Início): clássico (atual) ⇄ Assistente (Cowork).
    // Navegação ótimista: o pill move na hora (estado+cache) e a preferência é
    // gravada em background — /assistente não depende dela para renderizar.
    const goAssistant = () => {
        setHomeStyleState('assistant')
        setCachedHomeStyle('assistant')
        void setHomeStyle('assistant')
        startSwitch(() => { router.push('/assistente') })
    }

    // Clássico: ?h=classic evita o bounce de volta ao Assistente se a escrita da
    // preferência ainda não sincronizou nesta carga (espelha o AssistantWorkspace).
    const goClassic = () => {
        setHomeStyleState('classic')
        setCachedHomeStyle('classic')
        void setHomeStyle('classic')
        router.push('/dashboard?h=classic')
    }

    const isActive = (hrefOrItem: string | NavItem) => {
        const matchesPath = (path: string) => pathname === path || pathname.startsWith(path + '/')
        if (typeof hrefOrItem === 'string') return matchesPath(hrefOrItem)
        if (matchesPath(hrefOrItem.href)) return true
        if (hrefOrItem.extraActivePrefixes?.some(matchesPath)) return true
        return false
    }

    // Close profile popover on outside click
    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
            setProfileOpen(false)
        }
    }, [])

    useEffect(() => {
        if (profileOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [profileOpen, handleClickOutside])

    // Auto-collapse/expand based on route
    useEffect(() => {
        const shouldCollapse = shouldAutoCollapse(pathname)

        if (shouldCollapse && !isCollapsed) {
            setAutoCollapse(true)
        } else if (!shouldCollapse && isAutoCollapsed) {
            expand()
        }
    }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <aside
            suppressHydrationWarning
            className={`sidebar-container fixed inset-y-0 left-0 z-sidebar flex flex-col border-r border-k-border-subtle bg-surface-sidebar transition-all duration-300 ease-in-out ${
                isCollapsed ? 'w-[68px]' : 'w-64'
            }`}
        >
            {/* Header / Logo */}
            <div className={`pt-8 pb-8 flex items-center ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}>
                <Link href="/dashboard" className="flex items-center gap-3 group overflow-hidden">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo Logo"
                        width={32}
                        height={32}
                        className="rounded-lg shrink-0"
                    />
                    {!isCollapsed && (
                        <span className="text-lg font-semibold text-k-text-primary tracking-tight whitespace-nowrap">
                            Kinevo
                        </span>
                    )}
                </Link>
            </div>

            {/* Edge toggle — collapse/expand handle sitting on the sidebar border */}
            <button
                onClick={toggle}
                title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                className="absolute top-9 -right-3 z-sidebar w-6 h-6 flex items-center justify-center rounded-full border border-k-border-subtle bg-surface-card text-k-text-tertiary hover:text-k-text-secondary hover:bg-surface-inset transition-colors"
            >
                {isCollapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronLeft size={14} strokeWidth={2} />}
            </button>

            {/* Toggle de modo: Clássico ⇄ Assistente — componente compartilhado. */}
            {aiAllowed && !isCollapsed && (
                <ModeToggle
                    active={assistantMode ? 'assistant' : 'classic'}
                    switchingTo={switchingAssistant ? 'assistant' : undefined}
                    onClassic={goClassic}
                    onAssistant={goAssistant}
                />
            )}

            {/* Navigation */}
            <nav className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {navigation.map((item) => {
                    // No modo Assistente o "Dashboard" É o chat (a home conversacional):
                    // reaponta para /assistente e fica ativo lá. Isso NÃO troca o
                    // homeStyle — é só navegação; o modo só muda pelo ModeToggle. Os
                    // demais itens levam às páginas normais, iguais ao Clássico.
                    const isDashboard = item.href === '/dashboard'
                    const href = isDashboard && assistantMode ? '/assistente' : item.href
                    const active = isDashboard && assistantMode ? isActive('/assistente') : isActive(item)
                    const Icon = item.icon
                    return (
                        <div key={item.name} className="relative group/nav">
                            <Link
                                href={href}
                                data-onboarding={item.onboardingId}
                                className={`
                                    relative flex items-center gap-3 py-2 rounded-control text-sm tracking-tight transition-all duration-200 ease-out group
                                    ${isCollapsed ? 'justify-center px-0' : 'px-3'}
                                    ${active
                                        ? 'bg-surface-inset text-k-text-primary font-semibold'
                                        : 'text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover font-medium'
                                    }
                                `}
                            >
                                <Icon
                                    size={16}
                                    strokeWidth={1.7}
                                    className={`shrink-0 transition-colors duration-200 ${active ? 'text-k-text-primary' : 'text-k-text-tertiary group-hover:text-k-text-secondary'}`}
                                />
                                <span
                                    className={`whitespace-nowrap transition-all duration-300 ${
                                        isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 flex-1'
                                    }`}
                                >
                                    {item.name}
                                </span>
                                {!isCollapsed && item.name === 'Financeiro' && financialBadge}
                            </Link>

                            {/* Tooltip — only when collapsed */}
                            {isCollapsed && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                    {item.name}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Assistente IA — FEATURE do modo Clássico: abre o dock à
                    direita SEM trocar o homeStyle e SEM navegar para casca separada.
                    No modo Assistente este item NÃO existe — lá o próprio "Dashboard"
                    já É o chat. O ⌘K segue como atalho da barra de comando. */}
                {aiAllowed && !assistantMode && (() => {
                    const cls = `group relative flex items-center gap-3 w-full py-2 rounded-control text-sm tracking-tight transition-all duration-200 ease-out ${isCollapsed ? 'justify-center px-0' : 'px-3'} font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover`
                    return (
                        <div className="relative group/nav">
                            <button type="button" onClick={() => openChat()} className={cls}>
                                <Sparkles size={16} strokeWidth={1.7} className="shrink-0 text-k-text-tertiary group-hover:text-k-text-secondary transition-colors duration-200" />
                                <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 flex-1 text-left'}`}>
                                    Assistente IA
                                </span>
                            </button>
                            {isCollapsed && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                    Assistente IA
                                </div>
                            )}
                        </div>
                    )
                })()}

                {/* Bibliotecas accordion */}
                <div className="mt-1">
                    <button
                        onClick={() => !isCollapsed && setBibliotecaOpen(b => !b)}
                        className={`group/nav relative flex items-center gap-3 w-full py-2 rounded-control text-sm font-medium transition-all duration-200 text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                        <BookOpen size={16} strokeWidth={1.7} className="shrink-0 text-k-text-tertiary" />
                        {!isCollapsed && (
                            <>
                                <span className="flex-1 text-left">Bibliotecas</span>
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${bibliotecaOpen ? 'rotate-90' : ''}`} />
                            </>
                        )}
                        {isCollapsed && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                Bibliotecas
                            </div>
                        )}
                    </button>

                    {(bibliotecaOpen || isCollapsed) && (
                        <div className={`mt-0.5 space-y-0.5 ${!isCollapsed ? 'pl-3' : ''}`}>
                            {bibliotecaItems.map(item => {
                                const active = isActive(item)
                                return (
                                    <div key={item.name} className="relative group/nav">
                                        <Link
                                            href={item.href}
                                            data-onboarding={item.onboardingId}
                                            className={`relative flex items-center gap-3 w-full py-2 rounded-control text-sm font-medium transition-all duration-200 ${
                                                active
                                                    ? 'bg-surface-inset text-k-text-primary font-semibold'
                                                    : 'text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover'
                                            } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                                        >
                                            <item.icon size={16} strokeWidth={1.7} className={`shrink-0 transition-colors duration-200 ${active ? 'text-k-text-primary' : 'text-k-text-tertiary'}`} />
                                            {!isCollapsed && <span>{item.name}</span>}
                                        </Link>
                                        {isCollapsed && (
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                                                {item.name}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Configurações */}
                <div className="relative group/nav">
                    <Link
                        href="/settings"
                        className={`relative flex items-center gap-3 w-full py-2 rounded-control text-sm font-medium transition-all duration-200 ${
                            isActive('/settings')
                                ? 'bg-surface-inset text-k-text-primary font-semibold'
                                : 'text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover'
                        } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                        <Settings size={16} strokeWidth={1.7} className={`shrink-0 transition-colors ${
                            isActive('/settings')
                                ? 'text-k-text-primary'
                                : 'text-k-text-tertiary group-hover/nav:text-k-text-secondary'
                        }`} />
                        {!isCollapsed && <span>Configurações</span>}
                    </Link>
                    {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            Configurações
                        </div>
                    )}
                </div>
            </nav>

            {/* Footer */}
            <div className={`border-t border-k-border-subtle pt-2 pb-1 space-y-1 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                {/* Feedback */}
                <div className="relative group/nav">
                    <button
                        onClick={() => setFeedbackOpen(true)}
                        className={`flex items-center gap-3 w-full py-2 rounded-control text-sm font-medium transition-all duration-200 ease-out text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover ${
                            isCollapsed ? 'justify-center px-0' : 'px-3'
                        }`}
                    >
                        <MessageSquarePlus size={16} strokeWidth={1.7} className="shrink-0 text-k-text-tertiary group-hover/nav:text-k-text-secondary transition-colors" />
                        <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                            Feedback e Bugs
                        </span>
                    </button>
                    {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            Feedback e Bugs
                        </div>
                    )}
                </div>

                {/* Support */}
                <div className="relative group/nav">
                    <button
                        onClick={() => window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Kinevo.')}`, '_blank')}
                        className={`flex items-center gap-3 w-full py-2 rounded-control text-sm font-medium transition-all duration-200 ease-out text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover ${
                            isCollapsed ? 'justify-center px-0' : 'px-3'
                        }`}
                    >
                        <Headphones size={16} strokeWidth={1.7} className="shrink-0 text-k-text-tertiary group-hover/nav:text-k-text-secondary transition-colors" />
                        <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                            Suporte
                        </span>
                    </button>
                    {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            Suporte
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="border-t border-k-border-subtle my-1" />

                {/* Profile with popover */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setProfileOpen(o => !o)}
                        className={`flex items-center gap-3 w-full py-2 rounded-control hover:bg-glass-bg-hover transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-surface-inset border border-k-border-primary flex items-center justify-center flex-shrink-0">
                            {trainerAvatarUrl ? (
                                <Image src={trainerAvatarUrl} alt="Avatar" width={32} height={32} className="w-8 h-8 rounded-full object-cover" unoptimized />
                            ) : (
                                <span className="text-k-text-secondary text-xs font-semibold">{initials}</span>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-k-text-primary leading-tight truncate">{trainerName}</p>
                                {trainerEmail && (
                                    <p className="text-xs text-k-text-tertiary leading-tight truncate">{trainerEmail}</p>
                                )}
                            </div>
                        )}
                    </button>

                    {/* Collapsed tooltip */}
                    {isCollapsed && !profileOpen && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-modal shadow-lg">
                            {trainerName}
                        </div>
                    )}

                    {/* Profile popover */}
                    {profileOpen && (
                        <div className={`absolute bottom-full mb-2 w-56 bg-surface-card border border-k-border-primary rounded-panel shadow-xl z-modal overflow-hidden ${isCollapsed ? 'left-full ml-2' : 'left-0'}`}>
                            <div className="px-4 py-3 border-b border-k-border-subtle">
                                <p className="text-sm font-medium text-k-text-primary truncate">{trainerName}</p>
                                {trainerEmail && (
                                    <p className="text-xs text-k-text-tertiary truncate">{trainerEmail}</p>
                                )}
                            </div>
                            <div className="py-1">
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-glass-bg-hover transition-colors"
                                >
                                    <LogOut size={16} strokeWidth={1.5} />
                                    Sair
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Modal */}
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </aside>
    )
}
