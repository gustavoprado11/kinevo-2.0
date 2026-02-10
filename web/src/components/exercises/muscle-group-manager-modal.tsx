'use client'

import { useState } from 'react'
import { MuscleGroup } from '@/types/exercise'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'

interface MuscleGroupManagerModalProps {
    isOpen: boolean
    onClose: () => void
    trainerId: string
    manager: ReturnType<typeof useMuscleGroups>
}

export function MuscleGroupManagerModal({ isOpen, onClose, trainerId, manager }: MuscleGroupManagerModalProps) {
    const {
        muscleGroups,
        loading,
        createMuscleGroup,
        updateMuscleGroup,
        deleteMuscleGroup,
        checkUsageCount
    } = manager

    const [searchQuery, setSearchQuery] = useState('')
    const [newName, setNewName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    // Delete Confirmation State
    const [deletingGroup, setDeletingGroup] = useState<{ id: string, name: string, count: number } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Filtered list
    const filteredGroups = muscleGroups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleCreate = async () => {
        if (!newName.trim()) return
        setIsCreating(true)
        await createMuscleGroup(newName.trim())
        setNewName('')
        setIsCreating(false)
    }

    const startEdit = (group: MuscleGroup) => {
        setEditingId(group.id)
        setEditName(group.name)
    }

    const handleUpdate = async () => {
        if (!editingId || !editName.trim()) return
        const success = await updateMuscleGroup(editingId, editName.trim())
        if (success) {
            setEditingId(null)
            setEditName('')
        } else {
            alert('Erro ao atualizar. Verifique se o nome já existe.')
        }
    }

    const confirmDelete = async (group: MuscleGroup) => {
        const count = await checkUsageCount(group.id)
        setDeletingGroup({ id: group.id, name: group.name, count })
    }

    const handleDelete = async () => {
        if (!deletingGroup) return
        setIsDeleting(true)
        const success = await deleteMuscleGroup(deletingGroup.id)
        if (success) {
            setDeletingGroup(null)
        } else {
            alert('Erro ao excluir grupo.')
        }
        setIsDeleting(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-background rounded-2xl border border-border shadow-xl max-h-[85vh] flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Gerenciar Grupos</h2>
                        <p className="text-sm text-muted-foreground">Adicione, edite ou remova grupos musculares</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Create Section */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            placeholder="Nome do novo grupo (ex: Potência)"
                            className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={isCreating || !newName.trim()}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-foreground font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            {isCreating ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : '+'}
                            Adicionar
                        </button>
                    </div>

                    <div className="h-px bg-muted" />

                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar grupos..."
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-gray-500"
                        />
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {loading ? (
                            <div className="text-center text-muted-foreground py-4">Carregando...</div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">Nenhum grupo encontrado</div>
                        ) : (
                            filteredGroups.map(group => {
                                const isSystem = !group.owner_id
                                const isEditable = group.owner_id === trainerId
                                const isEditing = editingId === group.id

                                return (
                                    <div key={group.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border group hover:border-border transition-colors">
                                        <div className="flex-1 flex items-center gap-3">
                                            {isEditing ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdate()
                                                        if (e.key === 'Escape') setEditingId(null)
                                                    }}
                                                    className="w-full bg-background border border-violet-500/50 rounded px-2 py-1 text-foreground text-sm"
                                                />
                                            ) : (
                                                <span className="text-foreground">{group.name}</span>
                                            )}

                                            {isSystem && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    Sistema
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={handleUpdate} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </>
                                            ) : isEditable ? (
                                                <>
                                                    <button onClick={() => startEdit(group)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="Editar">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => confirmDelete(group)} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Excluir">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <button disabled className="p-1.5 text-muted-foreground/80 cursor-not-allowed">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-card rounded-b-2xl flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-muted hover:bg-muted text-foreground text-sm font-medium rounded-lg transition-colors">
                        Fechar
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingGroup && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-background rounded-xl border border-red-500/20 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-foreground mb-2">Excluir Grupo?</h3>
                        <p className="text-muted-foreground mb-4">
                            Você tem certeza que deseja excluir o grupo <strong className="text-foreground">{deletingGroup.name}</strong>?
                        </p>

                        {deletingGroup.count > 0 ? (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="text-sm text-red-200">
                                    <p className="font-semibold text-red-400 mb-1">Atenção!</p>
                                    Este grupo está sendo usado em <strong>{deletingGroup.count} exercícios</strong>. Ao confirmar, ele será removido de todos esses exercícios. Esta ação não pode ser desfeita.
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mb-6">
                                Este grupo não está sendo usado em nenhum exercício.
                            </p>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeletingGroup(null)}
                                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-foreground font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isDeleting && <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                Excluir Permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
