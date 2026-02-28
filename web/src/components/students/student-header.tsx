'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { resetStudentPassword } from '@/app/students/[id]/actions/reset-student-password'

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
}

interface StudentHeaderProps {
    student: Student
    onEdit: () => void
    onDelete: () => void
    children?: React.ReactNode
}

export function StudentHeader({ student, onEdit, onDelete, children }: StudentHeaderProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [newPassword, setNewPassword] = useState<string | null>(null)
    const [resetError, setResetError] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)

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
        } catch (error) {
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

    const getStatusConfig = (status: Student['status']) => {
        const config = {
            active: {
                label: 'Ativo',
                classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            },
            inactive: {
                label: 'Inativo',
                classes: 'bg-muted/60 text-muted-foreground border-border/70',
            },
            pending: {
                label: 'Pendente',
                classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            },
        }
        return config[status]
    }

    const statusConfig = getStatusConfig(student.status)

    // Get initials for avatar
    const initials = student.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    return (
        <>
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-5">
                <div className="flex items-center gap-5">
                    {/* Back button */}
                    <Link
                        href="/students"
                        className="w-9 h-9 rounded-xl bg-glass-bg border border-k-border-primary flex items-center justify-center text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg-active transition-all flex-shrink-0"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>

                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-xl shadow-black/40 ring-2 ring-violet-500/20 relative overflow-hidden">
                        {student.avatar_url ? (
                            <Image
                                src={student.avatar_url}
                                alt={student.name}
                                width={56}
                                height={56}
                                className="w-14 h-14 rounded-full object-cover"
                                unoptimized
                            />
                        ) : (
                            <>
                                <span className="text-xl font-black text-white tracking-tighter">{initials}</span>
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                            </>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-black text-white tracking-tight truncate">{student.name}</h1>
                            <div className="flex items-center gap-2">
                                {student.is_trainer_profile && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                        Meu Perfil
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${statusConfig.classes}`}>
                                    {statusConfig.label}
                                </span>
                                {student.modality === 'presential' ? (
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-violet-500/10 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                                        Presencial
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-glass-bg text-k-text-tertiary border border-k-border-primary flex items-center gap-1">
                                        Online
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-medium">
                            <div className="flex items-center gap-2 text-k-text-quaternary">
                                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="hover:text-k-text-secondary transition-colors cursor-default">{student.email}</span>
                            </div>

                            <div className="flex items-center gap-2 text-k-text-quaternary">
                                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>
                                    Desde {new Date(student.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div data-onboarding="student-header-actions" className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={onEdit}
                            className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all flex items-center gap-2 border border-k-border-subtle"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
                        </button>

                        {!student.is_trainer_profile && (
                            <>
                                <button
                                    onClick={() => {
                                        setNewPassword(null)
                                        setResetError(null)
                                        setShowResetConfirm(true)
                                    }}
                                    className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-k-text-tertiary hover:text-violet-400 hover:bg-violet-400/10 rounded-xl transition-all flex items-center gap-2 border border-k-border-subtle hover:border-violet-400/20"
                                    title="Gerar Nova Senha"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    Nova Senha
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="p-2.5 text-k-text-quaternary hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all border border-transparent hover:border-red-400/20"
                                    title="Excluir Aluno"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Summary line (injected via children) */}
                {children && (
                    <div className="mt-3 ml-[92px]">
                        {children}
                    </div>
                )}
            </div>

            {/* Confirmation Modal — outside backdrop-blur container to avoid stacking context issues */}
            {
                showDeleteConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
                        <div className="relative bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-foreground text-center mb-2">Excluir Aluno?</h3>
                            <p className="text-muted-foreground text-sm text-center mb-6">
                                Tem certeza que deseja excluir <span className="text-foreground font-medium">{student.name}</span>?
                                Isso removerá o acesso e todo o histórico. Essa ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-4 py-2 bg-muted hover:bg-muted text-foreground text-sm font-medium rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false)
                                        onDelete()
                                    }}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-foreground text-sm font-medium rounded-xl transition-colors"
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Reset Password Modal */}
            {
                showResetConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isResetting && setShowResetConfirm(false)} />
                        <div className="relative bg-[#09090b] border border-[#1f1f22] rounded-3xl p-8 max-w-md w-full shadow-2xl">
                            {!newPassword ? (
                                <>
                                    <div className="w-14 h-14 bg-[#18181b] rounded-full flex items-center justify-center mb-6 mx-auto border border-[#27272a]">
                                        <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white text-center mb-3">Gerar Nova Senha?</h3>
                                    <p className="text-[#a1a1aa] text-base text-center mb-8 px-2">
                                        Tem certeza que deseja redefinir a senha de <span className="text-white font-medium">{student.name}</span>?
                                        A senha atual deixará de funcionar imediatamente.
                                    </p>

                                    {resetError && (
                                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                                            {resetError}
                                        </div>
                                    )}

                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setShowResetConfirm(false)}
                                            disabled={isResetting}
                                            className="flex-1 px-4 py-3.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-white text-sm font-semibold rounded-2xl transition-colors disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleResetPassword}
                                            disabled={isResetting}
                                            className="flex-1 px-4 py-3.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
                                        >
                                            {isResetting ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Gerando
                                                </>
                                            ) : 'Sim, Gerar'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 bg-[#052e16] rounded-full flex items-center justify-center mb-6 mx-auto">
                                        <svg className="w-6 h-6 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white text-center mb-3">Senha Gerada!</h3>
                                    <p className="text-[#a1a1aa] text-base text-center mb-8">
                                        A nova senha de acesso para este aluno é:
                                    </p>

                                    <div className="bg-[#121214] p-5 rounded-2xl border border-[#27272a] flex items-center justify-center mb-8 shadow-inner">
                                        <span className="font-mono text-[28px] font-semibold text-[#e4e4e7] select-all bg-[#4f46e5]/20 px-3 py-1 rounded tracking-tight">{newPassword}</span>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <button
                                            onClick={handleCopyPassword}
                                            className={`w-full px-4 py-4 ${isCopied ? 'bg-[#10b981] hover:bg-[#059669]' : 'bg-[#22c55e] hover:bg-[#16a34a]'} text-white text-[15px] font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-600/20`}
                                        >
                                            {isCopied ? (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Copiado!
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                    </svg>
                                                    Copiar para WhatsApp
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowResetConfirm(false)
                                                setNewPassword(null)
                                                setIsCopied(false)
                                            }}
                                            className="w-full px-4 py-2 bg-transparent hover:bg-muted text-muted-foreground text-sm font-medium rounded-xl transition-colors"
                                        >
                                            Fechar
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }
        </>
    )
}

