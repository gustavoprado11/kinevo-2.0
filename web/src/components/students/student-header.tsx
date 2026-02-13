'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality?: 'online' | 'presential'
    avatar_url?: string | null
    created_at: string
}

interface StudentHeaderProps {
    student: Student
    onEdit: () => void
    onDelete: () => void
}

export function StudentHeader({ student, onEdit, onDelete }: StudentHeaderProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
                                    Desde {new Date(student.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={onEdit}
                            className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-k-text-tertiary hover:text-k-text-primary hover:bg-glass-bg rounded-xl transition-all flex items-center gap-2 border border-k-border-subtle"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
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
                    </div>
                </div>
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
        </>
    )
}

