'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, X, RotateCcw } from 'lucide-react'
import {
    useDashboardLayoutStore,
    WIDGET_REGISTRY,
    type WidgetId,
} from '@/stores/dashboard-layout-store'

export function WidgetPicker() {
    const { widgets, isCustomizing, addWidget, removeWidget, resetLayout, setCustomizing } =
        useDashboardLayoutStore()

    const activeIds = new Set(widgets.map(w => w.id))
    const allWidgets = Object.values(WIDGET_REGISTRY)

    if (!isCustomizing) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25 }}
                className="mb-5 rounded-xl border border-[#007AFF]/20 dark:border-primary/20 bg-[#007AFF]/[0.03] dark:bg-primary/5 p-5"
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                            Personalizar dashboard
                        </h3>
                        <p className="text-xs text-[#86868B] dark:text-k-text-tertiary mt-0.5">
                            Arraste para reordenar. Adicione ou remova widgets.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetLayout}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#6E6E73] dark:text-k-text-secondary hover:text-[#1D1D1F] dark:hover:text-foreground rounded-lg hover:bg-white dark:hover:bg-surface-card transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Resetar
                        </button>
                        <button
                            onClick={() => setCustomizing(false)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-[#007AFF] text-white rounded-lg hover:bg-[#0056B3] transition-colors shadow-sm"
                        >
                            <Check className="w-3 h-3" />
                            Concluir
                        </button>
                    </div>
                </div>

                {/* Available widgets grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {allWidgets.map(config => {
                        const isActive = activeIds.has(config.id)
                        const isRequired = !config.removable

                        return (
                            <button
                                key={config.id}
                                disabled={isRequired}
                                onClick={() => {
                                    if (isActive && config.removable) {
                                        removeWidget(config.id)
                                    } else if (!isActive) {
                                        addWidget(config.id)
                                    }
                                }}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                                    isActive
                                        ? isRequired
                                            ? 'border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-muted/50 opacity-60 cursor-default'
                                            : 'border-[#007AFF]/30 dark:border-primary/30 bg-[#007AFF]/5 dark:bg-primary/10 hover:bg-[#007AFF]/10'
                                        : 'border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card hover:border-[#007AFF]/30 dark:hover:border-primary/30 hover:bg-[#007AFF]/5'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                    isActive
                                        ? 'bg-[#007AFF] dark:bg-primary'
                                        : 'border border-[#D2D2D7] dark:border-k-border-primary'
                                }`}>
                                    {isActive ? (
                                        <Check className="w-3 h-3 text-white" />
                                    ) : (
                                        <Plus className="w-3 h-3 text-[#AEAEB2] dark:text-k-text-quaternary" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-medium text-[#1D1D1F] dark:text-k-text-primary block truncate">
                                        {config.label}
                                    </span>
                                    <span className="text-[9px] text-[#AEAEB2] dark:text-k-text-quaternary block truncate">
                                        {config.description}
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
