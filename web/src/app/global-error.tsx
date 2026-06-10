'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Error boundary global — substitui o root layout inteiro quando algo quebra
 * lá em cima (layout.tsx, providers). Por isso precisa renderizar <html> e
 * <body> próprios e usa estilos inline: o globals.css / ThemeProvider podem
 * não estar disponíveis neste estado. Paleta light do design system
 * (Apple HIG: #F5F5F7 / #1D1D1F / primary violet #7C3AED).
 */
export default function GlobalError({
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
        <html lang="pt-BR">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    backgroundColor: '#F5F5F7',
                    color: '#1D1D1F',
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
            >
                <div
                    style={{
                        width: '100%',
                        maxWidth: '28rem',
                        borderRadius: '16px',
                        border: '1px solid #D2D2D7',
                        backgroundColor: '#ffffff',
                        padding: '32px',
                        textAlign: 'center',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                >
                    <div
                        style={{
                            margin: '0 auto 16px',
                            display: 'flex',
                            height: '48px',
                            width: '48px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(255, 59, 48, 0.1)',
                        }}
                    >
                        <AlertTriangle size={24} color="#FF3B30" />
                    </div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#1D1D1F',
                        }}
                    >
                        Algo deu errado
                    </h1>
                    <p
                        style={{
                            margin: '8px 0 0',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: '#6E6E73',
                        }}
                    >
                        Ocorreu um erro inesperado na aplicação. Tente novamente
                        — se o problema persistir, recarregue a página ou volte
                        mais tarde.
                    </p>
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            marginTop: '24px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#7C3AED',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#ffffff',
                            cursor: 'pointer',
                        }}
                    >
                        <RotateCcw size={16} />
                        Tentar novamente
                    </button>
                </div>
            </body>
        </html>
    )
}
