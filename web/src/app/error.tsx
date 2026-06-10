'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                    Algo deu errado
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Ocorreu um erro inesperado ao carregar esta página. Tente
                    novamente — se o problema persistir, recarregue a página ou
                    volte mais tarde.
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                    <RotateCcw className="h-4 w-4" />
                    Tentar novamente
                </button>
            </div>
        </div>
    )
}
