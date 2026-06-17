'use client'

/**
 * AssistantHome — landing do modo Assistente (estilo Cowork). Hero + composer +
 * "Precisa de atenção" (insights) + "Comece por aqui" + "Conversas recentes".
 * Apresentacional; envia ações via callbacks do AssistantWorkspace.
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import {
    Sparkles, Send, Loader2, User, ChevronDown, ChevronRight, Globe,
    Wallet, Users, Dumbbell, MessageCircle, TrendingDown, TrendingUp, FileText, Coins, UserPlus,
} from 'lucide-react'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, greeting, timeShort } from './ui-util'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { MicButton } from './mic-button'

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
        label: 'Alunos', icon: Users, color: '#7C3AED', bg: '#EDE9FE', prompts: [
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

/** Tipo visual do card de atenção, derivado de category/priority do insight. */
type AttentionKind = 'estagnado' | 'pronto_para_evoluir' | 'nota'

function attentionKind(item: AttentionItem): AttentionKind {
    if (item.category === 'progression') return 'pronto_para_evoluir'
    if (item.category === 'suggestion' || item.category === 'summary') return 'nota'
    return 'estagnado' // alert / desconhecido
}

const KIND_TAG: Record<AttentionKind, { label: string; bg: string; fg: string; icon: typeof TrendingDown }> = {
    estagnado: { label: 'Estagnado', bg: '#FFFBEB', fg: '#B45309', icon: TrendingDown },
    pronto_para_evoluir: { label: 'Pronto p/ evoluir', bg: '#F0FDF4', fg: '#15803D', icon: TrendingUp },
    nota: { label: 'Nota', bg: '#EFF6FF', fg: '#2563EB', icon: FileText },
}

// Faixa de prioridade à esquerda do card: alta → erro; senão por tipo.
const KIND_STRIPE: Record<AttentionKind, string> = {
    estagnado: '#F59E0B',
    pronto_para_evoluir: '#16A34A',
    nota: '#3B82F6',
}

/** Prompt otimizado p/ o card de atenção: contexto do insight + o que produzir. */
function attentionPrompt(item: AttentionItem): string {
    const ctx = item.studentName ? `${item.studentName}: ${item.title}` : item.title
    const ofWho = item.studentName ? ` de ${item.studentName}` : ''
    switch (attentionKind(item)) {
        case 'pronto_para_evoluir':
            return `Sobre ${ctx}. Analise o histórico recente${ofWho} e proponha uma progressão concreta — quais exercícios, novo alvo de carga/reps/volume e o porquê — para o próximo ciclo.`
        case 'estagnado':
            return `Sobre ${ctx}. Identifique em quais exercícios está o platô e proponha uma estratégia para destravar a evolução (variação de estímulo, deload ou ajuste de volume), com os próximos passos.`
        default:
            return `Sobre ${ctx}. Resuma a situação e recomende o próximo passo.`
    }
}

interface Props {
    trainerName: string | null
    summary: AiUsageSummary
    attention: AttentionItem[]
    recents: ConversationListItem[]
    focusedStudentName: string | null
    hasStudents: boolean
    input: string
    sending: boolean
    banner: AssistantBannerData | null
    onDismissBanner: () => void
    onInput: (v: string) => void
    onSend: () => void
    onStarter: (prompt: string) => void
    onPickFocus: () => void
    onClearFocus: () => void
    onOpenConversation: (id: string) => void
}

export function AssistantHome({
    trainerName, summary, attention, recents, focusedStudentName, hasStudents, input, sending, banner,
    onDismissBanner, onInput, onSend, onStarter, onPickFocus, onClearFocus, onOpenConversation,
}: Props) {
    const firstName = (trainerName ?? '').split(' ')[0] || 'treinador'
    const composerRef = useRef<HTMLTextAreaElement>(null)

    // O composer cresce com o conteúdo (até ~280px; depois rola internamente).
    // Recalcula a cada mudança de texto — inclusive ao ser preenchido por um card.
    useEffect(() => {
        const el = composerRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 280)}px`
    }, [input])

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
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#F5F5F7]">
            <div className="mx-auto max-w-[720px] px-7 pb-16 pt-[72px]">
                {/* Hero */}
                <div className="mb-7 text-center">
                    <span
                        className="mx-auto mb-4 flex h-[56px] w-[56px] items-center justify-center rounded-[17px]"
                        style={{
                            background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
                            boxShadow: '0 8px 24px -8px rgba(124,58,237,.45), inset 0 0 0 1px rgba(124,58,237,.10)',
                        }}
                    >
                        <Sparkles className="h-7 w-7 text-[#7C3AED]" strokeWidth={1.6} />
                    </span>
                    <div className="mb-2 text-[14px] font-medium text-[#86868B]">{greeting()}, {firstName}.</div>
                    <h1 className="font-display text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-[#1D1D1F]">
                        O que vamos resolver hoje?
                    </h1>
                </div>

                {/* Composer */}
                <div className="rounded-[20px] border border-[#D2D2D7] bg-white p-2 shadow-[0_8px_28px_-16px_rgba(0,0,0,0.18)] transition focus-within:border-[#C7C7CC] focus-within:shadow-[0_0_0_4px_rgba(60,60,67,0.07)]">
                    <textarea
                        ref={composerRef}
                        value={input}
                        onChange={(e) => onInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                        rows={2}
                        aria-label="Diga o que fazer no Kinevo"
                        placeholder="Diga o que fazer no Kinevo — ou escolha um aluno…"
                        // outline inline: vence a regra global unlayered `:focus-visible` do
                        // globals.css (Tailwind v4 layered perde p/ unlayered). O foco fica só
                        // na borda do card (focus-within), não no textarea interno.
                        style={{ outline: 'none' }}
                        className="max-h-[280px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-[16px] leading-relaxed placeholder:text-[#AEAEB2]"
                    />
                    <div className="flex items-center gap-2.5 px-2 pb-1 pt-1">
                        <MicButton disabled={sending} onTranscript={(t) => onInput(input ? `${input} ${t}` : t)} />
                        <span className="flex-1" />
                        <button onClick={onSend} disabled={sending || !input.trim()}
                            className="flex h-10 items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-[18px] text-[14px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)] transition hover:brightness-[1.07] disabled:opacity-50">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2} />} Agir
                        </button>
                    </div>
                </div>

                {/* Erro/cota — a aba não engole mais falhas em silêncio (B2). */}
                {banner && (
                    <div className="mt-3.5">
                        <AssistantBanner data={banner} onDismiss={onDismissBanner} />
                    </div>
                )}

                {/* Contexto */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    {!hasStudents ? (
                        <Link href="/students" className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.08)] px-3.5 py-[7px] text-[12.5px] font-semibold text-[#7C3AED] transition hover:bg-[rgba(124,58,237,0.14)]">
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} /> Crie seu primeiro aluno
                        </Link>
                    ) : focusedStudentName ? (
                        <button onClick={onClearFocus} className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.08)] px-3.5 py-[7px] text-[12.5px] font-semibold text-[#7C3AED]">
                            <User className="h-3.5 w-3.5" strokeWidth={2} /> {focusedStudentName}
                            <span className="text-[#a78bfa]">×</span>
                        </button>
                    ) : (
                        <button onClick={onPickFocus} className="inline-flex items-center gap-2 rounded-full border border-[#E8E8ED] bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-[#6E6E73] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <User className="h-3.5 w-3.5 text-[#8b5cf6]" strokeWidth={2} /> Aluno em foco <ChevronDown className="h-3.5 w-3.5 text-[#AEAEB2]" strokeWidth={2} />
                        </button>
                    )}
                    {hasStudents && !focusedStudentName && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#D2D2D7] px-3.5 py-[7px] text-[12.5px] font-semibold text-[#86868B]">
                            <Globe className="h-3.5 w-3.5 text-[#AEAEB2]" strokeWidth={2} /> Geral · visão geral dos alunos
                        </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#86868B]">
                        <Coins className="h-[15px] w-[15px] text-[#F59E0B]" strokeWidth={1.8} />
                        <b className="font-bold text-[#1D1D1F] [font-variant-numeric:tabular-nums]">{summary.creditsRemaining.toLocaleString('pt-BR')}</b> de {summary.creditsTotal.toLocaleString('pt-BR')} créditos
                    </span>
                </div>

                {/* Precisa de atenção */}
                {attention.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B]">Precisa de atenção</span>
                            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#F59E0B] px-1.5 py-px text-[10.5px] font-bold leading-none text-white [font-variant-numeric:tabular-nums]">{attention.length}</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {attention.map((a) => {
                                const kind = attentionKind(a)
                                const tag = KIND_TAG[kind]
                                const stripe = a.priority === 'high' ? '#EF4444' : KIND_STRIPE[kind]
                                const av = avatarFor(a.studentName)
                                const prompt = attentionPrompt(a)
                                const heading = a.studentName ?? a.title
                                const TagIcon = tag.icon
                                return (
                                    <button key={a.id} onClick={() => fillFromCard(prompt)}
                                        className="group relative flex items-center gap-3.5 overflow-hidden rounded-[16px] border border-[#E8E8ED] bg-white py-[15px] pl-[18px] pr-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-px hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.14)]">
                                        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: stripe }} />
                                        {a.studentName ? (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[13px] font-bold" style={{ background: av.bg, color: av.fg }}>{av.initials}</span>
                                        ) : (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]" style={{ background: tag.bg, color: tag.fg }}>
                                                <TagIcon className="h-[19px] w-[19px]" strokeWidth={1.9} />
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <b className="truncate text-[14.5px] font-semibold tracking-[-.01em]">{heading}</b>
                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-none" style={{ background: tag.bg, color: tag.fg }}>
                                                    <TagIcon className="h-[11px] w-[11px]" strokeWidth={2.2} /> {tag.label}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-[12.5px] text-[#86868B]">{a.studentName ? a.title : a.body}</span>
                                        </span>
                                        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#C4B5FD]" strokeWidth={2} />
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Comece por aqui */}
                <section className="mt-9">
                    <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B]">Comece por aqui</div>
                    <div className="grid grid-cols-2 gap-2.5">
                        {STARTERS.map((s) => (
                            <div key={s.label} className="rounded-[16px] border border-[#E8E8ED] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: s.bg, color: s.color }}>
                                        <s.icon className="h-[15px] w-[15px]" strokeWidth={2} />
                                    </span>
                                    <b className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868B]">{s.label}</b>
                                </div>
                                {s.prompts.map((p, i) => (
                                    <button key={p.label} onClick={() => fillFromCard(p.prompt)}
                                        className={`flex w-full items-center justify-between gap-2 py-[5px] text-left text-[13px] text-[#1D1D1F] transition hover:text-[#7C3AED] ${i > 0 ? 'border-t border-[#F5F5F7]' : ''}`}>
                                        {p.label} <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#AEAEB2]" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Conversas recentes */}
                {recents.length > 0 && (
                    <section className="mt-9">
                        <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-[#86868B]">Conversas recentes</div>
                        <div className="flex flex-col">
                            {recents.slice(0, 5).map((c) => {
                                const av = avatarFor(c.studentName)
                                const isGeneral = !c.student_id
                                return (
                                    <button key={c.id} onClick={() => onOpenConversation(c.id)}
                                        className="flex items-center gap-3 border-b border-[#E8E8ED] py-2.5 text-left last:border-0">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold" style={isGeneral ? { background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' } : { background: av.bg, color: av.fg }}>
                                            {isGeneral ? <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} /> : av.initials}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <b className="block text-[13.5px]">{c.studentName ?? 'Geral · estúdio'}</b>
                                            <span className="block truncate text-[12px] text-[#86868B]">{c.title}</span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-[#AEAEB2]">{timeShort(c.last_message_at)}</span>
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
