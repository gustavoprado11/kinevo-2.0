'use client'

import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion'
import { AlertCircle, Check } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Z } from '@/lib/z-index'

export type ToastType = 'success' | 'error'

export interface ToastInput {
    message: string
    type?: ToastType
}

interface ToastState {
    id: number
    message: string
    type: ToastType
}

interface ToastContextValue {
    toast: (input: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 2500

/**
 * Provider de toasts global.
 *
 * Política de toasts simultâneos: REPLACE. Um novo toast substitui o anterior
 * imediatamente e reseta o timer de auto-dismiss. Não há fila — manter UX
 * simples e evitar empilhamento visual.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [current, setCurrent] = useState<ToastState | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const idRef = useRef(0)

    const toast = useCallback((input: ToastInput) => {
        idRef.current += 1
        const next: ToastState = {
            id: idRef.current,
            message: input.message,
            type: input.type ?? 'success',
        }
        if (timerRef.current) clearTimeout(timerRef.current)
        setCurrent(next)
        timerRef.current = setTimeout(() => {
            setCurrent((prev) => (prev?.id === next.id ? null : prev))
            timerRef.current = null
        }, AUTO_DISMISS_MS)
    }, [])

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const isError = current?.type === 'error'

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div
                aria-hidden={!current}
                className="fixed bottom-4 right-4 pointer-events-none"
                style={{ zIndex: Z.TOAST }}
            >
                {/* LazyMotion local: o toast é montado no root layout (todas as
                    rotas); usar m + domAnimation evita embarcar a engine
                    completa do framer-motion no First Load JS de todas elas. */}
                <LazyMotion features={domAnimation} strict>
                    <AnimatePresence mode="wait">
                        {current && (
                            <m.div
                                key={current.id}
                                role={isError ? 'alert' : 'status'}
                                aria-live={isError ? 'assertive' : 'polite'}
                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className="pointer-events-auto flex items-center gap-2 rounded-full border border-k-border-primary bg-surface-card px-4 py-2 text-xs text-k-text-primary shadow-lg"
                            >
                                {isError ? (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" aria-hidden />
                                ) : (
                                    <Check className="w-3.5 h-3.5 text-violet-500" aria-hidden />
                                )}
                                <span>{current.message}</span>
                            </m.div>
                        )}
                    </AnimatePresence>
                </LazyMotion>
            </div>
        </ToastContext.Provider>
    )
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        throw new Error('useToast() deve ser usado dentro de <ToastProvider>.')
    }
    return ctx
}
