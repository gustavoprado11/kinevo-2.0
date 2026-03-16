'use client'

import { useState } from 'react'
import { MuscleGroup } from '@/types/exercise'
import { useMuscleGroups } from '@/hooks/use-muscle-groups'
import { X, Plus, Search, Loader2, Check, Edit2, Trash2, Lock, AlertTriangle } from 'lucide-react'

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
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-white dark:bg-surface-card dark:backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl dark:ring-1 dark:ring-inset dark:ring-k-border-primary max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 pb-2 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-white tracking-tight">Gerenciar Grupos</h2>
                        <p className="text-xs text-[#86868B] dark:text-muted-foreground/60 font-medium mt-1">Adicione ou remova grupos</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[#AEAEB2] dark:text-k-text-tertiary hover:text-[#6E6E73] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active transition-colors rounded-full"
                    >
                        <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">

                    {/* Create Section */}
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            placeholder="Nome do novo grupo (ex: Potência)"
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-k-border-primary rounded-lg text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-2 dark:focus:ring-violet-500/20 focus:border-[#007AFF] dark:focus:border-violet-500/50 transition-all text-sm"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={isCreating || !newName.trim()}
                            className="px-4 py-2 bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0066D6] dark:hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm rounded-full dark:rounded-lg shadow-sm dark:shadow-lg dark:shadow-violet-500/20 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                        >
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
                            Adicionar
                        </button>
                    </div>

                    <div className="h-px bg-[#E8E8ED] dark:bg-k-border-subtle" />

                    {/* Search */}
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-muted-foreground/40 group-focus-within:text-[#007AFF] dark:group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar grupos..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-k-border-primary rounded-lg text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-2 dark:focus:ring-violet-500/20 focus:border-[#007AFF] dark:focus:border-violet-500/50 transition-all text-sm"
                        />
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex justify-center py-8 text-[#AEAEB2] dark:text-muted-foreground/40">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="text-center text-[#AEAEB2] dark:text-muted-foreground/40 py-8 text-sm p-4 border border-dashed border-[#D2D2D7] dark:border-k-border-subtle rounded-xl bg-[#F5F5F7] dark:bg-surface-inset">
                                Nenhum grupo encontrado
                            </div>
                        ) : (
                            filteredGroups.map(group => {
                                const isSystem = !group.owner_id
                                const isEditable = group.owner_id === trainerId
                                const isEditing = editingId === group.id

                                return (
                                    <div
                                        key={group.id}
                                        className="flex items-center justify-between p-3.5 bg-white dark:bg-surface-inset hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle transition-all duration-200 group"
                                    >
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
                                                    className="w-full bg-white dark:bg-surface-inset border border-[#007AFF] dark:border-violet-500/50 rounded-lg px-3 py-1.5 text-[#1D1D1F] dark:text-k-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/50"
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-secondary">{group.name}</span>
                                            )}

                                            {isSystem && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F5F7] dark:bg-blue-500/10 text-[#6E6E73] dark:text-blue-400 border border-[#E8E8ED] dark:border-blue-500/20">
                                                    Sistema
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={handleUpdate} className="p-2 text-[#34C759] dark:text-emerald-400 hover:bg-[#34C759]/10 dark:hover:bg-emerald-500/10 rounded-lg transition-colors">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 text-[#86868B] dark:text-muted-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-lg transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : isEditable ? (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(group)}
                                                        className="p-2 text-[#AEAEB2] dark:text-muted-foreground/60 hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(group)}
                                                        className="p-2 text-[#AEAEB2] dark:text-muted-foreground/60 hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="p-2 text-[#AEAEB2] dark:text-k-border-subtle">
                                                    <Lock className="w-4 h-4" strokeWidth={1.5} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#E8E8ED] dark:border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-[#007AFF] dark:text-white dark:bg-glass-bg hover:text-[#0056B3] dark:hover:bg-glass-bg-active font-medium rounded-full transition-all text-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingGroup && (
                <div className="absolute inset-0 z-float flex items-center justify-center p-4 bg-black/30 dark:bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7] dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200 dark:ring-1 dark:ring-white/5">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 rounded-full bg-[#FF3B30]/10 dark:bg-red-500/10 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-[#FF3B30] dark:text-red-500" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-white mb-2">Excluir Grupo?</h3>
                            <p className="text-[#86868B] dark:text-muted-foreground text-sm">
                                Você tem certeza que deseja excluir <strong className="text-[#1D1D1F] dark:text-white">{deletingGroup.name}</strong>?
                            </p>
                        </div>

                        {deletingGroup.count > 0 ? (
                            <div className="mb-6 p-4 bg-[#FF3B30]/5 dark:bg-red-500/5 border border-[#FF3B30]/10 dark:border-red-500/10 rounded-xl flex items-start gap-3 text-left">
                                <AlertTriangle className="w-5 h-5 text-[#FF3B30] dark:text-red-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-[#86868B] dark:text-red-200/80">
                                    <p className="font-bold text-[#FF3B30] dark:text-red-400 mb-1">Atenção!</p>
                                    Este grupo está sendo usado em <strong className="text-[#1D1D1F] dark:text-white">{deletingGroup.count} exercícios</strong>.
                                </div>
                            </div>
                        ) : null}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingGroup(null)}
                                className="flex-1 px-4 py-2.5 bg-[#F5F5F7] dark:bg-glass-bg hover:bg-[#E8E8ED] dark:hover:bg-glass-bg-active text-[#1D1D1F] dark:text-white font-medium rounded-full dark:rounded-xl transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 bg-[#FF3B30] dark:bg-red-600 hover:bg-[#E0342B] dark:hover:bg-red-500 text-white font-semibold rounded-full dark:rounded-xl transition-all text-sm shadow-sm dark:shadow-lg dark:shadow-red-600/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
