import Link from 'next/link'

export default function NotFound() {
    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#FAF7F2',
                color: '#0E0E0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
            }}
        >
            <div style={{ maxWidth: 480, textAlign: 'center' }}>
                <p
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '2.2px',
                        textTransform: 'uppercase',
                        color: '#8E8B82',
                        marginBottom: 16,
                    }}
                >
                    404 · Página não encontrada
                </p>
                <h1
                    style={{
                        fontFamily: 'var(--font-fraunces), serif',
                        fontWeight: 350,
                        fontSize: 'clamp(40px, 7vw, 64px)',
                        lineHeight: 1,
                        letterSpacing: '-0.035em',
                        marginBottom: 18,
                    }}
                >
                    Essa landing <em style={{ fontStyle: 'italic', color: '#7C3AED' }}>não existe.</em>
                </h1>
                <p style={{ fontSize: 16, color: '#5C5C5C', marginBottom: 32, lineHeight: 1.5 }}>
                    O link pode estar com erro de digitação, ou o treinador ainda não publicou a página dele.
                </p>
                <Link
                    href="/"
                    style={{
                        display: 'inline-block',
                        background: '#0E0E0E',
                        color: '#FAF7F2',
                        padding: '14px 22px',
                        borderRadius: 99,
                        fontWeight: 600,
                        fontSize: 14,
                    }}
                >
                    Voltar ao Kinevo
                </Link>
            </div>
        </div>
    )
}
