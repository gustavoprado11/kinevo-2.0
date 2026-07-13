'use client'

import { X, Timer, Minus, Plus } from 'lucide-react'
import {
    useTrainingRoomPreferencesStore,
    MIN_REST_SECONDS,
    MAX_REST_SECONDS,
    REST_STEP_SECONDS,
} from '@/stores/training-room-preferences-store'

interface TrainingRoomSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    /** Chamado quando o treinador desliga o timer — a Sala limpa o descanso em curso. */
    onRestTimerDisabled?: () => void
}

/**
 * Configurações da Sala de Treino — preferências do treinador (globais, por
 * dispositivo). Espelha o TrainingRoomSettingsSheet do mobile; casa extensível
 * para futuras preferências.
 */
export function TrainingRoomSettingsModal({
    isOpen,
    onClose,
    onRestTimerDisabled,
}: TrainingRoomSettingsModalProps) {
    const restTimerAuto = useTrainingRoomPreferencesStore((s) => s.restTimerAuto)
    const setRestTimerAuto = useTrainingRoomPreferencesStore((s) => s.setRestTimerAuto)
    const defaultRestSeconds = useTrainingRoomPreferencesStore((s) => s.defaultRestSeconds)
    const setDefaultRestSeconds = useTrainingRoomPreferencesStore((s) => s.setDefaultRestSeconds)

    if (!isOpen) return null

    const handleToggle = () => {
        const next = !restTimerAuto
        setRestTimerAuto(next)
        if (!next) onRestTimerDisabled?.()
    }

    const canDecrement = restTimerAuto && defaultRestSeconds > MIN_REST_SECONDS
    const canIncrement = restTimerAuto && defaultRestSeconds < MAX_REST_SECONDS

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md rounded-2xl border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl mx-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-foreground">
                            Configurações da Sala
                        </h2>
                        <p className="text-xs text-[#86868B] dark:text-muted-foreground mt-0.5">
                            Valem para todos os alunos, neste navegador.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fechar"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#86868B] dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-glass-bg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    {/* Timer de descanso automático */}
                    <div className="flex items-start gap-3 rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-slate-50 dark:bg-surface-inset p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/10 dark:bg-violet-600/20">
                            <Timer size={18} className="text-violet-600 dark:text-violet-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <label
                                htmlFor="rest-timer-toggle"
                                className="block text-sm font-semibold text-[#1D1D1F] dark:text-foreground cursor-pointer"
                            >
                                Timer de descanso automático
                            </label>
                            <p className="text-xs text-[#86868B] dark:text-muted-foreground mt-1 leading-relaxed">
                                Inicia a contagem de descanso ao concluir cada série. Desligue se
                                você lança as cargas do exercício inteiro de uma vez.
                            </p>
                        </div>

                        <button
                            id="rest-timer-toggle"
                            type="button"
                            role="switch"
                            aria-checked={restTimerAuto}
                            onClick={handleToggle}
                            className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                restTimerAuto ? 'bg-violet-600' : 'bg-[#D2D2D7] dark:bg-k-border-primary'
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                                    restTimerAuto ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Duração padrão — esmaece quando o timer está desligado */}
                    <div
                        className={`flex items-center gap-3 rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-slate-50 dark:bg-surface-inset p-4 transition-opacity ${
                            restTimerAuto ? 'opacity-100' : 'opacity-40'
                        }`}
                    >
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground">
                                Duração padrão
                            </p>
                            <p className="text-xs text-[#86868B] dark:text-muted-foreground mt-1 leading-relaxed">
                                Usada quando o exercício não tem descanso definido no programa.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                disabled={!canDecrement}
                                onClick={() => setDefaultRestSeconds(defaultRestSeconds - REST_STEP_SECONDS)}
                                aria-label="Diminuir descanso padrão"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-k-border-subtle text-[#1D1D1F] dark:text-foreground transition-colors enabled:hover:bg-slate-100 dark:enabled:hover:bg-glass-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Minus size={14} />
                            </button>

                            <span className="min-w-[46px] text-center text-sm font-semibold tabular-nums text-[#1D1D1F] dark:text-foreground">
                                {defaultRestSeconds}s
                            </span>

                            <button
                                type="button"
                                disabled={!canIncrement}
                                onClick={() => setDefaultRestSeconds(defaultRestSeconds + REST_STEP_SECONDS)}
                                aria-label="Aumentar descanso padrão"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-glass-bg border border-[#D2D2D7] dark:border-k-border-subtle text-[#1D1D1F] dark:text-foreground transition-colors enabled:hover:bg-slate-100 dark:enabled:hover:bg-glass-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
