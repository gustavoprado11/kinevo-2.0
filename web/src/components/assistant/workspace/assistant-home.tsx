'use client'

/**
 * AssistantHome — landing do modo Assistente (estilo Cowork). Hero + composer +
 * "Precisa de atenção" (insights) + "Comece por aqui" + "Conversas recentes".
 * Apresentacional; envia ações via callbacks do AssistantWorkspace.
 */

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, Wallet, Users, Dumbbell, MessageCircle, Coins, UserPlus, Wand2 } from 'lucide-react'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { attentionKind, KIND_TAG, attentionPrompt } from '@/lib/assistant/attention'
import { avatarFor, greeting, timeShort } from './ui-util'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { AssistantComposer, type AssistantTurnMode } from './assistant-composer'
import { AssistantMark } from '@/components/assistant/assistant-mark'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { TourHelpButton } from '@/components/onboarding/widgets/tour-help-button'

/**
 * Cada atalho tem `label` (texto curto exibido no card) e `prompt` (instrução
 * expandida e bem-especificada que é inserida no composer). O prompt otimizado
 * pede formato/critérios/ordenação → respostas melhores do motor de IA por trás.
 */
const STARTERS: { label: string; icon: typeof Wallet; color: string; bg: string; prompts: { label: string; prompt: string }[] }[] = [
    {
        label: 'Financeiro', icon: Wallet, color: '#3B82F6', bg: '#EFF6FF', prompts: [
            { label: 'Mostrar os alunos inadimplentes do mês', prompt: 'Liste os alunos com pagamentos em atraso ou vencidos neste mês. Para cada um, traga nome, valor pendente, dias de atraso e data de vencimento. Ordene do mais crítico para o menos crítico e sugira uma ação de cobrança para os casos mais urgentes.' },
            { label: 'Qual o MRR atual?', prompt: 'Calcule o MRR (receita recorrente mensal) atual com base nas assinaturas ativas. Mostre o valor total, o número de alunos pagantes e o ticket médio, e comente a variação em relação ao mês anterior se houver dados.' },
            { label: 'Gerar um resumo financeiro do mês', prompt: 'Gere um resumo financeiro do mês atual: receita recebida, valores pendentes/inadimplência, MRR, novos contratos e cancelamentos. Destaque os pontos de atenção e finalize com 2 a 3 recomendações práticas.' },
        ],
    },
    {
        label: 'Alunos', icon: Users, color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', prompts: [
            { label: 'Quais alunos estão sem treino ativo?', prompt: 'Liste os alunos que não têm nenhum programa de treino ativo no momento. Para cada um, informe nome, há quanto tempo está sem treino e o status da assinatura. Priorize quem está pagando mas sem treino e sugira o próximo passo.' },
            { label: 'Resumo de adesão da semana', prompt: 'Faça um resumo da adesão aos treinos nesta semana: treinos concluídos vs. planejados, quem está em dia e quem está faltando. Destaque os alunos com baixa adesão e sugira ações de reengajamento.' },
            { label: 'Quais alunos estão em risco de cancelar?', prompt: 'Identifique os alunos com maior risco de cancelamento a partir de sinais como queda de frequência, faltas recentes, estagnação e inadimplência. Para cada um, explique o motivo do risco e sugira uma ação de retenção.' },
        ],
    },
    {
        label: 'Treinos', icon: Dumbbell, color: '#F59E0B', bg: '#FFFBEB', prompts: [
            { label: 'Gerar um programa para um aluno', prompt: 'Quero gerar um novo programa de treino. Pergunte para qual aluno e, com base no histórico, objetivo e nível dele, proponha a estrutura (divisão, frequência semanal, foco e duração) para eu aprovar antes de criar.' },
            { label: 'Quais alunos estão estagnados?', prompt: 'Identifique os alunos estagnados (sem progressão de carga ou repetições) nas últimas semanas. Para cada um, mostre em quais exercícios está o platô e sugira um ajuste de estímulo para destravar a evolução.' },
            { label: 'Criar um template na biblioteca', prompt: 'Quero criar um template de programa reutilizável na biblioteca. Me ajude a definir objetivo, divisão (ex.: ABC), frequência semanal e os exercícios principais de cada sessão, e então monte o template.' },
        ],
    },
    {
        label: 'Comunicação', icon: MessageCircle, color: '#16A34A', bg: '#ECFDF5', prompts: [
            { label: 'Enviar uma mensagem motivacional para um aluno', prompt: 'Quero enviar uma mensagem motivacional. Pergunte para qual aluno e, com base no progresso recente dele, escreva uma mensagem curta e personalizada no meu tom para eu revisar antes de enviar.' },
            { label: 'Enviar formulário de check-in', prompt: 'Quero enviar um formulário de check-in. Pergunte para qual aluno e qual modelo de formulário usar, e prepare o envio para eu confirmar.' },
            { label: 'Lembrar quem faltou ao treino', prompt: 'Liste os alunos que faltaram aos treinos planejados nos últimos dias e escreva, para cada um, uma mensagem de lembrete gentil e personalizada para eu revisar antes de enviar.' },
        ],
    },
]

interface Props {
    trainerName: string | null
    summary: AiUsageSummary
    attention: AttentionItem[]
    recents: ConversationListItem[]
    focusedStudentId: string | null
    students: { id: string; name: string; avatarUrl: string | null }[]
    hasStudents: boolean
    input: string
    mode: AssistantTurnMode
    onModeChange: (m: AssistantTurnMode) => void
    sending: boolean
    banner: AssistantBannerData | null
    onDismissBanner: () => void
    onInput: (v: string) => void
    onSend: () => void
    onStarter: (prompt: string) => void
    onFocusStudent: (id: string | null) => void
    onOpenConversation: (id: string) => void
    /** Treinador ainda não configurou o estilo de prescrição → mostra o convite. */
    showStyleInvite: boolean
    onStartStyleInterview: () => void
}

export function AssistantHome({
    trainerName, summary, attention, recents, focusedStudentId, students, hasStudents, input, mode, sending, banner,
    onDismissBanner, onInput, onSend, onModeChange, onStarter, onFocusStudent, onOpenConversation,
    showStyleInvite, onStartStyleInterview,
}: Props) {
    const firstName = (trainerName ?? '').split(' ')[0] || 'treinador'
    const composerRef = useRef<HTMLTextAreaElement>(null)

    // Clicar num card preenche o composer (não envia): o treinador revisa/ajusta e
    // dispara. Foca + traz o composer à vista, já que ele fica no topo da home.
    const fillFromCard = (prompt: string) => {
        onStarter(prompt)
        requestAnimationFrame(() => {
            const el = composerRef.current
            if (!el) return
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
            const end = prompt.length
            try { el.setSelectionRange(end, end) } catch { /* noop */ }
        })
    }

    return (
        <main className="relative min-h-0 flex-1 overflow-y-auto bg-white dark:bg-surface-card">
            {/* Tour sob demanda (modelo híbrido — nunca auto-inicia) */}
            <div className="absolute right-5 top-5">
                <TourHelpButton tourId="assistente" />
            </div>
            <TourRunner tourId="assistente" steps={TOUR_STEPS.assistente} />
            <div className="mx-auto max-w-[720px] px-7 pb-16 pt-[72px]">
                {/* Hero — plano, sem glow (idioma da conversa) */}
                <div className="mb-7 text-center">
                    <span className="mx-auto mb-5 flex items-center justify-center">
                        <AssistantMark size={34} strokeWidth={1.2} className="text-primary" />
                    </span>
                    <div className="mb-2 text-[14px] font-medium text-k-text-tertiary dark:text-muted-foreground">{greeting()}, {firstName}.</div>
                    <h1 className="font-display text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-k-text-primary dark:text-foreground">
                        O que vamos resolver hoje?
                    </h1>
                </div>

                {/* Composer — design "Assistente Composer" (escopo + modo inline) */}
                <AssistantComposer
                    input={input}
                    onInput={onInput}
                    onSend={onSend}
                    sending={sending}
                    placeholder="Diga o que fazer no Kinevo — ou escolha um aluno…"
                    ariaLabel="Diga o que fazer no Kinevo"
                    mode={mode}
                    onModeChange={onModeChange}
                    menuDirection="down"
                    textareaRef={composerRef}
                    maxTextareaHeight={280}
                    anchor="assistant-composer"
                    scope={hasStudents ? {
                        students: students.map((s) => ({ id: s.id, name: s.name })),
                        focusedStudentId,
                        onFocusStudent,
                        anchor: 'assistant-scope',
                    } : undefined}
                />

                {/* Erro/cota — a aba não engole mais falhas em silêncio (B2). */}
                {banner && (
                    <div className="mt-3.5">
                        <AssistantBanner data={banner} onDismiss={onDismissBanner} />
                    </div>
                )}

                {/* Contexto: CTA (sem alunos) + medidor de créditos */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    {!hasStudents && (
                        <Link href="/students" className="inline-flex items-center gap-2 rounded-control bg-primary px-3.5 py-[7px] text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90">
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} /> Crie seu primeiro aluno
                        </Link>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-k-text-tertiary">
                        <Coins className="h-[15px] w-[15px] text-k-text-quaternary" strokeWidth={1.7} />
                        <b className="font-mono font-semibold text-k-text-primary tabular-nums">{summary.creditsRemaining.toLocaleString('pt-BR')}</b> de <span className="tabular-nums">{summary.creditsTotal.toLocaleString('pt-BR')}</span> créditos
                    </span>
                </div>

                {/* Precisa de atenção — painel hairline (idioma dos painéis do
                    dashboard): rótulo mono micro-caps, contagem tabular em âmbar
                    (é o estado que pede atenção), linhas divididas com avatar
                    neutro e a categoria como rótulo mono com cor só semântica. */}
                {attention.length > 0 && (
                    <section data-onboarding="assistant-attention" className="mt-9">
                        <div className="mb-2.5 flex items-baseline gap-2">
                            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">Precisa de atenção</span>
                            <span className="font-mono text-[10.5px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">{attention.length}</span>
                        </div>
                        <div className="divide-y divide-k-border-subtle rounded-panel border border-k-border-subtle bg-surface-card">
                            {attention.map((a) => {
                                const kind = attentionKind(a)
                                const tag = KIND_TAG[kind]
                                const av = avatarFor(a.studentName)
                                const prompt = attentionPrompt(a)
                                const heading = a.studentName ?? a.title
                                const TagIcon = tag.icon
                                const tagTextCls = kind === 'estagnado'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : kind === 'pronto_para_evoluir'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-k-text-quaternary'
                                return (
                                    <button key={a.id} onClick={() => { if (a.studentId) onFocusStudent(a.studentId); fillFromCard(prompt) }}
                                        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-panel last:rounded-b-panel hover:bg-surface-inset/60">
                                        {a.studentName ? (
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-k-border-subtle bg-surface-inset text-[11px] font-semibold text-k-text-secondary">{av.initials}</span>
                                        ) : (
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-k-border-subtle bg-surface-inset">
                                                <TagIcon className={`h-4 w-4 ${tagTextCls}`} strokeWidth={1.7} />
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline gap-2">
                                                <b className="truncate text-sm font-semibold text-k-text-primary">{heading}</b>
                                                <span className={`shrink-0 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] ${tagTextCls}`}>
                                                    {tag.label}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-[12.5px] text-k-text-tertiary">{a.studentName ? a.title : a.body}</span>
                                        </span>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-k-text-quaternary" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Estilo já configurado: sinal discreto de que os builds seguem o
                    treinador (com o caminho para revisar). */}
                {!showStyleInvite && (
                    <section className="mt-9">
                        <Link
                            href="/settings#estilo"
                            className="inline-flex items-center gap-2 rounded-control border border-k-border-subtle bg-surface-card px-3.5 py-[7px] text-[12.5px] font-medium text-k-text-secondary transition hover:bg-surface-inset hover:text-k-text-primary"
                        >
                            <Wand2 className="h-[13px] w-[13px] text-k-text-tertiary" strokeWidth={1.7} />
                            Seu estilo está ativo — eu monto os treinos do seu jeito
                        </Link>
                    </section>
                )}

                {/* Convite: configurar o estilo de prescrição (some depois de configurado) */}
                {showStyleInvite && (
                    <section className="mt-9">
                        <button
                            onClick={onStartStyleInterview}
                            disabled={sending}
                            className="group flex w-full items-center gap-3.5 rounded-panel border border-k-border-subtle bg-surface-card py-[14px] pl-4 pr-4 text-left transition-colors hover:bg-surface-inset/60 disabled:opacity-60"
                        >
                            {/* Único acento do card: o glifo da ação em violeta. */}
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary">
                                <Wand2 className="h-4 w-4 text-primary-foreground" strokeWidth={1.9} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <b className="block text-[14.5px] font-semibold tracking-[-.01em] text-k-text-primary">
                                    Ensine o seu estilo de prescrição
                                </b>
                                <span className="mt-0.5 block text-[12.5px] text-k-text-tertiary">
                                    Eu leio os programas que você já montou e pergunto só o resto. Depois, monto os treinos do seu jeito. Leva ~3 min.
                                </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-k-text-quaternary" strokeWidth={2} />
                        </button>
                    </section>
                )}

                {/* Comece por aqui */}
                <section data-onboarding="assistant-starters" className="mt-9">
                    <div className="mb-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">Comece por aqui</div>
                    <div className="grid grid-cols-2 gap-2.5">
                        {STARTERS.map((s) => (
                            <div key={s.label} className="rounded-panel border border-k-border-subtle bg-surface-card p-4">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset">
                                        <s.icon className="h-[14px] w-[14px] text-k-text-secondary" strokeWidth={1.7} />
                                    </span>
                                    <b className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">{s.label}</b>
                                </div>
                                {s.prompts.map((p, i) => (
                                    <button key={p.label} onClick={() => fillFromCard(p.prompt)}
                                        className={`flex w-full items-center justify-between gap-2 py-[5px] text-left text-[13px] text-k-text-primary transition hover:text-primary ${i > 0 ? 'border-t border-k-border-subtle/60' : ''}`}>
                                        {p.label} <ChevronRight className="h-3.5 w-3.5 shrink-0 text-k-text-quaternary" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Conversas recentes */}
                {recents.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">Conversas recentes</div>
                        <div className="flex flex-col">
                            {recents.slice(0, 5).map((c) => {
                                const av = avatarFor(c.studentName)
                                const isGeneral = !c.student_id
                                return (
                                    <button key={c.id} onClick={() => onOpenConversation(c.id)}
                                        className="group flex items-center gap-3 -mx-2.5 rounded-control border-b border-k-border-subtle px-2.5 py-2.5 text-left transition-colors last:border-0 hover:border-transparent hover:bg-surface-inset">
                                        {isGeneral ? (
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary">
                                                <AssistantMark variant="filled" className="h-3.5 w-3.5 text-primary-foreground" />
                                            </span>
                                        ) : (
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset text-[11px] font-semibold text-k-text-secondary">
                                                {av.initials}
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <b className="block text-[13.5px] text-k-text-primary">{c.studentName ?? 'Geral · estúdio'}</b>
                                            <span className="block truncate text-[12px] text-k-text-tertiary">{c.title}</span>
                                        </span>
                                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-k-text-quaternary transition-opacity group-hover:opacity-0">{timeShort(c.last_message_at)}</span>
                                        <ChevronRight className="-ml-4 h-4 w-4 shrink-0 text-k-text-quaternary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
