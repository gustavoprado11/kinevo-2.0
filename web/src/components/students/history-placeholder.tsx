export function HistoryPlaceholder() {
    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Histórico de Treinos</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Registro completo de atividades</p>
                </div>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    Em breve
                </span>
            </div>

            <div className="border border-dashed border-border rounded-xl p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/10 to-blue-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <p className="text-muted-foreground mb-2">Histórico completo de treinos</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Aqui você poderá visualizar todos os treinos realizados pelo aluno, com detalhes de cargas, repetições e datas.
                </p>
            </div>
        </div>
    )
}
