'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { StudentModal } from '@/components/student-modal'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
}

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality: 'online' | 'presential'
    created_at: string
}

interface StudentsClientProps {
    trainer: Trainer
    initialStudents: Student[]
}

export function StudentsClient({ trainer, initialStudents }: StudentsClientProps) {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>(initialStudents)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const handleStudentCreated = (newStudent: Student) => {
        setStudents([newStudent, ...students])
        // Não fechar o modal aqui para permitir o passo de credenciais
        // O modal será fechado pelo StudentAccessDialog
    }

    const filteredStudents = students.filter(
        (student) =>
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getStatusBadge = (status: Student['status']) => {
        const styles = {
            active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
            pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        }
        const labels = {
            active: 'Ativo',
            inactive: 'Inativo',
            pending: 'Pendente',
        }
        return (
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
                {labels[status]}
            </span>
        )
    }

    return (
        <AppLayout trainerName={trainer.name} trainerEmail={trainer.email} trainerAvatarUrl={trainer.avatar_url}>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Alunos</h1>
                    <p className="text-gray-400 mt-1">Gerencie todos os seus alunos</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo Aluno
                </button>
            </div>

            {/* Search and Filters */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 mb-6">
                <div className="p-4">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar alunos por nome ou email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Students Table */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50">
                {filteredStudents.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        {searchQuery ? (
                            <p className="text-gray-400">Nenhum aluno encontrado para &ldquo;{searchQuery}&rdquo;</p>
                        ) : (
                            <>
                                <p className="text-gray-400 mb-4">Você ainda não tem alunos cadastrados</p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all"
                                >
                                    Criar primeiro aluno
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-700/50">
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Aluno
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Modalidade
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Contato
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Cadastro
                                    </th>
                                    <th className="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {filteredStudents.map((student) => (
                                    <tr
                                        key={student.id}
                                        className="hover:bg-gray-700/30 cursor-pointer transition-colors group"
                                        onClick={() => router.push(`/students/${student.id}`)}
                                    >
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center border border-gray-700">
                                                    <span className="text-sm font-medium text-violet-300">
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-medium text-white">{student.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {student.modality === 'presential' ? (
                                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                    Presencial
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                                    Online
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-400">{student.email}</div>
                                            {student.phone && (
                                                <div className="text-xs text-gray-500 mt-0.5">{student.phone}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {getStatusBadge(student.status)}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {new Date(student.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-right">
                                            <button className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <StudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStudentCreated={handleStudentCreated}
                trainerId={trainer.id}
            />
        </AppLayout>
    )
}
