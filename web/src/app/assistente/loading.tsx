/**
 * Skeleton instantâneo do modo Assistente (Suspense boundary). Espelha o shape do
 * novo layout — Sidebar global (w-64) + rail de Conversas/Alunos (264px) + hero do
 * chat — para a troca Clássico→Assistente dar feedback imediato. Sem dados.
 */

export default function AssistenteLoading() {
    return (
        <div className="kv-mode-in flex h-[100dvh] overflow-hidden bg-[#F5F5F7]">
            {/* Sidebar global shape */}
            <aside className="flex w-64 min-w-64 flex-col border-r border-[#E8E8ED] bg-white">
                <div className="flex items-center gap-3 px-6 pb-8 pt-8">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-[#EDEDF0]" />
                    <div className="h-4 w-20 rounded bg-[#EDEDF0]" />
                </div>
                <div className="mx-4 mb-3 h-9 rounded-[11px] bg-[#F0F0F2]" />
                <div className="space-y-1.5 px-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                            <div className="h-[18px] w-[18px] shrink-0 rounded bg-[#EDEDF0]" />
                            <div className="h-3 rounded bg-[#EDEDF0]" style={{ width: `${50 + ((i * 13) % 40)}%` }} />
                        </div>
                    ))}
                </div>
            </aside>

            {/* Rail de Conversas/Alunos shape */}
            <aside className="flex w-[264px] min-w-[264px] flex-col border-r border-[#E8E8ED] bg-white">
                <div className="px-4 pb-2 pt-3.5"><div className="h-9 rounded-[10px] bg-[#F0F0F2]" /></div>
                <div className="mx-4 mb-1.5 h-9 rounded-[9px] bg-[#F0F0F2]" />
                <div className="space-y-1.5 px-2.5 pt-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                            <div className="h-[30px] w-[30px] shrink-0 rounded-[10px] bg-[#EDEDF0]" />
                            <div className="h-3 flex-1 rounded bg-[#EDEDF0]" style={{ maxWidth: `${50 + ((i * 17) % 40)}%` }} />
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main: hero + composer skeleton */}
            <main className="min-h-0 flex-1 overflow-hidden">
                <div className="mx-auto max-w-[720px] px-7 pt-[72px]">
                    <div className="mb-7 flex flex-col items-center">
                        <div className="mb-4 h-14 w-14 rounded-[17px] bg-[#EDE9FE]" />
                        <div className="mb-2 h-3 w-32 rounded bg-[#EDEDF0]" />
                        <div className="h-9 w-80 max-w-full rounded-lg bg-[#E6E6EA]" />
                    </div>
                    <div className="h-[132px] rounded-[20px] border border-[#E8E8ED] bg-white" />
                    <div className="mt-9 grid grid-cols-2 gap-2.5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-[132px] rounded-[16px] border border-[#E8E8ED] bg-white" />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
