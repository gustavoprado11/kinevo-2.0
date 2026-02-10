'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'

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
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Programas</h1>
                    <p className="mt-1 text-muted-foreground">Sua biblioteca de programas de treino</p>
                </div>
                <button
                    onClick={handleCreateProgram}
                    className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo Programa
                </button>
            </div>

            {/* Search */}
            <div className="bg-card rounded-xl border border-border mb-6">
                <div className="p-4">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar programas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Programs Grid */}
            {filteredPrograms.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    {searchQuery ? (
                        <p className="text-muted-foreground">Nenhum programa encontrado para &ldquo;{searchQuery}&rdquo;</p>
                    ) : (
                        <>
                            <p className="text-muted-foreground mb-4">Você ainda não tem programas na biblioteca</p>
                            <button
                                onClick={handleCreateProgram}
                                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all"
                            >
                                Criar primeiro programa
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPrograms.map((program) => (
                        <div
                            key={program.id}
                            onClick={() => handleEditProgram(program.id)}
                            className="bg-card rounded-xl border border-border p-5 hover:border-violet-500/30 hover:bg-muted/40 cursor-pointer transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-foreground transition-colors group-hover:text-violet-400">
                                    {program.name}
                                </h3>
                                <button
                                    onClick={(e) => handleDeleteProgram(program.id, e)}
                                    disabled={deleting === program.id}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    {deleting === program.id ? (
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {program.description && (
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                    {program.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {program.duration_weeks && (
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {program.duration_weeks} semanas
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    {program.workout_count} treinos
                                </span>
                                <span className="text-muted-foreground/80">
                                    {new Date(program.created_at).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AppLayout>
    )
}
