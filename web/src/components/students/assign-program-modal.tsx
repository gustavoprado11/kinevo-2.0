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

    // Removed separate fetchTemplates effect to avoid double render/race conditions


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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-muted rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-border overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {step === 'select' ? 'Atribuir Programa' : 'Confirmar Atribuição'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {step === 'select' ? `Selecione um programa para ${studentName}` : selectedTemplate?.name}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={assigning}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {error && (
                        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {step === 'select' && (
                        <div className="p-6">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <p className="text-muted-foreground mb-2">Nenhum programa disponível</p>
                                    <p className="text-sm text-muted-foreground">Crie um programa na biblioteca antes de atribuir.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleSelectTemplate(template)}
                                            className="w-full text-left p-4 bg-card hover:bg-muted/50 border border-border hover:border-violet-500/30 rounded-xl transition-all group"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-foreground group-hover:text-violet-300 transition-colors">
                                                        {template.name}
                                                    </h3>
                                                    {template.description && (
                                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                                        {template.duration_weeks && (
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {template.duration_weeks} semanas
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                            </svg>
                                                            {template.workout_count} treinos
                                                        </span>
                                                    </div>
                                                </div>
                                                <svg className="w-5 h-5 text-muted-foreground/80 group-hover:text-violet-400 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'confirm' && selectedTemplate && (
                        <div className="p-6">
                            {/* Selected Program Summary */}
                            <div className="bg-card rounded-xl border border-border/70 p-5 mb-6">
                                <h3 className="font-semibold text-foreground text-lg mb-2">{selectedTemplate.name}</h3>
                                {selectedTemplate.description && (
                                    <p className="text-sm text-muted-foreground mb-4">{selectedTemplate.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    {selectedTemplate.duration_weeks && (
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {selectedTemplate.duration_weeks} semanas
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        {selectedTemplate.workout_count} treinos
                                    </span>
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm text-amber-200 font-medium mb-1">
                                            Este programa será copiado para o aluno
                                        </p>
                                        <p className="text-xs text-amber-300/70">
                                            Alterações futuras no programa original não afetarão a cópia do aluno. O programa atual (se houver) será pausado.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Assigned to */}
                            <div className="flex items-center gap-3 text-sm mb-6">
                                <span className="text-muted-foreground">Atribuir para:</span>
                                <span className="px-3 py-1 bg-violet-500/10 text-violet-300 rounded-lg border border-violet-500/20 font-medium">
                                    {studentName}
                                </span>
                            </div>

                            {/* Scheduling Options */}
                            <div className="space-y-5 mb-4 border-t border-border pt-5 mt-5">
                                <h4 className="text-foreground font-medium flex items-center gap-2">
                                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Configuração de Início
                                </h4>

                                <div className="grid grid-cols-1 gap-3">
                                    <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${assignmentType === 'immediate' ? 'bg-violet-500/10 border-violet-500 ring-1 ring-violet-500/50' : 'bg-card/90 border-border hover:bg-muted hover:border-border/80'}`}>
                                        <input
                                            type="radio"
                                            name="assignmentTypeModal"
                                            value="immediate"
                                            checked={assignmentType === 'immediate'}
                                            onChange={() => setAssignmentType('immediate')}
                                            className="mt-1 w-4 h-4 text-violet-600 bg-background border-border/80 focus:ring-violet-500"
                                        />
                                        <div>
                                            <span className={`block font-semibold ${assignmentType === 'immediate' ? 'text-violet-300' : 'text-foreground'}`}>
                                                Iniciar Imediatamente
                                            </span>
                                            <span className="text-sm text-muted-foreground mt-1 block leading-relaxed">
                                                O programa atual (se houver) será concluído automaticamente e este novo programa ficará ativo agora.
                                            </span>
                                        </div>
                                    </label>

                                    <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${assignmentType === 'scheduled' ? 'bg-purple-500/10 border-purple-500 ring-1 ring-purple-500/50' : 'bg-card/90 border-border hover:bg-muted hover:border-border/80'}`}>
                                        <input
                                            type="radio"
                                            name="assignmentTypeModal"
                                            value="scheduled"
                                            checked={assignmentType === 'scheduled'}
                                            onChange={() => setAssignmentType('scheduled')}
                                            className="mt-1 w-4 h-4 text-purple-600 bg-background border-border/80 focus:ring-purple-500"
                                        />
                                        <div>
                                            <span className={`block font-semibold ${assignmentType === 'scheduled' ? 'text-purple-300' : 'text-foreground'}`}>
                                                Agendar para o Futuro
                                            </span>
                                            <span className="text-sm text-muted-foreground mt-1 block leading-relaxed">
                                                O programa será adicionado à fila de "Próximos Programas" e não substituirá o atual até ser ativado.
                                            </span>

                                            {assignmentType === 'scheduled' && (
                                                <div className="mt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                                                    <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1.5">
                                                        Data de Início Prevista
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        className="w-full px-3 py-2 bg-background/80 border border-purple-500/30 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all [color-scheme:dark]"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'confirm' && (
                    <div className="px-6 py-4 border-t border-border bg-card flex gap-3 flex-shrink-0">
                        <button
                            onClick={handleBack}
                            disabled={assigning}
                            className="flex-1 py-3 px-4 bg-secondary hover:bg-secondary/80 disabled:bg-muted disabled:opacity-50 text-secondary-foreground font-medium rounded-xl transition-colors"
                        >
                            Voltar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={assigning}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:from-muted disabled:to-muted disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
                        >
                            {assigning ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Atribuindo...
                                </span>
                            ) : (
                                'Confirmar Atribuição'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
