'use client'

/**
 * AssistantSidebar — sidebar ÚNICA do modo Assistente (só na tela de chat),
 * "conversa-first": marca + toggle Clássico/Assistente + "Nova conversa" +
 * navegação recolhida ("Ir para…") + rail de Conversas/Alunos + perfil.
 *
 * Espelha a casca da Sidebar Clássica (components/layout/sidebar.tsx): mesma
 * largura (w-64), setinha de recolher na borda (useSidebarStore) com rail de
 * ícones quando colapsada, e o mesmo componente de perfil (foto + popover Sair).
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
}

export function AssistantSidebar({
    trainerName, trainerEmail, trainerAvatarUrl, students, conversations, activeConversationId, focusedStudentId,
    segment, search, onSegment, onSearch, onHome, onNewConversation, onSelectStudent,
    onSelectConversation, onDeleteConversation, onToggleClassic, switchingClassic = false, fixed = false,
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

    const navLinkClass = 'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm tracking-tight font-medium text-[#6E6E73] dark:text-muted-foreground transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-glass-bg dark:hover:text-foreground'
    const navIconClass = 'h-[18px] w-[18px] shrink-0 text-[#AEAEB2] dark:text-muted-foreground/60 transition group-hover:text-[#6E6E73] dark:group-hover:text-foreground'

    // Botão de recolher na borda (idêntico ao Clássico).
    const edgeToggle = (
        <button onClick={toggle} title={isCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className="absolute top-9 -right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-sidebar text-[#AEAEB2] dark:text-muted-foreground/60 shadow-sm transition-colors hover:bg-[#F5F5F7] hover:text-[#6E6E73] dark:hover:bg-glass-bg dark:hover:text-foreground">
            {isCollapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronLeft size={14} strokeWidth={2} />}
        </button>
    )

    // Perfil (idêntico ao Clássico): foto real + nome/email + popover Sair.
    const profile = (
        <div className="relative" ref={profileRef}>
            <button onClick={() => setProfileOpen((o) => !o)}
                className={`flex w-full items-center gap-3 rounded-lg py-2 transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 ring-2 ring-[#E8E8ED] dark:ring-border">
                    {trainerAvatarUrl
                        ? <Image src={trainerAvatarUrl} alt="Avatar" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                        : <span className="text-xs font-medium text-white">{initials}</span>}
                </div>
                {!isCollapsed && (
                    <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-medium leading-tight text-[#1D1D1F] dark:text-foreground">{trainerName ?? 'Treinador'}</p>
                        {trainerEmail && <p className="truncate text-xs leading-tight text-[#86868B] dark:text-muted-foreground">{trainerEmail}</p>}
                    </div>
                )}
            </button>
            {profileOpen && (
                <div className={`absolute bottom-full z-modal mb-2 w-56 overflow-hidden rounded-xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-xl ${isCollapsed ? 'left-full ml-2' : 'left-0'}`}>
                    <div className="border-b border-[#E8E8ED] dark:border-k-border-subtle px-4 py-3">
                        <p className="truncate text-sm font-medium text-[#1D1D1F] dark:text-foreground">{trainerName ?? 'Treinador'}</p>
                        {trainerEmail && <p className="truncate text-xs text-[#86868B] dark:text-muted-foreground">{trainerEmail}</p>}
                    </div>
                    <div className="py-1">
                        <button onClick={handleLogout}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#FF3B30] transition-colors hover:bg-[#F5F5F7] dark:hover:bg-glass-bg">
                            <LogOut size={16} strokeWidth={1.5} /> Sair
                        </button>
                    </div>
                </div>
            )}
        </div>
    )

    // ── Colapsada: rail de ícones (espelha o Clássico colapsado) ──
    if (isCollapsed) {
        const iconRow = (active: boolean, content: ReactNode, label: string, onClick?: () => void, href?: string) => {
            const cls = `group/nav relative flex h-10 w-10 items-center justify-center rounded-lg transition ${active ? 'bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-glass-bg-active dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 hover:bg-[#F5F5F7] hover:text-[#6E6E73] dark:hover:bg-glass-bg dark:hover:text-foreground'}`
            const tip = (
                <span className="pointer-events-none absolute left-full top-1/2 z-modal ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1D1D1F] dark:bg-white px-2.5 py-1 text-xs font-medium text-white dark:text-[#1D1D1F] opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100">{label}</span>
            )
            return href
                ? <Link href={href} className={cls}>{content}{tip}</Link>
                : <button onClick={onClick} className={cls}>{content}{tip}</button>
        }
        return (
            <aside className={`${positionCls} flex w-[68px] min-w-[68px] flex-col items-center bg-white py-[18px] shadow-[1px_0_0_rgba(0,0,0,0.06)] dark:bg-surface-sidebar/60 dark:backdrop-blur-2xl dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]`}>
                {edgeToggle}
                <Image src="/logo-icon.png" alt="Kinevo" width={34} height={34} className="mb-4 shrink-0 rounded-lg" />
                <button onClick={onNewConversation} title="Nova conversa"
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.65)] transition hover:brightness-[1.06]">
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
                </button>
                <nav className="flex flex-1 flex-col items-center gap-1">
                    {MAIN_NAV.map((n) => {
                        const Icon = n.icon
                        const icon = <Icon size={18} strokeWidth={1.5} />
                        return n.href === '/dashboard'
                            ? <div key={n.href}>{iconRow(isHome, icon, n.name, onHome)}</div>
                            : <div key={n.href}>{iconRow(isPathActive(n), icon, n.name, undefined, n.href)}</div>
                    })}
                    {iconRow(BIBLIOTECA_NAV.some(isPathActive), <BookOpen size={18} strokeWidth={1.5} />, 'Bibliotecas', undefined, BIBLIOTECA_NAV[0]?.href ?? '/programs')}
                    {iconRow(matchPath('/settings'), <Settings size={18} strokeWidth={1.5} />, 'Configurações', undefined, '/settings')}
                </nav>
                <div className="mt-2">{profile}</div>
                <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
            </aside>
        )
    }

    // ── Expandida: conversa-first ──
    return (
        <aside className={`${positionCls} flex w-64 min-w-64 flex-col bg-white shadow-[1px_0_0_rgba(0,0,0,0.06)] dark:bg-surface-sidebar/60 dark:backdrop-blur-2xl dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]`}>
            {edgeToggle}

            {/* Marca */}
            <div className="flex items-center gap-3 px-[18px] pb-3 pt-[20px]">
                <Image src="/logo-icon.png" alt="Kinevo" width={32} height={32} className="shrink-0 rounded-lg" />
                <span className="text-lg font-semibold tracking-tight text-[#1D1D1F] dark:text-foreground">Kinevo</span>
            </div>

            {/* Toggle Clássico/Assistente — componente compartilhado com a Clássica. */}
            <ModeToggle
                active="assistant"
                switchingTo={switchingClassic ? 'classic' : undefined}
                onClassic={onToggleClassic}
                onAssistant={() => { /* já estamos no Assistente */ }}
            />

            {/* Ação primária: Nova conversa — linha estilo "Ir para…" com leve destaque violeta. */}
            <button onClick={onNewConversation}
                className="group mx-4 mb-1 flex items-center gap-3 rounded-lg bg-[#7C3AED]/[0.06] dark:bg-violet-500/10 px-3 py-2 text-sm font-semibold text-[#7C3AED] dark:text-violet-400 transition hover:bg-[#7C3AED]/[0.12] dark:hover:bg-violet-500/20">
                <Plus className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span className="flex-1 text-left">Nova conversa</span>
            </button>

            {/* "Ir para…" — recolhida. Em outras abas, o gatilho mostra a aba ATIVA. */}
            <div className="px-4 pb-1">
                <button onClick={() => setNavOpen((o) => !o)}
                    className={`w-full ${activeNavItem && ActiveIcon
                        ? 'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight text-[#7C3AED] dark:text-violet-400 transition hover:bg-[#7C3AED]/[0.06] dark:hover:bg-violet-500/10'
                        : navLinkClass}`}>
                    {activeNavItem && ActiveIcon ? (
                        <>
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#7C3AED] dark:bg-violet-500" />
                            <ActiveIcon className="h-[18px] w-[18px] shrink-0 text-[#7C3AED] dark:text-violet-400" strokeWidth={1.5} />
                            <span className="flex-1 text-left">{activeNavItem.name}</span>
                        </>
                    ) : (
                        <>
                            <LayoutGrid className={navIconClass} strokeWidth={1.5} />
                            <span className="flex-1 text-left">Ir para…</span>
                        </>
                    )}
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${activeNavItem ? 'text-[#7C3AED]/70 dark:text-violet-400/70' : 'text-[#AEAEB2] dark:text-muted-foreground/60'} ${navOpen ? 'rotate-90' : ''}`} strokeWidth={2} />
                </button>
                {navOpen && (
                    <nav className="mt-0.5 space-y-0.5">
                        {MAIN_NAV.map((n) => {
                            const Icon = n.icon
                            if (n.href === '/dashboard') {
                                return (
                                    <button key={n.href} onClick={onHome}
                                        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm tracking-tight transition ${isHome
                                            ? 'bg-[#7C3AED]/10 font-semibold text-[#7C3AED] dark:bg-glass-bg-active dark:text-violet-400'
                                            : 'font-medium text-[#6E6E73] dark:text-muted-foreground hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-glass-bg dark:hover:text-foreground'}`}>
                                        {isHome && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#7C3AED] dark:bg-violet-500" />}
                                        <Icon className={`h-[18px] w-[18px] shrink-0 ${isHome ? 'text-[#7C3AED] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`} strokeWidth={1.5} />
                                        <span className="flex-1 text-left">{n.name}</span>
                                    </button>
                                )
                            }
                            const act = isPathActive(n)
                            return (
                                <Link key={n.href} href={n.href}
                                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm tracking-tight transition ${act
                                        ? 'bg-[#7C3AED]/10 font-semibold text-[#7C3AED] dark:bg-glass-bg-active dark:text-violet-400'
                                        : 'font-medium text-[#6E6E73] dark:text-muted-foreground hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-glass-bg dark:hover:text-foreground'}`}>
                                    {act && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#7C3AED] dark:bg-violet-500" />}
                                    <Icon className={`h-[18px] w-[18px] shrink-0 ${act ? 'text-[#7C3AED] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`} strokeWidth={1.5} />
                                    <span className="flex-1">{n.name}</span>
                                </Link>
                            )
                        })}

                        <button onClick={() => setBibliotecaOpen((b) => !b)} className={`w-full ${navLinkClass}`}>
                            <BookOpen className={navIconClass} strokeWidth={1.5} />
                            <span className="flex-1 text-left">Bibliotecas</span>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${bibliotecaOpen ? 'rotate-90' : ''}`} strokeWidth={2} />
                        </button>
                        {bibliotecaOpen && (
                            <div className="space-y-0.5 pl-3">
                                {BIBLIOTECA_NAV.map((n) => {
                                    const Icon = n.icon
                                    const act = isPathActive(n)
                                    return (
                                        <Link key={n.href} href={n.href}
                                            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm tracking-tight transition ${act
                                                ? 'bg-[#7C3AED]/10 font-semibold text-[#7C3AED] dark:bg-glass-bg-active dark:text-violet-400'
                                                : 'font-medium text-[#6E6E73] dark:text-muted-foreground hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-glass-bg dark:hover:text-foreground'}`}>
                                            <Icon className={`h-[18px] w-[18px] shrink-0 ${act ? 'text-[#7C3AED] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`} strokeWidth={1.5} />
                                            <span className="flex-1">{n.name}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}

                        {(() => {
                            const act = matchPath('/settings')
                            return (
                                <Link href="/settings"
                                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm tracking-tight transition ${act
                                        ? 'bg-[#7C3AED]/10 font-semibold text-[#7C3AED] dark:bg-glass-bg-active dark:text-violet-400'
                                        : 'font-medium text-[#6E6E73] dark:text-muted-foreground hover:bg-[#F5F5F7] hover:text-[#1D1D1F] dark:hover:bg-glass-bg dark:hover:text-foreground'}`}>
                                    {act && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#7C3AED] dark:bg-violet-500" />}
                                    <Settings className={`h-[18px] w-[18px] shrink-0 ${act ? 'text-[#7C3AED] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-muted-foreground/60 group-hover:text-[#6E6E73] dark:group-hover:text-foreground'}`} strokeWidth={1.5} />
                                    <span className="flex-1">Configurações</span>
                                </Link>
                            )
                        })()}

                        <div className="my-1 h-px bg-[#EDEDF0] dark:bg-k-border-subtle" />

                        <button onClick={() => setFeedbackOpen(true)} className={`w-full ${navLinkClass}`}>
                            <MessageSquarePlus className={navIconClass} strokeWidth={1.5} />
                            <span className="flex-1 text-left">Feedback e Bugs</span>
                        </button>
                        <button
                            onClick={() => window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Kinevo.')}`, '_blank')}
                            className={`w-full ${navLinkClass}`}>
                            <Headphones className={navIconClass} strokeWidth={1.5} />
                            <span className="flex-1 text-left">Suporte</span>
                        </button>
                    </nav>
                )}
            </div>

            {/* Rótulo da seção de conversas */}
            <div className="px-5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.09em] text-[#AEAEB2] dark:text-muted-foreground/60">
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
            />

            {/* Perfil (idêntico ao Clássico) */}
            <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle px-4 py-2">
                {profile}
            </div>

            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </aside>
    )
}
