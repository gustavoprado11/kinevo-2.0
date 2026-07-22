'use client'

/**
 * AssistantSidebar — sidebar ÚNICA do modo Assistente (só na tela de chat),
 * "conversa-first": marca + toggle Clássico/Assistente + "Nova conversa" +
 * navegação recolhida ("Ir para…") + rail de Conversas/Alunos + perfil.
 *
 * Espelha a casca da Sidebar Clássica (components/layout/sidebar.tsx): mesma
 * largura (w-64), MESMA transição de recolher (aside único, width animada
 * 300ms — não duas árvores trocadas a seco), hairline no lugar de sombra,
 * ativos em tinta sobre inset (violeta só na ação "Nova conversa") e o mesmo
 * componente de perfil (foto + popover Sair).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutGrid, BookOpen, ChevronRight, ChevronLeft, Settings, Plus,
    MessageSquarePlus, Headphones, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSidebarStore } from '@/stores/sidebar-store'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { MAIN_NAV, BIBLIOTECA_NAV } from '@/components/layout/nav-items'
import { useAiAccessState } from '@/hooks/use-ai-access'
import { ModeToggle } from '@/components/layout/mode-toggle'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { AssistantRail, type SidebarStudent } from './assistant-rail'

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5531999064997'

interface Props {
    trainerName: string | null
    trainerEmail: string | null
    trainerAvatarUrl: string | null
    students: SidebarStudent[]
    conversations: ConversationListItem[]
    activeConversationId: string | null
    focusedStudentId: string | null
    segment: 'alunos' | 'conversas'
    search: string
    onSegment: (s: 'alunos' | 'conversas') => void
    onSearch: (v: string) => void
    onHome: () => void
    onNewConversation: () => void
    onSelectStudent: (id: string) => void
    onSelectConversation: (id: string) => void
    onDeleteConversation?: (id: string) => void
    onToggleClassic: () => void
    switchingClassic?: boolean
    /** Posiciona a sidebar como `fixed` (uso na casca AppLayout, fora da home do chat). */
    fixed?: boolean
    /** Skeleton do Suspense (assistente/loading.tsx): rail em skeleton, sem contadores. */
    loading?: boolean
}

export function AssistantSidebar({
    trainerName, trainerEmail, trainerAvatarUrl, students, conversations, activeConversationId, focusedStudentId,
    segment, search, onSegment, onSearch, onHome, onNewConversation, onSelectStudent,
    onSelectConversation, onDeleteConversation, onToggleClassic, switchingClassic = false, fixed = false,
    loading = false,
}: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const { isCollapsed, toggle } = useSidebarStore()
    const [navOpen, setNavOpen] = useState(false)
    const [bibliotecaOpen, setBibliotecaOpen] = useState(false)
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)

    // Posicionamento: `fixed` na casca AppLayout (outras abas); `relative` (flex) na home do chat.
    const positionCls = fixed ? 'fixed inset-y-0 left-0 z-sidebar' : 'relative'

    // "Home" = estamos na tela do chat sem conversa aberta. Em outras abas (uso fixed),
    // nunca é home — quem fica ativo é a aba da rota atual.
    const onAssistantHome = pathname?.startsWith('/assistente') ?? false
    const isHome = onAssistantHome && activeConversationId === null

    const matchPath = (p: string) => !!pathname && (pathname === p || pathname.startsWith(p + '/'))
    const isPathActive = (item: { href: string; extraActivePrefixes?: string[] }) =>
        matchPath(item.href) || (item.extraActivePrefixes?.some(matchPath) ?? false)

    // Consultoria IA é beta fechado (migration 251) — mesma navegação da Sidebar
    // Clássica: fora do allowlist, o item não existe.
    const { consultoriaAllowed } = useAiAccessState()
    const mainNav = consultoriaAllowed ? MAIN_NAV : MAIN_NAV.filter(n => n.href !== '/consultoria')

    // Aba ativa pela rota (exceto Dashboard, que no Assistente é o próprio chat).
    const activeNavItem = useMemo<{ name: string; href: string; icon: React.ElementType } | null>(() => {
        if (onAssistantHome) return null
        for (const n of MAIN_NAV) if (n.href !== '/dashboard' && isPathActive(n)) return n
        for (const n of BIBLIOTECA_NAV) if (isPathActive(n)) return n
        if (matchPath('/settings')) return { name: 'Configurações', href: '/settings', icon: Settings }
        return null
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, onAssistantHome])
    const ActiveIcon = activeNavItem?.icon

    const initials = (trainerName ?? 'T').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

    useEffect(() => {
        if (!profileOpen) return
        const onClick = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [profileOpen])

    const handleLogout = async () => {
        await createClient().auth.signOut()
        router.push('/login')
    }

    // Idioma do Clássico: ativo = tinta sobre inset; hover quieto; ícones 16/1.7 em terciária.
    const itemActiveCls = 'bg-surface-inset text-k-text-primary font-semibold'
    const itemIdleCls = 'font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-glass-bg-hover'
    const navLinkClass = `group flex items-center gap-3 rounded-control px-3 py-2 text-sm tracking-tight transition-all duration-200 ease-out ${itemIdleCls}`
    const navIconClass = 'h-4 w-4 shrink-0 text-k-text-tertiary transition-colors duration-200 group-hover:text-k-text-secondary'
    const navItemCls = (active: boolean) =>
        `group relative flex items-center gap-3 rounded-control px-3 py-2 text-sm tracking-tight transition-all duration-200 ease-out ${active ? itemActiveCls : itemIdleCls}`
    const navItemIconCls = (active: boolean) =>
        `h-4 w-4 shrink-0 transition-colors duration-200 ${active ? 'text-k-text-primary' : 'text-k-text-quaternary group-hover:text-k-text-secondary'}`

    // Botão de recolher na borda (idêntico ao Clássico).
    const edgeToggle = (
        <button onClick={toggle} title={isCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className="absolute top-9 -right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-k-border-subtle bg-surface-card text-k-text-tertiary transition-colors hover:bg-surface-inset hover:text-k-text-secondary">
            {isCollapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronLeft size={14} strokeWidth={2} />}
        </button>
    )

    // Perfil (idêntico ao Clássico): foto real + nome/email + popover Sair. Avatar neutro.
    const profile = (
        <div className="relative" ref={profileRef}>
            <button onClick={() => setProfileOpen((o) => !o)}
                className={`flex w-full items-center gap-3 rounded-control py-2 transition-colors hover:bg-glass-bg-hover ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-inset ring-1 ring-k-border-subtle overflow-hidden">
                    {trainerAvatarUrl
                        ? <Image src={trainerAvatarUrl} alt="Avatar" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                        : <span className="text-xs font-semibold text-k-text-secondary">{initials}</span>}
                </div>
                {!isCollapsed && (
                    <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-medium leading-tight text-k-text-primary">{trainerName ?? 'Treinador'}</p>
                        {trainerEmail && <p className="truncate text-xs leading-tight text-k-text-tertiary">{trainerEmail}</p>}
                    </div>
                )}
            </button>
            {profileOpen && (
                <div className={`absolute bottom-full z-modal mb-2 w-56 overflow-hidden rounded-panel border border-k-border-subtle bg-surface-card shadow-xl ${isCollapsed ? 'left-full ml-2' : 'left-0'}`}>
                    <div className="border-b border-k-border-subtle px-4 py-3">
                        <p className="truncate text-sm font-medium text-k-text-primary">{trainerName ?? 'Treinador'}</p>
                        {trainerEmail && <p className="truncate text-xs text-k-text-tertiary">{trainerEmail}</p>}
                    </div>
                    <div className="py-1">
                        <button onClick={handleLogout}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 transition-colors hover:bg-surface-inset">
                            <LogOut size={16} strokeWidth={1.5} /> Sair
                        </button>
                    </div>
                </div>
            )}
        </div>
    )

    // Tooltip do modo colapsado (idêntico ao Clássico).
    const tooltip = (label: string) => (
        <span className="pointer-events-none absolute left-full top-1/2 z-modal ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100">{label}</span>
    )

    // ── Conteúdo colapsado: rail de ícones (espelha o Clássico colapsado) ──
    const collapsedContent = (
        <div className="flex h-full w-full flex-col items-center py-[18px]">
            <Image src="/logo-icon.png" alt="Kinevo" width={34} height={34} className="mb-4 shrink-0 rounded-lg" />
            <button onClick={onNewConversation} title="Nova conversa"
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-control bg-primary text-primary-foreground transition hover:opacity-90">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
            <nav className="flex flex-1 flex-col items-center gap-1">
                {(() => {
                    const iconRow = (active: boolean, content: ReactNode, label: string, onClick?: () => void, href?: string) => {
                        const cls = `group/nav relative flex h-10 w-10 items-center justify-center rounded-control transition ${active ? 'bg-surface-inset text-k-text-primary' : 'text-k-text-tertiary hover:bg-glass-bg-hover hover:text-k-text-secondary'}`
                        return href
                            ? <Link href={href} className={cls}>{content}{tooltip(label)}</Link>
                            : <button onClick={onClick} className={cls}>{content}{tooltip(label)}</button>
                    }
                    return (
                        <>
                            {mainNav.map((n) => {
                                const Icon = n.icon
                                const icon = <Icon size={16} strokeWidth={1.7} />
                                return n.href === '/dashboard'
                                    ? <div key={n.href}>{iconRow(isHome, icon, n.name, onHome)}</div>
                                    : <div key={n.href}>{iconRow(isPathActive(n), icon, n.name, undefined, n.href)}</div>
                            })}
                            {iconRow(BIBLIOTECA_NAV.some(isPathActive), <BookOpen size={16} strokeWidth={1.7} />, 'Bibliotecas', undefined, BIBLIOTECA_NAV[0]?.href ?? '/programs')}
                            {iconRow(matchPath('/settings'), <Settings size={16} strokeWidth={1.7} />, 'Configurações', undefined, '/settings')}
                        </>
                    )
                })()}
            </nav>
            <div className="mt-2">{profile}</div>
        </div>
    )

    // ── Conteúdo expandido: conversa-first ──
    const expandedContent = (
        <div className="flex h-full w-full flex-col">
            {/* Marca */}
            <div className="flex items-center gap-3 px-[18px] pb-3 pt-[20px]">
                <Image src="/logo-icon.png" alt="Kinevo" width={32} height={32} className="shrink-0 rounded-lg" />
                <span className="text-lg font-semibold tracking-tight text-k-text-primary">Kinevo</span>
            </div>

            {/* Toggle Clássico/Assistente — componente compartilhado com a Clássica. */}
            <ModeToggle
                active="assistant"
                switchingTo={switchingClassic ? 'classic' : undefined}
                onClassic={onToggleClassic}
                onAssistant={() => { /* já estamos no Assistente */ }}
            />

            {/* Ação primária: Nova conversa — a única linha em violeta na sidebar. */}
            <button onClick={onNewConversation}
                className="group mx-4 mb-1 flex items-center gap-3 rounded-control bg-primary/[0.06] px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/[0.12] dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20">
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="flex-1 text-left">Nova conversa</span>
            </button>

            {/* "Ir para…" — recolhida. Em outras abas, o gatilho mostra a aba ATIVA. */}
            <div className="px-4 pb-1">
                <button onClick={() => setNavOpen((o) => !o)}
                    className={`w-full ${activeNavItem && ActiveIcon ? navItemCls(true) : navLinkClass}`}>
                    {activeNavItem && ActiveIcon ? (
                        <>
                            <ActiveIcon className={navItemIconCls(true)} strokeWidth={1.7} />
                            <span className="flex-1 text-left">{activeNavItem.name}</span>
                        </>
                    ) : (
                        <>
                            <LayoutGrid className={navIconClass} strokeWidth={1.7} />
                            <span className="flex-1 text-left">Ir para…</span>
                        </>
                    )}
                    <ChevronRight className={`h-3.5 w-3.5 text-k-text-quaternary transition-transform ${navOpen ? 'rotate-90' : ''}`} strokeWidth={2} />
                </button>
                {navOpen && (
                    <nav className="mt-0.5 space-y-0.5">
                        {mainNav.map((n) => {
                            const Icon = n.icon
                            if (n.href === '/dashboard') {
                                return (
                                    <button key={n.href} onClick={onHome} className={`w-full ${navItemCls(isHome)}`}>
                                        <Icon className={navItemIconCls(isHome)} strokeWidth={1.7} />
                                        <span className="flex-1 text-left">{n.name}</span>
                                    </button>
                                )
                            }
                            const act = isPathActive(n)
                            return (
                                <Link key={n.href} href={n.href} className={navItemCls(act)}>
                                    <Icon className={navItemIconCls(act)} strokeWidth={1.7} />
                                    <span className="flex-1">{n.name}</span>
                                </Link>
                            )
                        })}

                        <button onClick={() => setBibliotecaOpen((b) => !b)} className={`w-full ${navLinkClass}`}>
                            <BookOpen className={navIconClass} strokeWidth={1.7} />
                            <span className="flex-1 text-left">Bibliotecas</span>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${bibliotecaOpen ? 'rotate-90' : ''}`} strokeWidth={2} />
                        </button>
                        {bibliotecaOpen && (
                            <div className="space-y-0.5 pl-3">
                                {BIBLIOTECA_NAV.map((n) => {
                                    const Icon = n.icon
                                    const act = isPathActive(n)
                                    return (
                                        <Link key={n.href} href={n.href} className={navItemCls(act)}>
                                            <Icon className={navItemIconCls(act)} strokeWidth={1.7} />
                                            <span className="flex-1">{n.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}

                        {(() => {
                            const act = matchPath('/settings')
                            return (
                                <Link href="/settings" className={navItemCls(act)}>
                                    <Settings className={navItemIconCls(act)} strokeWidth={1.7} />
                                    <span className="flex-1">Configurações</span>
                                </Link>
                            )
                        })()}

                        <div className="my-1 h-px bg-k-border-subtle" />

                        <button onClick={() => setFeedbackOpen(true)} className={`w-full ${navLinkClass}`}>
                            <MessageSquarePlus className={navIconClass} strokeWidth={1.7} />
                            <span className="flex-1 text-left">Feedback e Bugs</span>
                        </button>
                        <button
                            onClick={() => window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Kinevo.')}`, '_blank')}
                            className={`w-full ${navLinkClass}`}>
                            <Headphones className={navIconClass} strokeWidth={1.7} />
                            <span className="flex-1 text-left">Suporte</span>
                        </button>
                    </nav>
                )}
            </div>

            {/* Rótulo da seção de conversas — mono micro-caps (idioma dos painéis) */}
            <div className="px-5 pb-1 pt-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-k-text-quaternary">
                Conversas & Alunos
            </div>

            {/* Rail de Conversas/Alunos (embutido) — ocupa o restante */}
            <AssistantRail
                students={students}
                conversations={conversations}
                activeConversationId={activeConversationId}
                focusedStudentId={focusedStudentId}
                segment={segment}
                search={search}
                onSegment={onSegment}
                onSearch={onSearch}
                onSelectStudent={onSelectStudent}
                onSelectConversation={onSelectConversation}
                onDeleteConversation={onDeleteConversation}
                loading={loading}
            />

            {/* Perfil (idêntico ao Clássico) */}
            <div className="border-t border-k-border-subtle px-4 py-2">
                {profile}
            </div>
        </div>
    )

    // Aside ÚNICO: a largura anima (300ms, igual ao Clássico); o conteúdo troca
    // entre o rail de ícones e a versão conversa-first.
    return (
        <aside className={`${positionCls} flex flex-col overflow-visible border-r border-k-border-subtle bg-surface-sidebar transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[68px] min-w-[68px]' : 'w-64 min-w-64'}`}>
            {edgeToggle}
            {isCollapsed ? collapsedContent : expandedContent}
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </aside>
    )
}
