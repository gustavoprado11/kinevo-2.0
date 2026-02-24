'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { StudentModal } from '@/components/student-modal'
import { Users, UserCheck, Activity, Plus, ChevronRight, Monitor } from 'lucide-react'
import { DailyActivityFeed } from '@/components/dashboard/daily-activity-feed'
import { TrainerProfileWelcomeModal } from '@/components/dashboard/trainer-profile-welcome-modal'
import { TrainerProfileBanner } from '@/components/dashboard/trainer-profile-banner'
import { AppDownloadCard } from '@/components/dashboard/app-download-card'

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

interface DashboardClientProps {
    trainer: Trainer
    initialStudents: Student[]
    dailyActivity: any[]
    selfStudentId?: string | null
}

export function DashboardClient({ trainer, initialStudents, dailyActivity, selfStudentId }: DashboardClientProps) {
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
            icon: <Users size={24} strokeWidth={1.5} />,
        },
        {
            label: 'Alunos Ativos',
            value: students.filter(s => s.status === 'active').length,
            icon: <UserCheck size={24} strokeWidth={1.5} />,
        },
        {
            label: 'Atividade Hoje',
            value: dailyActivity.length,
            icon: <Activity size={24} strokeWidth={1.5} />,
        },
    ]

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
        >

            {/* Trainer Profile Banner */}
            <TrainerProfileBanner selfStudentId={selfStudentId} />

            {/* Page Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">Dashboard</h1>
                    <p className="mt-1 text-muted-foreground">Visão geral do seu dia</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-xl transition-all hover:border-k-border-primary/200"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="mb-2 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground/60">{stat.label}</p>
                                <p className="text-4xl font-extrabold tracking-tighter text-foreground">{stat.value}</p>
                            </div>
                            <div className="text-primary">
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

                {/* Right Column: Quick Actions */}
                <div className="space-y-6">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group w-full flex items-center gap-4 rounded-2xl border border-transparent bg-glass-bg p-4 backdrop-blur-md transition-all duration-200 hover:bg-glass-bg-active"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white transition-transform group-hover:scale-110">
                            <Plus size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="font-semibold text-foreground">Novo Aluno</h3>
                            <p className="text-sm text-muted-foreground">Cadastrar um novo aluno</p>
                        </div>
                        <ChevronRight size={20} className="text-muted-foreground transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                    </button>

                    {/* Training Room Card */}
                    <button
                        onClick={() => router.push('/training-room')}
                        className="group w-full flex items-center gap-4 rounded-2xl border border-transparent bg-glass-bg p-4 backdrop-blur-md transition-all duration-200 hover:bg-glass-bg-active"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform group-hover:scale-110">
                            <Monitor size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="font-semibold text-foreground">Sala de Treino</h3>
                            <p className="text-sm text-muted-foreground">Treino presencial ao vivo</p>
                        </div>
                        <ChevronRight size={20} className="text-muted-foreground transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                    </button>

                    {/* App Download Card */}
                    <AppDownloadCard />
                </div>
            </div>

            {/* Student Modal */}
            <StudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStudentCreated={handleStudentCreated}
                trainerId={trainer.id}
            />

            {/* Welcome Modal (first time only) */}
            <TrainerProfileWelcomeModal />
        </AppLayout>
    )
}
