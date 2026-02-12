'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Trash2, Calendar, Dumbbell, FolderPlus, Loader2 } from 'lucide-react'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system'
}

interface ProgramTemplate {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    created_at: string
    workout_count: number
}

interface ProgramsClientProps {
    trainer: Trainer
    programs: ProgramTemplate[]
}

export function ProgramsClient({ trainer, programs: initialPrograms }: ProgramsClientProps) {
    const router = useRouter()
    const [programs, setPrograms] = useState(initialPrograms)
    const [searchQuery, setSearchQuery] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)

    const handleCreateProgram = () => {
        router.push('/programs/new')
    }

    const handleEditProgram = (id: string) => {
        router.push(`/programs/${id}`)
    }

    const handleDeleteProgram = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Tem certeza que deseja excluir este programa?')) return

        setDeleting(id)
        const supabase = createClient()

        const { error } = await supabase
            .from('program_templates')
            .delete()
            .eq('id', id)

        if (!error) {
            setPrograms(programs.filter(p => p.id !== id))
        }
        setDeleting(null)
    }

    const filteredPrograms = programs.filter(
        (program) =>
            program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            program.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
        >
            <div className="min-h-screen bg-surface-primary p-8 font-sans">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                                Programas
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Sua biblioteca de programas de treino
                            </p>
                        </div>
                        <button
                            onClick={handleCreateProgram}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center gap-2 w-fit"
                        >
                            <Plus size={18} strokeWidth={2} />
                            Novo Programa
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-[18px] h-[18px] text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar programas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-glass-bg border border-slate-200 dark:border-k-border-primary rounded-2xl py-3.5 pl-11 pr-4 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 backdrop-blur-md transition-all"
                        />
                    </div>

                    {/* Content Grid */}
                    {filteredPrograms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface-card rounded-2xl border border-k-border-subtle border-dashed">
                            <div className="w-16 h-16 rounded-full bg-glass-bg flex items-center justify-center mb-4">
                                <FolderPlus className="w-8 h-8 text-k-text-quaternary" strokeWidth={1} />
                            </div>
                            {searchQuery ? (
                                <p className="text-muted-foreground/50 font-medium">
                                    Nenhum programa encontrado para "{searchQuery}"
                                </p>
                            ) : (
                                <>
                                    <p className="text-muted-foreground/50 font-medium mb-6">
                                        Você ainda não tem programas na biblioteca
                                    </p>
                                    <button
                                        onClick={handleCreateProgram}
                                        className="text-violet-400 hover:text-violet-300 text-sm font-medium hover:underline transition-all"
                                    >
                                        Criar primeiro programa
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPrograms.map((program) => (
                                <div
                                    key={program.id}
                                    onClick={() => handleEditProgram(program.id)}
                                    className="group relative bg-surface-card border border-k-border-primary rounded-2xl p-5 shadow-xl hover:border-k-border-primary hover:bg-glass-bg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                                >
                                    {/* Card Header & Title */}
                                    <div className="flex justify-between items-start mb-3 gap-4">
                                        <h3 className="text-lg font-bold text-k-text-primary tracking-tight leading-snug group-hover:text-violet-200 transition-colors line-clamp-2">
                                            {program.name}
                                        </h3>

                                        <button
                                            onClick={(e) => handleDeleteProgram(program.id, e)}
                                            disabled={deleting === program.id}
                                            className="text-k-text-quaternary hover:text-red-400 hover:bg-glass-bg p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        >
                                            {deleting === program.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                            )}
                                        </button>
                                    </div>

                                    {/* Description */}
                                    {program.description && (
                                        <p className="text-sm text-muted-foreground/60 mb-6 line-clamp-2 h-10">
                                            {program.description}
                                        </p>
                                    )}
                                    {!program.description && <div className="h-10 mb-6" />}

                                    {/* Badges Footer */}
                                    <div className="flex items-center gap-2 mt-auto">
                                        {program.duration_weeks && (
                                            <div className="flex items-center gap-1.5 bg-glass-bg text-[11px] font-semibold text-k-text-tertiary px-2.5 py-1.5 rounded-md border border-k-border-subtle">
                                                <Calendar size={12} strokeWidth={2} />
                                                <span>{program.duration_weeks} semanas</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 bg-glass-bg text-[11px] font-semibold text-k-text-secondary px-2.5 py-1.5 rounded-md border border-k-border-subtle">
                                            <Dumbbell size={12} strokeWidth={2} />
                                            <span>{program.workout_count} treinos</span>
                                        </div>
                                    </div>

                                    {/* Hover Glow Effect */}
                                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-k-border-subtle group-hover:ring-k-border-primary pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    )
}
