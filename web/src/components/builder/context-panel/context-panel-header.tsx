import { Smartphone, GitCompareArrows, X } from 'lucide-react'

export type ContextPanelMode = 'preview' | 'past_workout' | 'none'

interface ContextPanelHeaderProps {
    mode: ContextPanelMode
    onModeChange: (mode: ContextPanelMode) => void
    showCompare: boolean
}

export function ContextPanelHeader({ mode, onModeChange, showCompare }: ContextPanelHeaderProps) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-primary flex-shrink-0">
            <div className="flex items-center bg-[#F5F5F7] dark:bg-surface-elevated rounded-lg p-0.5 gap-0.5">
                <button
                    onClick={() => onModeChange('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                        mode === 'preview'
                            ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                            : 'text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                    }`}
                >
                    <Smartphone size={12} />
                    Visão do aluno
                </button>
                {showCompare && (
                    <button
                        onClick={() => onModeChange('past_workout')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                            mode === 'past_workout'
                                ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                : 'text-[#6E6E73] dark:text-k-text-tertiary hover:text-[#1D1D1F] dark:hover:text-k-text-primary'
                        }`}
                    >
                        <GitCompareArrows size={12} />
                        Comparar
                    </button>
                )}
            </div>
            <button
                onClick={() => onModeChange('none')}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-all"
                title="Fechar painel"
            >
                <X size={14} />
            </button>
        </div>
    )
}
