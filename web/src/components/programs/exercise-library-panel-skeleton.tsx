// Skeleton leve do painel de biblioteca de exercícios. É o fallback do
// dynamic(ssr:false): o painel renderiza centenas a milhares de linhas, então
// tirá-lo do HTML do SSR encolhe o documento (LCP do canvas central paga mais
// cedo) e do chunk inicial do builder. Este placeholder ocupa exatamente a
// mesma caixa de 320px (o pai já reserva a largura) por uma fração de segundo
// até o chunk do painel carregar — sem layout shift (CLS preservado).
//
// CSS puro (animate-pulse do Tailwind), sem framer-motion e sem dependências.
export function ExerciseLibrarySkeleton() {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-surface-primary animate-pulse" aria-hidden>
            {/* Busca */}
            <div className="px-3 pt-3 pb-2">
                <div className="h-[42px] rounded-xl bg-[#F5F5F7] dark:bg-glass-bg" />
            </div>
            {/* Chips de grupo muscular */}
            <div className="flex gap-2 px-3 pb-2">
                <div className="h-7 w-16 rounded-full bg-[#F5F5F7] dark:bg-glass-bg" />
                <div className="h-7 w-20 rounded-full bg-[#F5F5F7] dark:bg-glass-bg" />
                <div className="h-7 w-14 rounded-full bg-[#F5F5F7] dark:bg-glass-bg" />
            </div>
            {/* Barra de contagem */}
            <div className="px-4 py-1.5 border-y border-[#E8E8ED] dark:border-k-border-subtle">
                <div className="h-2.5 w-20 rounded bg-[#F5F5F7] dark:bg-glass-bg" />
            </div>
            {/* Linhas de exercício */}
            <div className="flex-1 overflow-hidden px-3 pt-2 space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-[#F5F5F7] dark:bg-glass-bg" />
                ))}
            </div>
            {/* Footer (criar exercício) */}
            <div className="px-3 py-2.5 border-t border-[#E8E8ED] dark:border-k-border-subtle">
                <div className="h-9 rounded-lg bg-[#F5F5F7] dark:bg-glass-bg" />
            </div>
        </div>
    )
}
