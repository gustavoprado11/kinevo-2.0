/**
 * AssistantMark — a marca do Assistente Kinevo.
 *
 * Estrela de quatro pontas com lados côncavos, desenhada monoline: precisa e
 * geométrica, no idioma "ferramenta profissional" do redesign (jul/2026).
 * Substitui o `Sparkles` do Lucide (o glifo genérico de IA) em todas as
 * superfícies do Assistente. Herda a cor via `currentColor`.
 *
 * - `variant="outline"` (default): traço fino, para tamanhos ≥ 14px.
 * - `variant="filled"`: preenchida, para tamanhos pequenos ou sobre fundos
 *   sólidos (avatares, chips) onde o traço fecharia.
 */
export function AssistantMark({
    size = 24,
    strokeWidth = 1.5,
    variant = 'outline',
    className,
    ...rest
}: {
    size?: number
    strokeWidth?: number
    variant?: 'outline' | 'filled'
    className?: string
} & Omit<React.SVGProps<SVGSVGElement>, 'strokeWidth' | 'ref'>) {
    const d =
        'M12 2.5C12.78 8.24 15.76 11.22 21.5 12C15.76 12.78 12.78 15.76 12 21.5C11.22 15.76 8.24 12.78 2.5 12C8.24 11.22 11.22 8.24 12 2.5Z'
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={className}
            aria-hidden="true"
            {...rest}
        >
            <path
                d={d}
                fill={variant === 'filled' ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={variant === 'filled' ? 0 : strokeWidth}
                strokeLinejoin="round"
            />
        </svg>
    )
}
