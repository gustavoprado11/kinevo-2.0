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
    created_at: string
}

import { DailyActivityFeed } from '@/components/dashboard/daily-activity-feed'

interface DashboardClientProps {
    trainer: Trainer
    initialStudents: Student[]
    dailyActivity: any[]
}

export function DashboardClient({ trainer, initialStudents, dailyActivity }: DashboardClientProps) {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>(initialStudents)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleStudentCreated = (newStudent: Student) => {
        setStudents([newStudent, ...students])
        setIsModalOpen(false)
    }

    // Stats cards
    const stats = [
        {
            label: 'Total de Alunos',
            value: students.length,
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            label: 'Alunos Ativos',
            value: students.filter(s => s.status === 'active').length,
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            label: 'Atividade Hoje',
            value: dailyActivity.length,
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    ]

    return (
        <AppLayout trainerName={trainer.name} trainerEmail={trainer.email} trainerAvatarUrl={trainer.avatar_url}>
            {/* Page Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-gray-400 mt-1">Visão geral do seu dia</p>
                </div>
                {/* Secondary Action: Manage Students */}
                <button
                    onClick={() => router.push('/students')} // Assuming there is a /students page, or we can make a dedicated one later if needed. For now let's keep the modal or rethink navigation.
                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm"
                >
                    Gerenciar Alunos
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5 hover:border-gray-600/50 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                                <p className="text-3xl font-bold text-white">{stat.value}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                                {stat.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Daily Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2">
                    <DailyActivityFeed activities={dailyActivity} />
                </div>

                {/* Right Column: Quick Actions / Students Shortcut */}
                <div className="space-y-6">
                    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">Acesso Rápido</h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="w-full text-left px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 hover:border-violet-500/30 transition-all flex items-center gap-3 group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-white font-medium">Novo Aluno</p>
                                    <p className="text-xs text-gray-400">Cadastrar aluno</p>
                                </div>
                            </button>

                            {/* We can add 'Create Program' shortcut later */}
                        </div>
                    </div>
                </div>
            </div>

            {/* Student Modal */}
            <StudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStudentCreated={handleStudentCreated}
                trainerId={trainer.id}
            />
        </AppLayout>
    )
}
