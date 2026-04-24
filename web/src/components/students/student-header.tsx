'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    ChevronLeft, Mail, Calendar, CalendarPlus, Pencil, Key, Trash2,
    MoreHorizontal, Copy, Check, Loader2, MapPin, Wifi,
    Flame, Dumbbell, Activity, TrendingUp, TrendingDown,
    Target, Tag,
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

interface QuickStat {
    label: string
    value: string
    color: 'emerald' | 'blue' | 'violet' | 'amber' | 'red'
    icon?: React.ReactNode
}

interface StudentHeaderProps {
    student: Student
    onEdit: () => void
    onDelete: () => void
    onSchedule?: () => void
    quickStats?: QuickStat[]
    children?: React.ReactNode
}

// ── Status Config ──

const STATUS_CONFIG = {
    active: {
        label: 'Ativo',
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
    },
    inactive: {
        label: 'Inativo',
        dot: 'bg-[#AEAEB2]',
        bg: 'bg-[#F5F5F7] dark:bg-white/5',
        text: 'text-[#6E6E73] dark:text-k-text-tertiary',
    },
    pending: {
        label: 'Pendente',
        dot: 'bg-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
    },
} as const

const STAT_COLORS = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-[#007AFF] dark:text-blue-400' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
    red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-500 dark:text-red-400' },
} as const

// ── Component ──

export function StudentHeader({ student, onEdit, onDelete, onSchedule, quickStats, children }: StudentHeaderProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [newPassword, setNewPassword] = useState<string | null>(null)
    const [resetError, setResetError] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)
    const [showActions, setShowActions] = useState(false)
    const actionsRef = useRef<HTMLDivElement>(null)

    // Close actions dropdown on outside click
    useEffect(() => {
        if (!showActions) return
        const handleClick = (e: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
                setShowActions(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
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

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-none overflow-hidden"
            >
                {/* Main header row */}
                <div className="p-6">
                    <div className="flex items-center gap-5">
                        {/* Back button */}
                        <Link
                            href="/students"
                            aria-label="Voltar para lista de alunos"
                            className="w-9 h-9 rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-[#F5F5F7] dark:bg-white/5 flex items-center justify-center text-[#86868B] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#E8E8ED] dark:hover:bg-white/10 transition-all flex-shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Link>

                        {/* Avatar */}
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white/20 dark:ring-violet-500/20 relative overflow-hidden">
                            {student.avatar_url ? (
                                <Image
                                    src={student.avatar_url}
                                    alt={student.name}
                                    width={64}
                                    height={64}
                                    className="w-16 h-16 rounded-2xl object-cover"
                                    unoptimized
                                />
                            ) : (
                                <>
                                    <span className="text-2xl font-black text-white tracking-tighter">{initials}</span>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                                </>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1.5">
                                <h1 className="text-xl font-bold text-[#1D1D1F] dark:text-k-text-primary tracking-tight truncate">
                                    {student.name}
                                </h1>
                                <div className="flex items-center gap-1.5">
                                    {student.is_trainer_profile && (
                                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                                            Meu Perfil
                                        </span>
                                    )}
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-md ${statusCfg.bg} ${statusCfg.text}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                        {statusCfg.label}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                                        student.modality === 'presential'
                                            ? 'bg-blue-50 dark:bg-blue-500/10 text-[#007AFF] dark:text-blue-400'
                                            : 'bg-[#F5F5F7] dark:bg-white/5 text-[#86868B] dark:text-k-text-tertiary'
                                    }`}>
                                        {student.modality === 'presential'
                                            ? <><MapPin className="w-2.5 h-2.5" /> Presencial</>
                                            : <><Wifi className="w-2.5 h-2.5" /> Online</>
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#86868B] dark:text-k-text-quaternary">
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 opacity-60" aria-hidden="true" />
                                    {student.email}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 opacity-60" aria-hidden="true" />
                                    Desde {new Date(student.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
                                </span>
                            </div>

                            {/* Goal & Tags */}
                            {(student.objective || (student.management_tags && student.management_tags.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    {student.objective && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-semibold">
                                            <Target className="w-3 h-3" aria-hidden="true" />
                                            {student.objective}
                                        </span>
                                    )}
                                    {student.management_tags?.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5F5F7] dark:bg-white/5 text-[#6E6E73] dark:text-k-text-tertiary text-[11px] font-medium"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div data-onboarding="student-header-actions" className="flex items-center gap-2 flex-shrink-0">
                            {onSchedule && (
                                <button
                                    onClick={onSchedule}
                                    className="px-3.5 py-2 text-[11px] font-semibold text-white bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 rounded-xl transition-all flex items-center gap-1.5 shadow-sm dark:shadow-lg dark:shadow-violet-500/20 active:scale-95"
                                >
                                    <CalendarPlus className="w-3.5 h-3.5" />
                                    Agendar
                                </button>
                            )}
                            <button
                                onClick={onEdit}
                                className="px-3.5 py-2 text-[11px] font-semibold text-[#6E6E73] dark:text-k-text-secondary hover:text-[#1D1D1F] dark:hover:text-k-text-primary bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 rounded-xl transition-all flex items-center gap-1.5 border border-[#D2D2D7] dark:border-k-border-primary"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                            </button>

                            {!student.is_trainer_profile && (
                                <div className="relative" ref={actionsRef}>
                                    <button
                                        onClick={() => setShowActions(!showActions)}
                                        aria-label="Mais ações"
                                        className="p-2 text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-[#D2D2D7] dark:hover:border-k-border-primary"
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>

                                    {showActions && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-lg z-20 overflow-hidden"
                                        >
                                            <button
                                                onClick={() => {
                                                    setShowActions(false)
                                                    setNewPassword(null)
                                                    setResetError(null)
                                                    setShowResetConfirm(true)
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-white/5 transition-colors"
                                            >
                                                <Key className="w-3.5 h-3.5 text-violet-500" />
                                                Gerar Nova Senha
                                            </button>
                                            <div className="h-px bg-[#E8E8ED] dark:bg-k-border-subtle mx-2" />
                                            <button
                                                onClick={() => {
                                                    setShowActions(false)
                                                    setShowDeleteConfirm(true)
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Excluir Aluno
                                            </button>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats Bar (legado — prop `quickStats`).
                    A página principal do aluno hoje usa `children` (StudentStatusBar)
                    para consolidar stats + alertas numa única faixa. Esta branch
                    é mantida apenas para callers que ainda passam `quickStats`. */}
                {(quickStats && quickStats.length > 0) && (
                    <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle px-6 py-3">
                        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                            {quickStats.map((stat, i) => {
                                const colors = STAT_COLORS[stat.color]
                                return (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05, duration: 0.3 }}
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg} shrink-0`}
                                    >
                                        {stat.icon && (
                                            <span className={colors.text} aria-hidden="true">{stat.icon}</span>
                                        )}
                                        <span className={`text-xs font-bold ${colors.text}`}>{stat.value}</span>
                                        <span className="text-[10px] text-[#86868B] dark:text-k-text-tertiary font-medium">{stat.label}</span>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Slot de barra de status (usado quando `quickStats` não é passado).
                    Ocupa a largura inteira do header — sem o offset do avatar
                    que o layout anterior tinha — para que a faixa horizontal
                    ocupe toda a largura disponível do card. */}
                {!quickStats && children && (
                    <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle px-6 py-3">
                        {children}
                    </div>
                )}
            </motion.div>

            {/* ── Delete Confirmation Modal ── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} aria-hidden="true" />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                    >
                        <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <Trash2 className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-k-text-primary text-center mb-2">Excluir Aluno?</h3>
                        <p className="text-[#6E6E73] dark:text-k-text-secondary text-sm text-center mb-6">
                            Tem certeza que deseja excluir <span className="text-[#1D1D1F] dark:text-k-text-primary font-medium">{student.name}</span>?
                            Isso removerá o acesso e todo o histórico.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-2.5 bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 text-[#1D1D1F] dark:text-k-text-primary text-sm font-semibold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setShowDeleteConfirm(false); onDelete() }}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isResetting && setShowResetConfirm(false)} aria-hidden="true" />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl p-8 max-w-md w-full shadow-2xl"
                    >
                        {!newPassword ? (
                            <>
                                <div className="w-14 h-14 bg-violet-50 dark:bg-violet-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                                    <Key className="w-6 h-6 text-violet-500" />
                                </div>
                                <h3 className="text-xl font-bold text-[#1D1D1F] dark:text-k-text-primary text-center mb-3">Gerar Nova Senha?</h3>
                                <p className="text-[#6E6E73] dark:text-k-text-secondary text-sm text-center mb-8 px-2">
                                    Tem certeza que deseja redefinir a senha de <span className="text-[#1D1D1F] dark:text-k-text-primary font-medium">{student.name}</span>?
                                    A senha atual deixará de funcionar imediatamente.
                                </p>

                                {resetError && (
                                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                                        {resetError}
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowResetConfirm(false)}
                                        disabled={isResetting}
                                        className="flex-1 px-4 py-3 bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 text-[#1D1D1F] dark:text-k-text-primary text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleResetPassword}
                                        disabled={isResetting}
                                        className="flex-1 px-4 py-3 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        {isResetting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando</>
                                        ) : 'Sim, Gerar'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                                    <Check className="w-6 h-6 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-bold text-[#1D1D1F] dark:text-k-text-primary text-center mb-3">Senha Gerada!</h3>
                                <p className="text-[#6E6E73] dark:text-k-text-secondary text-sm text-center mb-6">
                                    A nova senha de acesso para este aluno é:
                                </p>

                                <div className="bg-[#F5F5F7] dark:bg-white/5 p-5 rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle flex items-center justify-center mb-6">
                                    <span className="font-mono text-2xl font-bold text-[#1D1D1F] dark:text-k-text-primary select-all tracking-wide">
                                        {newPassword}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleCopyPassword}
                                        className={`w-full px-4 py-3.5 ${
                                            isCopied
                                                ? 'bg-emerald-500 hover:bg-emerald-600'
                                                : 'bg-emerald-500 hover:bg-emerald-600'
                                        } text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm`}
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
                                        className="w-full px-4 py-2 text-[#6E6E73] dark:text-k-text-secondary hover:text-[#1D1D1F] dark:hover:text-k-text-primary text-sm font-medium rounded-xl transition-colors"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </>
    )
}
