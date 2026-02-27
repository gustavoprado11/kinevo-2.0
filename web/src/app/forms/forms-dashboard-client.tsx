'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import {
    FileText,
    MessageSquare,
    AlertCircle,
    ClipboardCheck,
    Inbox,
    ArrowRight,
    Receipt,
    ChevronRight,
} from 'lucide-react'
import Image from 'next/image'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface RecentSubmission {
    id: string
    status: string
    submitted_at: string | null
    created_at: string
    student_name: string | null
    student_avatar: string | null
    template_title: string | null
    feedback_sent_at: string | null
}

interface FormsDashboardClientProps {
    trainer: Trainer
    templatesCount: number
    submissionsCount: number
    pendingFeedbackCount: number
    recentSubmissions: RecentSubmission[]
}

function submissionStatusBadge(status: string, feedbackSentAt: string | null) {
    if (status === 'reviewed' || feedbackSentAt) {
        return { label: 'Feedback Enviado', classes: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
    }
    if (status === 'submitted') {
        return { label: 'Aguardando', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    }
    return { label: 'Pendente', classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
}

export function FormsDashboardClient({
    trainer,
    templatesCount,
    submissionsCount,
    pendingFeedbackCount,
    recentSubmissions,
}: FormsDashboardClientProps) {
    const router = useRouter()

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div>
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                        Avaliações
                    </h1>
                    <p className="text-sm text-k-text-secondary mt-1">
                        Gerencie formulários, check-ins e feedbacks dos alunos.
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10">
                                <FileText size={18} className="text-blue-400" />
                            </div>
                            <span className="text-xs font-medium text-k-text-secondary uppercase tracking-wider">
                                Templates Criados
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-k-text-primary">{templatesCount}</p>
                    </div>

                    <div className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10">
                                <MessageSquare size={18} className="text-emerald-400" />
                            </div>
                            <span className="text-xs font-medium text-k-text-secondary uppercase tracking-wider">
                                Respostas Recebidas
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-k-text-primary">{submissionsCount}</p>
                    </div>

                    <div data-onboarding="forms-pending" className="rounded-2xl border border-k-border-primary bg-surface-card p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10">
                                <AlertCircle size={18} className="text-amber-400" />
                            </div>
                            <span className="text-xs font-medium text-k-text-secondary uppercase tracking-wider">
                                Aguardando Feedback
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-k-text-primary">{pendingFeedbackCount}</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <Link
                        data-onboarding="forms-templates-card"
                        href="/forms/templates"
                        className="rounded-2xl border border-k-border-primary bg-surface-card p-5 hover:border-violet-500/30 transition-colors group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-glass-bg">
                                    <ClipboardCheck size={18} className="text-k-text-secondary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-k-text-primary">Meus Templates</h3>
                                    <p className="text-xs text-k-text-secondary">Criar e gerenciar formulários</p>
                                </div>
                            </div>
                            <ArrowRight size={16} className="text-k-text-secondary group-hover:text-violet-400 transition-colors" />
                        </div>
                    </Link>

                    <Link
                        data-onboarding="forms-inbox-card"
                        href="/forms/inbox"
                        className="rounded-2xl border border-k-border-primary bg-surface-card p-5 hover:border-violet-500/30 transition-colors group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-glass-bg">
                                    <Inbox size={18} className="text-k-text-secondary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-k-text-primary">Inbox de Respostas</h3>
                                    <p className="text-xs text-k-text-secondary">Ver respostas e enviar feedbacks</p>
                                </div>
                            </div>
                            <ArrowRight size={16} className="text-k-text-secondary group-hover:text-violet-400 transition-colors" />
                        </div>
                    </Link>
                </div>

                {/* Recent Submissions */}
                <div className="rounded-2xl border border-k-border-primary bg-surface-card">
                    <div className="px-6 py-4 border-b border-k-border-subtle">
                        <h2 className="text-sm font-semibold text-k-text-primary">Submissões Recentes</h2>
                    </div>
                    {recentSubmissions.length === 0 ? (
                        <EmptyState
                            icon={Receipt}
                            title="Nenhuma submissão"
                            description="As respostas dos seus alunos aparecerão aqui."
                        />
                    ) : (
                        <div className="divide-y divide-k-border-subtle">
                            {recentSubmissions.map((sub) => {
                                const badge = submissionStatusBadge(sub.status, sub.feedback_sent_at)
                                return (
                                    <button
                                        key={sub.id}
                                        onClick={() => router.push(`/forms/inbox?submission=${sub.id}`)}
                                        className="w-full px-6 py-3.5 flex items-center justify-between hover:bg-glass-bg transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden flex-shrink-0">
                                                {sub.student_avatar ? (
                                                    <Image
                                                        src={sub.student_avatar}
                                                        alt={sub.student_name || ''}
                                                        width={32}
                                                        height={32}
                                                        className="h-8 w-8 rounded-full object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-k-text-primary">
                                                        {(sub.student_name || '?').charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm text-k-text-primary truncate">
                                                    {sub.student_name || 'Aluno'} — {sub.template_title || 'Template'}
                                                </p>
                                                <p className="text-xs text-k-text-secondary mt-0.5">
                                                    {sub.submitted_at
                                                        ? new Date(sub.submitted_at).toLocaleDateString('pt-BR')
                                                        : new Date(sub.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${badge.classes}`}>
                                                {badge.label}
                                            </span>
                                            <ChevronRight size={14} className="text-k-text-secondary" />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Tour: Forms (auto-start on first visit) */}
            <TourRunner tourId="forms" steps={TOUR_STEPS.forms} autoStart />
        </AppLayout>
    )
}
