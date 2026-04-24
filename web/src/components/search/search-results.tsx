'use client'

import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import {
    Users, UserPlus, Dumbbell, Monitor, Wallet,
    FileText, MessageCircle, LayoutDashboard, Calendar,
    Settings, Sparkles, ClipboardList, BarChart3,
} from 'lucide-react'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'

export interface SearchStudent {
    id: string
    name: string
    status: string
}

interface SearchResultsProps {
    students?: SearchStudent[]
    /** Called after a command is selected, so the caller can close its container. */
    onSelect?: () => void
}

/**
 * Shared results list for both the inline search bar and the modal command
 * palette. Renders the `Command.List` contents only — the parent is
 * responsible for wrapping with `<Command>` and `<Command.Input>`.
 */
export function SearchResults({ students = [], onSelect }: SearchResultsProps) {
    const router = useRouter()
    const openChat = useAssistantChatStore(s => s.openChat)

    const run = (command: () => void) => {
        onSelect?.()
        command()
    }

    return (
        <Command.List
            className="max-h-[320px] overflow-y-auto p-2"
            style={{ scrollbarWidth: 'thin' }}
        >
            <Command.Empty className="py-6 text-center text-sm text-[#86868B] dark:text-k-text-tertiary">
                Nenhum resultado encontrado.
            </Command.Empty>

            {students.length > 0 && (
                <Command.Group
                    heading="Alunos"
                    className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#AEAEB2] [&_[cmdk-group-heading]]:dark:text-k-text-quaternary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                >
                    {students.map(student => (
                        <Command.Item
                            key={student.id}
                            value={`aluno ${student.name}`}
                            onSelect={() => run(() => router.push(`/students/${student.id}`))}
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

            <Command.Group
                heading="Ações rápidas"
                className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#AEAEB2] [&_[cmdk-group-heading]]:dark:text-k-text-quaternary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
                <Row
                    icon={<UserPlus className="w-4 h-4 text-[#007AFF] dark:text-blue-400" />}
                    label="Criar novo aluno"
                    shortcut="N"
                    value="criar novo aluno adicionar"
                    onSelect={() => run(() => router.push('/students?new=true'))}
                />
                <Row
                    icon={<Dumbbell className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                    label="Criar programa"
                    value="criar novo programa treino"
                    onSelect={() => run(() => router.push('/programs/new'))}
                />
                <Row
                    icon={<ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                    label="Enviar avaliação"
                    value="enviar avaliação formulário form"
                    onSelect={() => run(() => router.push('/forms'))}
                />
                <Row
                    icon={<Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    label="Vender plano"
                    value="vender plano financeiro cobrança"
                    onSelect={() => run(() => router.push('/financial/subscriptions'))}
                />
                <Row
                    icon={<Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    label="Abrir Sala de Treino"
                    value="sala treino ao vivo live"
                    onSelect={() => run(() => router.push('/training-room'))}
                />
                <Row
                    icon={<Sparkles className="w-4 h-4 text-violet-500" />}
                    label="Abrir Assistente IA"
                    value="assistente ia inteligência ajuda"
                    onSelect={() => run(() => openChat())}
                />
            </Command.Group>

            <Command.Group
                heading="Navegação"
                className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#AEAEB2] [&_[cmdk-group-heading]]:dark:text-k-text-quaternary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
                <Row
                    icon={<LayoutDashboard className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Dashboard"
                    value="dashboard início home"
                    onSelect={() => run(() => router.push('/dashboard'))}
                />
                <Row
                    icon={<Users className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Alunos"
                    value="alunos lista estudantes"
                    onSelect={() => run(() => router.push('/students'))}
                />
                <Row
                    icon={<MessageCircle className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Mensagens"
                    value="mensagens chat conversa"
                    onSelect={() => run(() => router.push('/messages'))}
                />
                <Row
                    icon={<Calendar className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Programas"
                    value="programas templates biblioteca"
                    onSelect={() => run(() => router.push('/programs'))}
                />
                <Row
                    icon={<Dumbbell className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Exercícios"
                    value="exercícios biblioteca"
                    onSelect={() => run(() => router.push('/exercises'))}
                />
                <Row
                    icon={<FileText className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Avaliações"
                    value="avaliações formulários forms"
                    onSelect={() => run(() => router.push('/forms'))}
                />
                <Row
                    icon={<Wallet className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Financeiro"
                    value="financeiro pagamentos cobranças"
                    onSelect={() => run(() => router.push('/financial'))}
                />
                <Row
                    icon={<BarChart3 className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Relatórios"
                    value="relatórios reports"
                    onSelect={() => run(() => router.push('/reports'))}
                />
                <Row
                    icon={<Settings className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary" />}
                    label="Configurações"
                    value="configurações settings perfil"
                    onSelect={() => run(() => router.push('/settings'))}
                />
            </Command.Group>
        </Command.List>
    )
}

function Row({
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
            <span className="shrink-0" aria-hidden="true">{icon}</span>
            <span className="flex-1 font-medium">{label}</span>
            {shortcut && (
                <kbd className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono">
                    {shortcut}
                </kbd>
            )}
        </Command.Item>
    )
}
