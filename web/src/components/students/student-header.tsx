'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import {
    ChevronLeft, CalendarPlus, Pencil, Key, Trash2,
    MoreHorizontal, Copy, Check, Loader2, MapPin, Wifi,
    Compass, Stethoscope, MessageCircle,
} from 'lucide-react'
import { resetStudentPassword } from '@/app/students/[id]/actions/reset-student-password'

// ── Types ──

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality?: 'online' | 'presential'
    avatar_url?: string | null
    created_at: string
    is_trainer_profile?: boolean | null
    objective?: string | null
    management_tags?: string[] | null
}

interface StudentHeaderProps {
    student: Student
    onEdit: () => void
    onDelete: () => void
    onSchedule?: () => void
    /** Abre o painel de mensagens na thread do aluno (some p/ aluno de colega). */
    onMessage?: () => void
    onStartTour?: () => void
    /** Inicia o fluxo de Consultoria IA (anamnese → rascunho IA → validação CREF). */
    onConsultoria?: () => void
}

// ── Status Config — ponto + texto, sem pílula ──

const STATUS_CONFIG = {
    active: { label: 'Ativo', dot: 'bg-emerald-500' },
    inactive: { label: 'Inativo', dot: 'bg-k-text-quaternary' },
    pending: { label: 'Pendente', dot: 'bg-amber-500' },
} as const

// ── Component ──
//
// Redesign "ferramenta profissional": o header deixou de ser um card com
// sombra e virou cabeçalho de página no canvas — avatar neutro, status como
// ponto + texto, metadados numa linha quieta e ações à direita todas quietas
// (a ação violeta da tela mora no card do programa).

export function StudentHeader({ student, onEdit, onDelete, onSchedule, onMessage, onStartTour, onConsultoria }: StudentHeaderProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [newPassword, setNewPassword] = useState<string | null>(null)
    const [resetError, setResetError] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)
    const [showActions, setShowActions] = useState(false)
    const [menuCoords, setMenuCoords] = useState<{ top: number; right: number } | null>(null)
    const actionsRef = useRef<HTMLDivElement>(null)
    const triggerBtnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Position the actions menu relative to the trigger. Portal keeps it above
    // any stacking context created by the page grid.
    const positionMenu = () => {
        const rect = triggerBtnRef.current?.getBoundingClientRect()
        if (rect) setMenuCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }

    // Close actions dropdown on outside click; keep it anchored on scroll/resize
    useEffect(() => {
        if (!showActions) return
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node
            if (actionsRef.current?.contains(target)) return
            if (menuRef.current?.contains(target)) return
            setShowActions(false)
        }
        document.addEventListener('mousedown', handleClick)
        window.addEventListener('resize', positionMenu)
        window.addEventListener('scroll', positionMenu, true)
        return () => {
            document.removeEventListener('mousedown', handleClick)
            window.removeEventListener('resize', positionMenu)
            window.removeEventListener('scroll', positionMenu, true)
        }
    }, [showActions])

    const handleResetPassword = async () => {
        setIsResetting(true)
        setResetError(null)
        try {
            const result = await resetStudentPassword(student.id)
            if (result.success && result.newPassword) {
                setNewPassword(result.newPassword)
            } else {
                setResetError(result.error || 'Erro ao gerar nova senha.')
            }
        } catch {
            setResetError('Erro inesperado ao gerar senha.')
        } finally {
            setIsResetting(false)
        }
    }

    const handleCopyPassword = () => {
        if (!newPassword) return
        const message = `Olá ${student.name.split(' ')[0]}!\n\nSua senha de acesso ao aplicativo Kinevo foi redefinida.\n\nSua nova senha é: *${newPassword}*\n\nBaixe o app e faça o login com seu e-mail (${student.email}).`
        navigator.clipboard.writeText(message)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    const statusCfg = STATUS_CONFIG[student.status]

    const initials = student.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    const tags = Array.isArray(student.management_tags) ? student.management_tags : []
    const quietBtn = 'inline-flex items-center gap-1.5 rounded-control border border-k-border-primary bg-surface-card px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary transition-colors'
    const menuItem = 'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-k-text-primary hover:bg-surface-inset transition-colors'

    return (
        <>
            <div>
                <Link
                    href="/students"
                    className="inline-flex items-center gap-1 text-xs text-k-text-tertiary hover:text-k-text-primary transition-colors mb-3"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Alunos
                </Link>

                <div className="flex items-center gap-4">
                    {/* Avatar — neutro: iniciais na tinta sobre inset, sem gradiente */}
                    <div className="w-11 h-11 rounded-panel bg-surface-inset border border-k-border-subtle flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {student.avatar_url ? (
                            <Image
                                src={student.avatar_url}
                                alt={student.name}
                                width={44}
                                height={44}
                                className="w-11 h-11 object-cover"
                                unoptimized
                            />
                        ) : (
                            <span className="text-sm font-bold text-k-text-secondary">{initials}</span>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <h1 className="text-[22px] leading-tight font-bold text-k-text-primary tracking-tight truncate">
                                {student.name}
                            </h1>
                            {student.is_trainer_profile && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-surface-inset text-k-text-tertiary border border-k-border-subtle flex-shrink-0">
                                    Meu Perfil
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-k-text-tertiary">
                            <span className="inline-flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                {statusCfg.label}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                {student.modality === 'presential'
                                    ? <><MapPin className="w-3 h-3 opacity-60" aria-hidden="true" /> Presencial</>
                                    : <><Wifi className="w-3 h-3 opacity-60" aria-hidden="true" /> Online</>
                                }
                            </span>
                            {student.objective && <span className="text-k-text-secondary">{student.objective}</span>}
                            {tags.map((tag) => (
                                <span key={tag}>{tag}</span>
                            ))}
                            <span className="truncate">{student.email}</span>
                            <span className="font-mono text-[10.5px] text-k-text-quaternary">
                                desde {new Date(student.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }).replace('.', '')}
                            </span>
                        </div>
                    </div>

                    {/* Actions — todas quietas */}
                    <div data-onboarding="student-header-actions" className="flex items-center gap-2 flex-shrink-0">
                        {onMessage && (
                            <button onClick={onMessage} className={quietBtn}>
                                <MessageCircle className="w-3.5 h-3.5" />
                                Mensagem
                            </button>
                        )}
                        {onSchedule && (
                            <button onClick={onSchedule} className={quietBtn}>
                                <CalendarPlus className="w-3.5 h-3.5" />
                                Agendar
                            </button>
                        )}
                        <button onClick={onEdit} className={quietBtn}>
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                        </button>

                        {!student.is_trainer_profile && (
                            <div className="relative" ref={actionsRef}>
                                <button
                                    ref={triggerBtnRef}
                                    onClick={() => {
                                        if (!showActions) positionMenu()
                                        setShowActions(!showActions)
                                    }}
                                    aria-label="Mais ações"
                                    className="p-2 rounded-control border border-k-border-primary bg-surface-card text-k-text-tertiary hover:bg-surface-inset hover:text-k-text-primary transition-colors"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>

                                {showActions && menuCoords && createPortal(
                                    <div
                                        ref={menuRef}
                                        style={{ top: menuCoords.top, right: menuCoords.right }}
                                        className="fixed w-48 rounded-panel border border-k-border-primary bg-surface-card shadow-lg z-dropdown overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                    >
                                        {onStartTour && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setShowActions(false)
                                                        onStartTour()
                                                    }}
                                                    className={menuItem}
                                                >
                                                    <Compass className="w-3.5 h-3.5 text-k-text-tertiary" />
                                                    Tour rápido
                                                </button>
                                                <div className="h-px bg-k-border-subtle mx-2" />
                                            </>
                                        )}
                                        {onConsultoria && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setShowActions(false)
                                                        onConsultoria()
                                                    }}
                                                    className={menuItem}
                                                >
                                                    <Stethoscope className="w-3.5 h-3.5 text-k-text-tertiary" />
                                                    Consultoria IA
                                                </button>
                                                <div className="h-px bg-k-border-subtle mx-2" />
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                setShowActions(false)
                                                setNewPassword(null)
                                                setResetError(null)
                                                setShowResetConfirm(true)
                                            }}
                                            className={menuItem}
                                        >
                                            <Key className="w-3.5 h-3.5 text-k-text-tertiary" />
                                            Gerar Nova Senha
                                        </button>
                                        <div className="h-px bg-k-border-subtle mx-2" />
                                        <button
                                            onClick={() => {
                                                setShowActions(false)
                                                setShowDeleteConfirm(true)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Excluir Aluno
                                        </button>
                                    </div>,
                                    document.body
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Delete Confirmation Modal ── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} aria-hidden="true" />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-k-text-primary mb-2">Excluir aluno?</h3>
                        <p className="text-k-text-secondary text-sm mb-6">
                            Tem certeza que deseja excluir <span className="text-k-text-primary font-medium">{student.name}</span>?
                            Isso removerá o acesso e todo o histórico.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-2.5 bg-surface-inset hover:bg-surface-inset/70 text-k-text-primary text-sm font-semibold rounded-control transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setShowDeleteConfirm(false); onDelete() }}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-control transition-colors"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isResetting && setShowResetConfirm(false)} aria-hidden="true" />
                    <div className="relative bg-surface-card border border-k-border-primary rounded-panel p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        {!newPassword ? (
                            <>
                                <h3 className="text-lg font-bold text-k-text-primary mb-2">Gerar nova senha?</h3>
                                <p className="text-k-text-secondary text-sm mb-6">
                                    Tem certeza que deseja redefinir a senha de <span className="text-k-text-primary font-medium">{student.name}</span>?
                                    A senha atual deixará de funcionar imediatamente.
                                </p>

                                {resetError && (
                                    <div className="mb-4 p-3 border border-red-500/30 border-l-2 border-l-red-500 rounded-control text-red-500 text-sm">
                                        {resetError}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowResetConfirm(false)}
                                        disabled={isResetting}
                                        className="flex-1 px-4 py-2.5 bg-surface-inset hover:bg-surface-inset/70 text-k-text-primary text-sm font-semibold rounded-control transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleResetPassword}
                                        disabled={isResetting}
                                        className="flex-1 px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isResetting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando</>
                                        ) : 'Sim, Gerar'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold text-k-text-primary mb-2">Senha gerada</h3>
                                <p className="text-k-text-secondary text-sm mb-5">
                                    A nova senha de acesso para este aluno é:
                                </p>

                                <div className="bg-surface-inset p-5 rounded-control border border-k-border-subtle flex items-center justify-center mb-6">
                                    <span className="font-mono text-2xl font-bold text-k-text-primary select-all tracking-wide">
                                        {newPassword}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleCopyPassword}
                                        className="w-full px-4 py-3 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity flex items-center justify-center gap-2"
                                    >
                                        {isCopied ? (
                                            <><Check className="w-4 h-4" /> Copiado!</>
                                        ) : (
                                            <><Copy className="w-4 h-4" /> Copiar para WhatsApp</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowResetConfirm(false)
                                            setNewPassword(null)
                                            setIsCopied(false)
                                        }}
                                        className="w-full px-4 py-2 text-k-text-tertiary hover:text-k-text-primary text-sm font-medium rounded-control transition-colors"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
