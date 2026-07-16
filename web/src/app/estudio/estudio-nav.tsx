import Link from 'next/link'

// Decisão 16/jul: a aba Estúdio é só ADMINISTRAÇÃO (equipe + billing).
// A operação (dashboard, agenda, alunos) vive nas telas normais do Kinevo.
const TABS = [
    { key: 'treinadores', label: 'Treinadores', href: '/estudio/treinadores' },
    { key: 'plano', label: 'Plano', href: '/estudio/plano' },
] as const

export function EstudioNav({ active }: { active: 'treinadores' | 'plano' }) {
    return (
        <div className="flex items-center gap-1 border-b border-k-border-subtle">
            {TABS.map(t => (
                <Link
                    key={t.key}
                    href={t.href}
                    className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        active === t.key
                            ? 'border-violet-500 text-violet-500'
                            : 'border-transparent text-k-text-tertiary hover:text-k-text-primary'
                    }`}
                >
                    {t.label}
                </Link>
            ))}
        </div>
    )
}
