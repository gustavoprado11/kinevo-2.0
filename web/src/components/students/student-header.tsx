'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality?: 'online' | 'presential'
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
                classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
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
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <div className="flex items-start gap-6">
                {/* Back button */}
                <Link
                    href="/students"
                    className="w-10 h-10 rounded-lg bg-gray-700/50 border border-gray-600/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 hover:border-gray-500 transition-all flex-shrink-0"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>

                {/* Avatar */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
                    <span className="text-xl font-bold text-white">{initials}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-white truncate">{student.name}</h1>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border flex-shrink-0 ${statusConfig.classes}`}>
                            {statusConfig.label}
                        </span>
                        {student.modality === 'presential' ? (
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1.5 flex-shrink-0">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Presencial
                            </span>
                        ) : (
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-1.5 flex-shrink-0">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Online
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>{student.email}</span>
                        </div>

                        {student.phone && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>{student.phone}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-gray-600/50"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                    </button>

                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
                        title="Excluir Aluno"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-white text-center mb-2">Excluir Aluno?</h3>
                        <p className="text-gray-400 text-sm text-center mb-6">
                            Tem certeza que deseja excluir <span className="text-white font-medium">{student.name}</span>?
                            Isso removerá o acesso e todo o histórico. Essa ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    onDelete()
                                }}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

