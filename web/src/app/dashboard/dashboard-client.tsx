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
    theme?: 'light' | 'dark' | 'system'
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
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
        >
            {/* Page Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="mt-1 text-muted-foreground">Visão geral do seu dia</p>
                </div>
                {/* Secondary Action: Manage Students */}
                <button
                    onClick={() => router.push('/students')} // Assuming there is a /students page, or we can make a dedicated one later if needed. For now let's keep the modal or rethink navigation.
                    className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    Gerenciar Alunos
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:border-violet-200 hover:shadow-md dark:hover:border-border/80"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="mb-1 text-sm text-muted-foreground">{stat.label}</p>
                                <p className="text-3xl font-bold text-card-foreground">{stat.value}</p>
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
                    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-card-foreground">Acesso Rápido</h3>
                            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-400">
                                Ação
                            </span>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-gradient-to-r from-background to-background/80 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md hover:shadow-violet-500/10"
                            >
                                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-500/70 to-blue-500/70 opacity-70 transition-opacity group-hover:opacity-100" />
                                <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400 transition-all group-hover:scale-105 group-hover:bg-violet-500/20">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div className="relative flex-1">
                                    <p className="font-medium text-foreground">Novo Aluno</p>
                                    <p className="text-xs text-muted-foreground">Cadastrar aluno</p>
                                </div>
                                <svg
                                    className="relative h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-violet-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                                    <div className="absolute -right-16 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-violet-500/10 blur-2xl" />
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
