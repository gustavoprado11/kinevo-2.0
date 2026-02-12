'use client'

import { useState, useEffect, useRef } from 'react'
import { assignProgram } from '@/app/students/[id]/actions/assign-program'
import { getTrainerPrograms } from '@/app/students/[id]/actions/get-trainer-programs'

interface ProgramTemplate {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workout_count: number
}

interface AssignProgramModalProps {
    isOpen: boolean
    onClose: () => void
    onProgramAssigned: () => void
    studentId: string
    studentName: string
    initialAssignmentType?: 'immediate' | 'scheduled'
}

export function AssignProgramModal({
    isOpen,
    onClose,
    onProgramAssigned,
    studentId,
    studentName,
    initialAssignmentType = 'immediate'
}: AssignProgramModalProps) {
    const [templates, setTemplates] = useState<ProgramTemplate[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null)
    const [loading, setLoading] = useState(true)
    const [assigning, setAssigning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [step, setStep] = useState<'select' | 'confirm'>('select')

    // Track mounted state
    const isMounted = useRef(true)
    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    // Scheduling state
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [assignmentType, setAssignmentType] = useState<'immediate' | 'scheduled'>(initialAssignmentType)

    // Unified effect for opening modal
    useEffect(() => {
        if (isOpen) {
            // Reset state
            setAssignmentType(initialAssignmentType)
            setSelectedTemplate(null)
            setStep('select')
            setError(null)
            setStartDate(new Date().toISOString().split('T')[0])

            // Fetch templates
            fetchTemplates()
        }
    }, [isOpen, initialAssignmentType])

    const fetchTemplates = async () => {
        setLoading(true)

        try {
            const result = await getTrainerPrograms()

            if (!isMounted.current) return

            if (!result.success) {
                setError(result.error || 'Erro ao carregar programas')
                setLoading(false)
                return
            }

            setTemplates(result.data || [])
        } catch (err) {
            if (isMounted.current) {
                setError('Erro de conexão ao buscar programas')
            }
        } finally {
            if (isMounted.current) {
                setLoading(false)
            }
        }
    }

    const handleSelectTemplate = (template: ProgramTemplate) => {
        setSelectedTemplate(template)
        setStep('confirm')
    }

    const handleBack = () => {
        setStep('select')
        setError(null)
    }

    const handleConfirm = async () => {
        if (!selectedTemplate) return

        setAssigning(true)
        setError(null)

        try {
            const result = await assignProgram({
                studentId,
                templateId: selectedTemplate.id,
                startDate: new Date(startDate).toISOString(),
                isScheduled: assignmentType === 'scheduled'
            })

            if (!result.success) {
                throw new Error(result.error)
            }

            setAssigning(false)
            onProgramAssigned()
            onClose()
        } catch (err: any) {
            setError(err.message || 'Erro ao atribuir programa')
            setAssigning(false)
        }
    }

    const handleClose = () => {
        if (!assigning) {
            setSelectedTemplate(null)
            setStep('select')
            setError(null)
            onClose()
        }
    }

    if (!isOpen) return null

    const { Calendar, Dumbbell, ChevronRight, X, AlertCircle, Loader2 } = require('lucide-react')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={handleClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-lg bg-surface-card backdrop-blur-2xl rounded-3xl shadow-2xl ring-1 ring-inset ring-k-border-primary overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-start justify-between p-8 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            {step === 'select' ? 'Atribuir Programa' : 'Confirmar Atribuição'}
                        </h2>
                        <p className="text-sm text-k-text-tertiary mt-1">
                            {step === 'select' ? `Selecione um programa para ${studentName}` : selectedTemplate?.name}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={assigning}
                        className="p-1 text-k-text-quaternary hover:text-k-text-primary transition-all disabled:opacity-50"
                    >
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-4 scrollbar-hide">
                    {error && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-sm flex items-start gap-3">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    {step === 'select' && (
                        <div className="space-y-3 pb-4">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                                    <p className="text-xs font-bold text-k-text-quaternary uppercase tracking-widest">Carregando Programas</p>
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-16 border border-dashed border-k-border-subtle rounded-3xl">
                                    <div className="w-12 h-12 rounded-full bg-glass-bg flex items-center justify-center mx-auto mb-4">
                                        <Dumbbell className="text-k-text-quaternary" size={24} strokeWidth={1.5} />
                                    </div>
                                    <p className="text-k-text-tertiary text-sm font-medium mb-1">Nenhum programa disponível</p>
                                    <p className="text-[10px] text-k-text-quaternary uppercase tracking-widest font-bold">Crie um programa na biblioteca</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleSelectTemplate(template)}
                                            className="w-full text-left p-4 bg-glass-bg hover:bg-glass-bg-active border border-k-border-subtle hover:border-k-border-primary rounded-2xl transition-all group relative active:scale-[0.98]"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h3 className="text-base font-bold text-white mb-1 group-hover:text-violet-300 transition-colors">
                                                        {template.name}
                                                    </h3>
                                                    {template.description ? (
                                                        <p className="text-sm text-k-text-tertiary mb-3 line-clamp-1 italic">
                                                            {template.description}
                                                        </p>
                                                    ) : (
                                                        <div className="h-2" />
                                                    )}

                                                    <div className="flex items-center gap-4">
                                                        {template.duration_weeks && (
                                                            <div className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-widest flex items-center gap-1.5">
                                                                <Calendar size={12} strokeWidth={1.5} className="opacity-50" />
                                                                {template.duration_weeks} semanas
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] font-bold text-k-text-quaternary dark:text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Dumbbell size={12} strokeWidth={1.5} className="opacity-50" />
                                                            {template.workout_count} treinos
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={20} className="text-k-border-subtle group-hover:text-violet-400 transition-colors shrink-0" strokeWidth={1.5} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'confirm' && selectedTemplate && (
                        <div className="space-y-6 pb-6">
                            {/* Selected Info Card */}
                            <div className="bg-glass-bg rounded-2xl border border-k-border-subtle p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/50" />
                                <h3 className="font-bold text-white text-lg mb-1">{selectedTemplate.name}</h3>
                                <div className="flex items-center gap-4 mt-2">
                                    {selectedTemplate.duration_weeks && (
                                        <div className="text-[10px] font-bold text-k-text-tertiary uppercase tracking-widest flex items-center gap-1.5">
                                            <Calendar size={12} strokeWidth={1.5} />
                                            {selectedTemplate.duration_weeks} semanas
                                        </div>
                                    )}
                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                        <Dumbbell size={12} strokeWidth={1.5} />
                                        {selectedTemplate.workout_count} treinos
                                    </div>
                                </div>
                            </div>

                            {/* Apple-style Info Alert */}
                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-4">
                                <AlertCircle className="text-amber-500 shrink-0" size={20} strokeWidth={1.5} />
                                <div>
                                    <p className="text-sm font-bold text-amber-200/90 mb-1">
                                        Importante
                                    </p>
                                    <p className="text-xs text-amber-200/50 leading-relaxed font-medium">
                                        O programa será copiado para o aluno. Alterações futuras no original não afetarão esta cópia. O programa atual será pausado.
                                    </p>
                                </div>
                            </div>

                            {/* Scheduling Section */}
                            <div className="space-y-4 pt-4 border-t border-k-border-subtle">
                                <h4 className="text-[10px] font-black text-k-text-quaternary uppercase tracking-[0.2em]">Configuração de Início</h4>

                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => setAssignmentType('immediate')}
                                        className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left group ${assignmentType === 'immediate' ? 'bg-violet-600/10 border-violet-500/50 ring-1 ring-violet-500/20' : 'bg-glass-bg border-k-border-subtle hover:bg-glass-bg-active'}`}
                                    >
                                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${assignmentType === 'immediate' ? 'border-violet-400' : 'border-k-border-primary'}`}>
                                            {assignmentType === 'immediate' && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                                        </div>
                                        <div>
                                            <span className={`block font-bold mb-1 transition-colors ${assignmentType === 'immediate' ? 'text-violet-300' : 'text-k-text-secondary'}`}>Iniciar Imediatamente</span>
                                            <span className="text-xs text-k-text-quaternary font-medium leading-relaxed block">O novo programa substituirá o ativo agora mesmo.</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setAssignmentType('scheduled')}
                                        className={`flex flex-col gap-4 p-5 rounded-2xl border transition-all text-left ${assignmentType === 'scheduled' ? 'bg-violet-600/10 border-violet-500/50 ring-1 ring-violet-500/20' : 'bg-glass-bg border-k-border-subtle hover:bg-glass-bg-active'}`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${assignmentType === 'scheduled' ? 'border-violet-400' : 'border-k-border-primary'}`}>
                                                {assignmentType === 'scheduled' && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                                            </div>
                                            <div>
                                                <span className={`block font-bold mb-1 transition-colors ${assignmentType === 'scheduled' ? 'text-violet-300' : 'text-k-text-secondary'}`}>Agendar Futuro</span>
                                                <span className="text-xs text-k-text-quaternary font-medium leading-relaxed block">Ficará na fila de próximos e aguardará ativação.</span>
                                            </div>
                                        </div>

                                        {assignmentType === 'scheduled' && (
                                            <div className="pl-8 pt-2 animate-in slide-in-from-top-2 duration-300">
                                                <label className="block text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">Data de Início Prevista</label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full bg-glass-bg border border-k-border-primary rounded-xl px-4 py-2.5 text-sm text-k-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all [color-scheme:dark]"
                                                />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-8 pt-4 flex gap-4 bg-surface-card">
                    {step === 'select' ? (
                        <button
                            onClick={handleClose}
                            className="flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-k-text-tertiary hover:text-k-text-primary transition-colors border border-k-border-subtle rounded-2xl bg-glass-bg"
                        >
                            Cancelar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleBack}
                                disabled={assigning}
                                className="flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-k-text-tertiary hover:text-k-text-primary transition-colors border border-k-border-subtle rounded-2xl bg-glass-bg disabled:opacity-50"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={assigning}
                                className="flex-[1.5] py-4 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-glass-bg-active disabled:shadow-none"
                            >
                                {assigning ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Atribuindo...
                                    </>
                                ) : (
                                    'Confirmar Atribuição'
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
