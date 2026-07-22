'use client'

/**
 * Skeleton instantâneo do modo Assistente (Suspense boundary). Reusa a
 * AssistantSidebar REAL (em modo `loading`, dados vazios) — mesmo padrão do
 * dashboard/loading.tsx, que reusa o AppLayout real. Assim a casca (marca +
 * toggle + "Nova conversa" + nav + perfil) NÃO muda na troca Clássico→Assistente:
 * só o miolo do chat entra em skeleton, dando uma transição suave em vez do
 * "pipocar" da barra. O bg usa tokens semânticos p/ casar com o AssistantWorkspace
 * (claro e escuro). Ver components/layout/mode-toggle.tsx.
 */

import { AssistantSidebar } from '@/components/assistant/workspace/assistant-sidebar'

const noop = () => {}

export default function AssistenteLoading() {
    return (
        <div className="kv-mode-in flex h-[100dvh] overflow-hidden bg-surface-inset text-k-text-primary dark:bg-background dark:text-foreground">
            <AssistantSidebar
                loading
                trainerName={null}
                trainerEmail={null}
                trainerAvatarUrl={null}
                students={[]}
                conversations={[]}
                activeConversationId={null}
                focusedStudentId={null}
                segment="alunos"
                search=""
                onSegment={noop}
                onSearch={noop}
                onHome={noop}
                onNewConversation={noop}
                onSelectStudent={noop}
                onSelectConversation={noop}
                onToggleClassic={noop}
            />

            {/* Miolo: hero + composer + cards em skeleton (a home conversacional). */}
            <main className="min-h-0 flex-1 overflow-hidden">
                <div className="mx-auto max-w-[720px] px-7 pt-[72px]">
                    <div className="mb-7 flex flex-col items-center">
                        <div className="mb-4 h-14 w-14 rounded-[17px] bg-surface-card" />
                        <div className="mb-2 h-3 w-32 rounded bg-surface-card" />
                        <div className="h-9 w-80 max-w-full rounded-lg bg-surface-card" />
                    </div>
                    <div className="h-[132px] rounded-[20px] border border-k-border-subtle bg-surface-card" />
                    <div className="mt-9 grid grid-cols-2 gap-2.5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-[132px] rounded-[16px] border border-k-border-subtle bg-surface-card" />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
