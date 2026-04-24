'use client'

import { AlertTriangle } from 'lucide-react'

export interface ConflictItem {
    id: string
    studentName: string
    startTime: string
    durationMinutes: number
}

interface Props {
    conflicts: ConflictItem[]
    onCancel: () => void
    onConfirm: () => void
    isConfirming?: boolean
}

export function AppointmentConflictAlert({
    conflicts,
    onCancel,
    onConfirm,
    isConfirming,
}: Props) {
    return (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
                <AlertTriangle
                    className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                    strokeWidth={1.5}
                />
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                        {conflicts.length === 1
                            ? 'Conflito de horário'
                            : 'Conflitos de horário'}
                    </h4>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                        {conflicts.length === 1
                            ? 'Você já tem outro agendamento nesse horário:'
                            : 'Você já tem outros agendamentos nesse horário:'}
                    </p>
                    <ul className="mt-2 space-y-1">
                        {conflicts.map((c) => (
                            <li
                                key={c.id}
                                className="text-xs text-amber-900 dark:text-amber-200 font-medium"
                            >
                                • {c.studentName} às {c.startTime}
                                <span className="text-amber-700/70 dark:text-amber-300/60 font-normal">
                                    {' '}
                                    ({c.durationMinutes} min)
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isConfirming}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isConfirming}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                >
                    {isConfirming ? 'Salvando...' : 'Continuar mesmo assim'}
                </button>
            </div>
        </div>
    )
}
