'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
    Search, Users, UserPlus, Dumbbell, Monitor, Wallet,
    FileText, MessageCircle, LayoutDashboard, Calendar,
    Settings, Sparkles, ClipboardList, BarChart3,
} from 'lucide-react'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

// ── Types ──

interface Student {
    id: string
    name: string
    status: string
}

interface CommandPaletteProps {
    students?: Student[]
}

// ── Component ──

export function CommandPalette({ students = [] }: CommandPaletteProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()
    const openChat = useAssistantChatStore(s => s.openChat)
    const panelRef = useRef<HTMLDivElement>(null)

    // Toggle ⌘K / Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(o => !o)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [open])

    const runCommand = useCallback((command: () => void) => {
        setOpen(false)
        command()
    }, [])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-float" role="dialog" aria-modal="true" aria-label="Busca global">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
                <div
                    ref={panelRef}
                    className="bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-2xl overflow-hidden"
                >
                    <Command label="Busca global">
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                            <Search className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary shrink-0" />
                            <Command.Input
                                placeholder="Buscar alunos, ações, páginas..."
                                className="flex-1 py-3.5 text-sm text-[#1D1D1F] dark:text-k-text-primary bg-transparent outline-none placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary"
                                autoFocus
                            />
                            <kbd className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono">
                                ESC
                            </kbd>
                        </div>

                        {/* Results */}
                        <Command.List className="max-h-[320px] overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
                            <Command.Empty className="py-6 text-center text-sm text-[#86868B] dark:text-k-text-tertiary">
                                Nenhum resultado encontrado.
                            </Command.Empty>

                            {/* Students */}
                            {students.length > 0 && (
                                <Command.Group heading="Alunos" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#AEAEB2] [&_[cmdk-group-heading]]:dark:text-k-text-quaternary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                                    {students.map(student => (
                                        <Command.Item
                                            key={student.id}
                                            value={`aluno ${student.name}`}
                                            onSelect={() => runCommand(() => router.push(`/students/${student.id}`))}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm text-[#1D1D1F] dark:text-k-text-primary data-[selected=true]:bg-[#007AFF]/10 dark:data-[selected=true]:bg-glass-bg-active transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-full bg-[#007AFF]/10 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                                                <span className="text-[11px] font-bold text-[#007AFF] dark:text-violet-400">
                                                    {student.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium">{student.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                                student.status === 'active'
                                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                                                    : 'text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg'
                                            }`}>
                                                {student.status === 'active' ? 'Ativo' : student.status === 'pending' ? 'Pendente' : 'Inativo'}
                                            </span>
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            )}

                            {/* Quick Actions */}
                            <Command.Group heading="Ações rápidas" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#AEAEB2] [&_[cmdk-group-heading]]:dark:text-k-text-quaternary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                                <CommandItem
                                    icon={<UserPlus className="w-4 h-4 text-[#007AFF] dark:text-blue-400" />}
                                    label="Criar novo aluno"
                                    shortcut="N"
                                    value="criar novo aluno adicionar"
                                    onSelect={() => runCommand(() => router.push('/students?new=true'))}
                                />
                                <CommandItem
                                    icon={<Dumbbell className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                                    label="Criar programa"
                                    value="criar novo programa treino"
                                    onSelect={() => runCommand(() => router.push('/programs/new'))}
                                />
                                <CommandItem
                                    icon={<ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                                    label="Enviar avaliação"
                                    value="enviar avaliação formulário form"
                                    onSelect={() => runCommand(() => router.push('/forms'))}
                                />
                                <CommandItem
                                    icon={<Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                                    label="Vender plano"
                                    value="vender plano financeiro cobrança"
                                    onSelect={() => runCommand(() => router.push('/financial/subscriptions'))}
                                />
                                <CommandItem
                                    icon={<Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                    label="Abrir Sala de Treino"
                                    value="sala treino ao vivo live"
                                    onSelect={() => runCommand(() => router.push('/training-room'))}
                                />
                                <CommandItem
                                    icon={<Sparkles className="w-4 h-4 text-violet-500" />}
                                    label="Abrir Assistente IA"
                                    value="assistente ia inteligência ajuda"
                                    onSelect={() => runCommand(() => openChat())}
                                />
                            </Command.Group>

                            {/* Navigation */}
                            <Command.Group heading="Navegação" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#AEAEB2] [&_[cmdk-group-heading]]:dark:text-k-text-quaternary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                                <CommandItem
                                    icon={<LayoutDashboard className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Dashboard"
                                    value="dashboard início home"
                                    onSelect={() => runCommand(() => router.push('/dashboard'))}
                                />
                                <CommandItem
                                    icon={<Users className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Alunos"
                                    value="alunos lista estudantes"
                                    onSelect={() => runCommand(() => router.push('/students'))}
                                />
                                <CommandItem
                                    icon={<MessageCircle className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Mensagens"
                                    value="mensagens chat conversa"
                                    onSelect={() => runCommand(() => router.push('/messages'))}
                                />
                                <CommandItem
                                    icon={<Calendar className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Programas"
                                    value="programas templates biblioteca"
                                    onSelect={() => runCommand(() => router.push('/programs'))}
                                />
                                <CommandItem
                                    icon={<Dumbbell className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Exercícios"
                                    value="exercícios biblioteca"
                                    onSelect={() => runCommand(() => router.push('/exercises'))}
                                />
                                <CommandItem
                                    icon={<FileText className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Avaliações"
                                    value="avaliações formulários forms"
                                    onSelect={() => runCommand(() => router.push('/forms'))}
                                />
                                <CommandItem
                                    icon={<Wallet className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Financeiro"
                                    value="financeiro pagamentos cobranças"
                                    onSelect={() => runCommand(() => router.push('/financial'))}
                                />
                                <CommandItem
                                    icon={<BarChart3 className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Relatórios"
                                    value="relatórios reports"
                                    onSelect={() => runCommand(() => router.push('/reports'))}
                                />
                                <CommandItem
                                    icon={<Settings className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                                    label="Configurações"
                                    value="configurações settings perfil"
                                    onSelect={() => runCommand(() => router.push('/settings'))}
                                />
                            </Command.Group>
                        </Command.List>

                        {/* Footer hints */}
                        <div className="flex items-center gap-4 border-t border-[#E8E8ED] dark:border-k-border-subtle px-4 py-2">
                            <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary flex items-center gap-1">
                                <kbd className="bg-[#F5F5F7] dark:bg-glass-bg px-1 py-0.5 rounded font-mono text-[9px]">↑↓</kbd>
                                navegar
                            </span>
                            <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary flex items-center gap-1">
                                <kbd className="bg-[#F5F5F7] dark:bg-glass-bg px-1 py-0.5 rounded font-mono text-[9px]">↵</kbd>
                                selecionar
                            </span>
                            <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary flex items-center gap-1">
                                <kbd className="bg-[#F5F5F7] dark:bg-glass-bg px-1 py-0.5 rounded font-mono text-[9px]">⌘K</kbd>
                                abrir/fechar
                            </span>
                        </div>
                    </Command>
                </div>
            </div>
        </div>
    )
}

// ── Command Item ──

function CommandItem({
    icon,
    label,
    shortcut,
    value,
    onSelect,
}: {
    icon: React.ReactNode
    label: string
    shortcut?: string
    value: string
    onSelect: () => void
}) {
    return (
        <Command.Item
            value={value}
            onSelect={onSelect}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm text-[#1D1D1F] dark:text-k-text-primary data-[selected=true]:bg-[#007AFF]/10 dark:data-[selected=true]:bg-glass-bg-active transition-colors"
        >
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 font-medium">{label}</span>
            {shortcut && (
                <kbd className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono">
                    {shortcut}
                </kbd>
            )}
        </Command.Item>
    )
}
