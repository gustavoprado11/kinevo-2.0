'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'

export interface StudentPickerOption {
    id: string
    name: string
    avatar_url?: string | null
}

interface BaseProps {
    students: StudentPickerOption[]
    /**
     * Quando provido, força essa seleção (modo single) ou o aluno é
     * destacado e não pode ser desmarcado (modo multi). Usado pelo M7 QW2.
     */
    lockedStudentId?: string
    /** Mostrar campo de busca acima da lista (multi mode). */
    showSearch?: boolean
}

interface SinglePickerProps extends BaseProps {
    mode: 'single'
    value: string
    onChange: (id: string) => void
}

interface MultiPickerProps extends BaseProps {
    mode: 'multi'
    value: string[]
    onChange: (ids: string[]) => void
}

type StudentPickerProps = SinglePickerProps | MultiPickerProps

// M8/D3 — picker compartilhado. Mode 'single' renderiza select dropdown
// (compatível com CreateSessionModal). Mode 'multi' renderiza lista com
// checkbox + search + "selecionar todos" (compatível com AssignFormModal).
export function StudentPicker(props: StudentPickerProps) {
    if (props.mode === 'single') {
        return <SinglePicker {...props} />
    }
    return <MultiPicker {...props} />
}

function SinglePicker({ students, value, onChange, lockedStudentId }: SinglePickerProps) {
    const isLocked = !!lockedStudentId
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={isLocked}
            className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none disabled:opacity-60"
            required
        >
            <option value="">Selecione...</option>
            {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
            ))}
        </select>
    )
}

function MultiPicker({
    students,
    value,
    onChange,
    lockedStudentId,
    showSearch = true,
}: MultiPickerProps) {
    const [query, setQuery] = useState('')

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return students
        return students.filter(s => s.name.toLowerCase().includes(q))
    }, [students, query])

    const allFilteredSelected =
        filtered.length > 0 && filtered.every(s => value.includes(s.id))

    const toggleAll = () => {
        if (allFilteredSelected) {
            // Desmarcar apenas os filtrados (preserva seleções fora do filtro).
            const filteredIds = new Set(filtered.map(s => s.id))
            const next = value.filter(id => !filteredIds.has(id) || id === lockedStudentId)
            onChange(next)
        } else {
            const next = Array.from(new Set([...value, ...filtered.map(s => s.id)]))
            onChange(next)
        }
    }

    const toggleStudent = (id: string) => {
        if (id === lockedStudentId) return // locked: não pode desmarcar
        if (value.includes(id)) {
            onChange(value.filter(x => x !== id))
        } else {
            onChange([...value, id])
        }
    }

    return (
        <div>
            {showSearch && students.length > 4 && (
                <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-k-text-quaternary" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar aluno..."
                        className="w-full rounded-lg border border-[#D2D2D7] bg-white py-2 pl-8 pr-3 text-xs text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 dark:rounded-md dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:placeholder:text-k-text-quaternary dark:focus:border-violet-500/50"
                    />
                </div>
            )}
            {students.length > 0 && (
                <div className="mb-1.5 flex justify-end">
                    <button
                        type="button"
                        onClick={toggleAll}
                        className="text-[11px] font-semibold text-[#007AFF] hover:text-[#0056B3] transition-colors dark:text-violet-400 dark:hover:text-violet-300"
                    >
                        {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                </div>
            )}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[#E8E8ED] bg-white p-2 dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg">
                {students.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-k-text-secondary">
                        Nenhum aluno ativo encontrado.
                    </p>
                ) : filtered.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-k-text-secondary">
                        Nenhum aluno corresponde à busca.
                    </p>
                ) : (
                    <div className="space-y-0.5">
                        {filtered.map(student => {
                            const isSelected = value.includes(student.id)
                            const isLocked = student.id === lockedStudentId
                            return (
                                <label
                                    key={student.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all border-b border-[#E8E8ED] last:border-b-0 dark:border-b-0 ${
                                        isSelected
                                            ? 'bg-[#007AFF]/5 dark:bg-violet-500/10'
                                            : 'hover:bg-[#F5F5F7] dark:hover:bg-surface-elevated'
                                    } ${isLocked ? 'cursor-default opacity-90' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleStudent(student.id)}
                                        disabled={isLocked}
                                        className="h-4 w-4 rounded border-[#D2D2D7] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] dark:border-k-border-subtle dark:text-violet-600 dark:focus:ring-violet-500 dark:accent-violet-600"
                                    />
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden shrink-0">
                                        {student.avatar_url ? (
                                            <Image src={student.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized />
                                        ) : (
                                            <span className="text-[10px] font-bold text-k-text-secondary">
                                                {student.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-sm font-medium ${
                                        isSelected
                                            ? 'text-[#1D1D1F] dark:text-violet-400'
                                            : 'text-[#1D1D1F] dark:text-k-text-primary'
                                    }`}>
                                        {student.name}
                                    </span>
                                </label>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
