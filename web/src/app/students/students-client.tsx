'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { StudentModal } from '@/components/student-modal'
import { Button } from '@/components/ui/button'
import { Plus, Search, ChevronRight } from 'lucide-react'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system'
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
    }

    const filteredStudents = students.filter(
        (student) =>
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getStatusBadge = (status: Student['status']) => {
        const styles = {
            active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            inactive: 'bg-glass-bg text-muted-foreground border-k-border-primary',
            pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        }
        const labels = {
            active: 'Ativo',
            inactive: 'Inativo',
            pending: 'Pendente',
        }
        return (
            <span className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${styles[status]}`}>
                {labels[status]}
            </span>
        )
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
        >
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">Alunos</h1>
                    <p className="mt-1 text-sm text-muted-foreground/60">Gerencie todos os seus alunos</p>
                </div>
                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="gap-2 bg-violet-600 hover:bg-violet-500 rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all duration-200"
                >
                    <Plus size={18} strokeWidth={2} />
                    Novo Aluno
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 rounded-xl border border-k-border-primary bg-glass-bg shadow-sm backdrop-blur-sm">
                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/50" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Buscar alunos por nome ou email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-transparent bg-transparent py-2.5 pl-10 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 transition-all text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Students Table */}
            <div className="rounded-2xl border border-k-border-subtle bg-surface-card shadow-xl overflow-hidden">
                {filteredStudents.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-glass-bg border border-k-border-subtle">
                            <Search className="h-6 w-6 text-muted-foreground/40" strokeWidth={1.5} />
                        </div>
                        {searchQuery ? (
                            <p className="text-muted-foreground/60">Nenhum aluno encontrado para &ldquo;{searchQuery}&rdquo;</p>
                        ) : (
                            <>
                                <p className="mb-4 text-muted-foreground/60">Você ainda não tem alunos cadastrados</p>
                                <Button
                                    onClick={() => setIsModalOpen(true)}
                                    variant="outline"
                                    className="border-k-border-primary hover:bg-glass-bg"
                                >
                                    Criar primeiro aluno
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-k-border-subtle">
                                    <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                        Aluno
                                    </th>
                                    <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                        Modalidade
                                    </th>
                                    <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                        Contato
                                    </th>
                                    <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                        Status
                                    </th>
                                    <th className="px-6 py-5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                        Cadastro
                                    </th>
                                    <th className="px-6 py-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-k-border-subtle">
                                {filteredStudents.map((student) => (
                                    <tr
                                        key={student.id}
                                        className="group cursor-pointer transition-colors hover:bg-glass-bg"
                                        onClick={() => router.push(`/students/${student.id}`)}
                                    >
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg">
                                                    <span className="text-sm font-semibold text-k-text-primary">
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="text-base font-medium text-k-text-primary">{student.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {student.modality === 'presential' ? (
                                                <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                                    Presencial
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full bg-glass-bg text-muted-foreground border border-k-border-primary">
                                                    Online
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="text-sm font-medium text-k-text-secondary">{student.email}</div>
                                            {student.phone && (
                                                <div className="mt-0.5 text-xs text-muted-foreground/60">{student.phone}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {getStatusBadge(student.status)}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-sm text-muted-foreground/60">
                                            {new Date(student.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right">
                                            <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-k-text-secondary transition-colors inline-block" strokeWidth={1.5} />
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
