'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { reassignStudent } from '@/actions/organizations/reassign-student'
import { useToast } from '@/components/ui/toast'

export interface StudentOverviewRow {
    student_id: string
    student_name: string
    coach_id: string
    coach_name: string | null
    has_active_program: boolean
    last_session: string | null
    at_risk: boolean
}

interface Props {
    students: StudentOverviewRow[]
    coaches: { id: string; name: string }[]
}

function daysAgo(iso: string | null): string {
    if (!iso) return 'Nunca treinou'
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (diff <= 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    return `há ${diff} dias`
}

export function EstudioAlunosClient({ students, coaches }: Props) {
    const router = useRouter()
    const { toast } = useToast()
    const [pending, startTransition] = useTransition()
    const [reassigning, setReassigning] = useState<string | null>(null)

    function handleReassign(studentId: string, newCoachId: string) {
        setReassigning(studentId)
        startTransition(async () => {
            const res = await reassignStudent({ studentId, newCoachId })
            if (res.success) {
                toast({ message: 'Aluno reatribuído', type: 'success' })
                router.refresh()
            } else {
                toast({ message: res.error ?? 'Erro ao reatribuir', type: 'error' })
            }
            setReassigning(null)
        })
    }

    if (students.length === 0) {
        return <p className="mt-6 text-sm text-k-text-quaternary">Nenhum aluno no estúdio ainda.</p>
    }

    return (
        <div className="mt-6 rounded-xl border border-k-border-subtle bg-surface-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-k-text-quaternary border-b border-k-border-subtle">
                            <th className="px-4 py-2 font-medium">Aluno</th>
                            <th className="px-4 py-2 font-medium">Programa</th>
                            <th className="px-4 py-2 font-medium">Último treino</th>
                            <th className="px-4 py-2 font-medium">Responsável</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.student_id} className="border-b border-k-border-subtle last:border-0">
                                <td className="px-4 py-2.5">
                                    <Link href={`/students/${s.student_id}`} className="font-medium text-k-text-primary hover:text-violet-500 inline-flex items-center gap-1.5">
                                        {s.at_risk && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                                        {s.student_name}
                                    </Link>
                                </td>
                                <td className="px-4 py-2.5">
                                    {s.has_active_program
                                        ? <span className="text-emerald-500 text-xs">Ativo</span>
                                        : <span className="text-amber-500 text-xs">Sem programa</span>}
                                </td>
                                <td className={`px-4 py-2.5 text-xs ${s.at_risk ? 'text-amber-500' : 'text-k-text-secondary'}`}>
                                    {daysAgo(s.last_session)}
                                </td>
                                <td className="px-4 py-2.5">
                                    <select
                                        value={s.coach_id}
                                        disabled={pending && reassigning === s.student_id}
                                        onChange={(e) => handleReassign(s.student_id, e.target.value)}
                                        className="rounded-lg border border-k-border-subtle bg-glass-bg px-2.5 py-1 text-xs text-k-text-secondary focus:outline-none focus:border-violet-500/40 disabled:opacity-50"
                                    >
                                        {coaches.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
